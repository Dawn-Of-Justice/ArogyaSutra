// ============================================================
// Agentic RAG — Engine Orchestrator
//
// Strategy routing:
//   DIRECT               → retrieve → generate (Kimi/Bedrock)
//   QUERY_PLAN           → plan → parallel retrieve → merge → generate
//   SPECULATIVE          → draft (Kimi) + retrieve in parallel → verify
//   ITERATIVE_CORRECTIVE → retrieve → generate → correct loop → reflect loop
//
// All strategies record outcomes for adaptive learning.
// ============================================================

import { complete } from "../llm/kimi";
import { retrieve, retrieveRefined } from "./retriever";
import { classifyQuery, topKForQueryType } from "./router";
import { plan, executeSubQueries, mergeContexts } from "./planner";
import { correctiveLoop } from "./corrective";
import { reflectiveLoop } from "./reflective";
import { selectStrategy, recordOutcome } from "./adaptive";
import { speculateAndVerify } from "./speculative";
import type {
    RAGEngineOptions,
    RAGEngineResult,
    RAGStrategy,
    ScoredContext,
} from "./types";

// ── Production: in-flight dedup + LRU response cache + hard timeout ───────
// In-flight map: concurrent identical (patientId, query) requests share one Promise
const _inflight = new Map<string, Promise<RAGEngineResult>>();
// LRU response cache: avoids full round-trips within a session (90 s TTL, 500 entries)
const _responseCache = new Map<string, { result: RAGEngineResult; ts: number }>();
const RESPONSE_CACHE_TTL_MS = 90_000;
const RESPONSE_CACHE_MAX    = 500;
// Hard deadline — leave ~5 s buffer before Next.js/Lambda's 30 s maxDuration
const PIPELINE_TIMEOUT_MS   = 24_000;

function _cacheKey(o: RAGEngineOptions): string {
    return `${o.patientId}||${o.queryText.trim().toLowerCase().slice(0, 120)}`;
}
function _lruSet(key: string, result: RAGEngineResult): void {
    if (_responseCache.size >= RESPONSE_CACHE_MAX) {
        _responseCache.delete(_responseCache.keys().next().value!);
    }
    _responseCache.set(key, { result, ts: Date.now() });
}
function _withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
        p,
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`RAG pipeline timeout after ${ms}ms`)), ms)
        ),
    ]);
}

// --------------- Generation Prompts ---------------

/** Used when patient health record contexts are available */
const GENERATION_SYSTEM = `You are ArogyaSutra, a compassionate medical AI assistant helping patients understand their health records.
Rules:
- Answer based ONLY on the provided contexts from the patient's health records.
- Cite sources as [Source N] inline.
- Use plain language a patient can understand.
- For values (BP, glucose, etc.) include trends and whether they are within normal range.
- Always end with: "Please discuss with your doctor for medical advice."
- Do NOT speculate beyond the records.`;

/** Used when retrieval was attempted but returned NO results */
const NO_RECORDS_SYSTEM = `You are ArogyaSutra, a compassionate medical AI assistant.
The patient asked a question about their health records, but we searched their records and found NO relevant entries.
Rules:
- Tell the patient clearly that you could not find relevant records for their query.
- Do NOT make up or guess any medical information, prescriptions, doctor names, or dates.
- Do NOT use [Source N] citations since there are no sources.
- Suggest the patient check if their records have been uploaded, or rephrase their question.
- Keep the response short and helpful.
- End with: "Please discuss with your doctor for medical advice."`;                                                                                                                                                                                                                                    

/** Used when no retrieval is needed (general health question, no patient-specific entities) */
const GENERAL_SYSTEM = `You are ArogyaSutra, a knowledgeable and friendly health assistant.
Answer the question clearly and concisely in plain language. Be helpful and accurate.
If the question is patient-specific and you lack their records, say so briefly.
Do not add unnecessary disclaimers on every message.`;

// --------------- Public API ---------------

/**
 * Main entry point for the agentic RAG engine.
 * Classifies the query, selects strategy, executes, and returns a structured result.
 */
export async function ragQuery(options: RAGEngineOptions): Promise<RAGEngineResult> {
    const key = _cacheKey(options);

    // 1. LRU cache hit — skip LLM call entirely
    const cached = _responseCache.get(key);
    if (cached && Date.now() - cached.ts < RESPONSE_CACHE_TTL_MS) {
        return cached.result;
    }

    // 2. In-flight dedup — share the existing Promise for identical concurrent requests
    const inflight = _inflight.get(key);
    if (inflight) return inflight;

    // 3. Execute with a hard deadline
    const promise = _withTimeout(_ragQueryInner(options), PIPELINE_TIMEOUT_MS)
        .then((result) => {
            _lruSet(key, result);
            return result;
        })
        .finally(() => _inflight.delete(key));
    _inflight.set(key, promise);
    return promise;
}

async function _ragQueryInner(options: RAGEngineOptions): Promise<RAGEngineResult> {
    const startTime = Date.now();

    const classified = classifyQuery(options.queryText);
    const hasHistory = (options.conversationHistory?.length ?? 0) > 0;
    const strategy: RAGStrategy = options.forceStrategy ||
        selectStrategy(classified.queryType, classified.complexity, hasHistory);

    console.info(`[RAG Engine] query="${options.queryText.slice(0, 60)}" type=${classified.queryType} complexity=${classified.complexity} entities=[${classified.entities.join(',')}] strategy=${strategy}`);

    let result: RAGEngineResult;

    // Fast path: ONLY explicit GENERAL type skips retrieval.
    // SIMPLE_FACTUAL always goes through RAG — the old heuristic of skipping RAG
    // for SIMPLE_FACTUAL with no detected entities caused too many false positives
    // (e.g. "what medicines am I on" has no entity-pattern matches but needs records).
    const isGeneralKnowledge = classified.queryType === "GENERAL";

    if (isGeneralKnowledge) {
        result = await runDirect(options, [], strategy, /* generalMode */ true);
    } else {
        switch (strategy) {
            case "QUERY_PLAN":
                result = await runQueryPlan(options, classified);
                break;
            case "SPECULATIVE":
                result = await runSpeculative(options, classified);
                break;
            case "ITERATIVE_CORRECTIVE":
                result = await runIterativeCorrective(options, classified);
                break;
            case "DIRECT":
            default:
                result = await runDirectWithRetrieval(options, classified);
                break;
        }
    }

    // Record outcome for adaptive learning
    recordOutcome({
        strategy,
        queryType: classified.queryType,
        confidence: result.confidence,
        latencyMs: Date.now() - startTime,
        timestamp: Date.now(),
    });

    return result;
}

// --------------- Strategy Implementations ---------------

/** DIRECT: simple retrieve → generate */
async function runDirectWithRetrieval(
    options: RAGEngineOptions,
    classified: ReturnType<typeof classifyQuery>
): Promise<RAGEngineResult> {
    const topK = options.topK || topKForQueryType(classified.queryType);
    const contexts = await retrieve(options.patientId, options.queryText, { topK });

    console.info(`[RAG Engine] Retrieved ${contexts.length} contexts for patient=${options.patientId} (topK=${topK})`);
    if (contexts.length > 0) {
        console.info(`[RAG Engine] Top context: title="${contexts[0].title}" score=${contexts[0].score.toFixed(3)} date=${contexts[0].date}`);
    }

    return runDirect(options, contexts, "DIRECT");
}

/** Core generation: build prompt from contexts, call Kimi K2.5 */
async function runDirect(
    options: RAGEngineOptions,
    contexts: ScoredContext[],
    strategy: RAGStrategy,
    generalMode = false
): Promise<RAGEngineResult> {
    const classified = classifyQuery(options.queryText);
    const historyBlock = buildHistoryBlock(options.conversationHistory);

    // Choose the right system prompt:
    // 1. General mode (no patient data needed) → GENERAL_SYSTEM
    // 2. Patient-specific but NO contexts retrieved → NO_RECORDS_SYSTEM (prevents hallucination)
    // 3. Patient-specific WITH contexts → GENERATION_SYSTEM (cite sources)
    const isPatientSpecific = !generalMode;
    const hasContexts = contexts.length > 0;
    let systemPrompt: string;
    if (generalMode) {
        systemPrompt = GENERAL_SYSTEM;
    } else if (!hasContexts) {
        systemPrompt = NO_RECORDS_SYSTEM;
        console.warn(`[RAG Engine] No contexts found for patient-specific query: "${options.queryText.slice(0, 80)}" — using NO_RECORDS prompt to prevent hallucination`);
    } else {
        systemPrompt = GENERATION_SYSTEM;
    }

    const messages: Parameters<typeof complete>[0] = [
        { role: "system", content: systemPrompt },
    ];

    if (historyBlock) {
        messages.push({ role: "user", content: historyBlock });
    }

    messages.push({
        role: "user",
        content: hasContexts
            ? `Health records:\n${buildContextBlock(contexts)}\n\nQuestion: ${options.queryText}`
            : options.queryText,
    });

    // All queries go through Kimi K2.5 for consistent, high-quality reasoning.
    const llmCall = complete(messages, {
        temperature: generalMode ? 0.3 : 0.35,
        maxTokens: generalMode ? 600 : 1200,
    });

    const result = await llmCall;

    console.info(`[RAG Engine] Generation complete: model=${result.model} provider=${result.provider} contexts=${contexts.length} strategy=${strategy}`);

    return {
        answer: result.text,
        contexts,
        strategy,
        queryType: classified.queryType,
        confidence: hasContexts ? 0.72 : (generalMode ? 0.55 : 0.3),
        groundingScore: hasContexts ? 0.7 : 0.0,
        provider: result.provider,
        modelId: result.model,
    };
}

/** QUERY_PLAN: decompose → parallel retrieve → merge → generate */
async function runQueryPlan(
    options: RAGEngineOptions,
    classified: ReturnType<typeof classifyQuery>
): Promise<RAGEngineResult> {
    const queryPlan = await plan(classified);
    const subResults = await executeSubQueries(
        queryPlan,
        options.patientId,
        options.topK ? Math.ceil(options.topK / 2) : 6
    );
    const mergedContexts = mergeContexts(subResults, options.topK || 12);

    const result = await runDirect(options, mergedContexts, "QUERY_PLAN");

    return {
        ...result,
        strategy: "QUERY_PLAN",
        confidence: Math.min(0.9, result.confidence + 0.08),
    };
}

/** SPECULATIVE: retrieve first, then draft+verify in one pass */
async function runSpeculative(
    options: RAGEngineOptions,
    classified: ReturnType<typeof classifyQuery>
): Promise<RAGEngineResult> {
    const topK = options.topK || topKForQueryType(classified.queryType);

    // DynamoDB retrieval is sub-100ms — no point overlapping with an LLM draft call.
    // Retrieve first, then run a single speculateAndVerify (draft + verify = 2 LLM calls).
    const contexts = await retrieve(options.patientId, options.queryText, { topK });

    // If retrieval returned nothing, skip speculation entirely
    if (contexts.length === 0) {
        console.warn(`[RAG Engine] Speculative: no contexts retrieved — using NO_RECORDS path`);
        return runDirect(options, [], "SPECULATIVE");
    }

    // Single speculateAndVerify call: draft (1 LLM) + verify against contexts (1 LLM)
    const verified = await speculateAndVerify(
        options.queryText,
        contexts,
        options.conversationHistory
    );

    return {
        answer: verified.verified,
        contexts,
        strategy: "SPECULATIVE",
        queryType: classified.queryType,
        confidence: Math.min(0.88, 0.6 + verified.groundingScore * 0.3),
        groundingScore: verified.groundingScore,
        provider: "kimi",
        modelId: process.env.KIMI_BEDROCK_MODEL || "moonshotai.kimi-k2.5",
    };
}

/** ITERATIVE_CORRECTIVE: retrieve → generate → correct → reflect */
async function runIterativeCorrective(
    options: RAGEngineOptions,
    classified: ReturnType<typeof classifyQuery>
): Promise<RAGEngineResult> {
    const topK = options.topK || topKForQueryType(classified.queryType);
    let contexts = await retrieve(options.patientId, options.queryText, { topK });

    // Initial generation
    const initial = await runDirect(options, contexts, "ITERATIVE_CORRECTIVE");
    let answer = initial.answer;
    let provider = initial.provider;

    // Re-retrieve helper for correction/reflection loops
    const reRetrieve = async (refinedQuery: string): Promise<ScoredContext[]> => {
        return retrieveRefined(options.patientId, contexts, refinedQuery, topK);
    };

    // Corrective loop
    const corrected = await correctiveLoop(options.queryText, answer, contexts, reRetrieve);
    answer = corrected.answer;
    const groundingScore = corrected.groundingScore;

    // Reflective loop (only if corrective changed something or grounding was low)
    const reflected = await reflectiveLoop(options.queryText, answer, contexts, reRetrieve);
    answer = reflected.answer;
    const confidence = reflected.confidence;

    return {
        answer,
        contexts,
        strategy: "ITERATIVE_CORRECTIVE",
        queryType: classified.queryType,
        confidence: Math.min(0.95, confidence + 0.05),
        groundingScore,
        provider,
        modelId: initial.modelId,
    };
}

// --------------- Helpers ---------------

function buildContextBlock(contexts: ScoredContext[]): string {
    if (contexts.length === 0) return "(No relevant records found)";
    return contexts
        .slice(0, 12)
        .map((c, i) => `[Source ${i + 1}] ${c.title} (${c.date || "date unknown"})\n${c.content.slice(0, 400)}`)
        .join("\n\n---\n\n");
}

function buildHistoryBlock(
    history: Array<{ role: "user" | "assistant"; content: string }> | undefined
): string {
    if (!history || history.length === 0) return "";
    return "Previous conversation:\n" +
        history
            .slice(-6)
            .map((m) => `${m.role === "user" ? "Patient" : "Assistant"}: ${m.content.slice(0, 200)}`)
            .join("\n");
}
