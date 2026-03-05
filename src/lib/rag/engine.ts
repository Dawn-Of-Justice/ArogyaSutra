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

import { complete, completeFast } from "../llm/kimi";
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

    console.info(`[RAG Engine] query="${options.queryText.slice(0, 60)}" type=${classified.queryType} strategy=${strategy}`);

    let result: RAGEngineResult;

    // Fast path: no patient-specific entities detected, or explicit GENERAL type
    // → skip HealthLake retrieval entirely and answer directly
    const isGeneralKnowledge =
        classified.queryType === "GENERAL" ||
        (classified.queryType === "SIMPLE_FACTUAL" && classified.entities.length === 0);

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

    return runDirect(options, contexts, "DIRECT");
}

/** Core generation: build prompt from contexts, call Kimi (or Nova Micro for light queries) */
async function runDirect(
    options: RAGEngineOptions,
    contexts: ScoredContext[],
    strategy: RAGStrategy,
    generalMode = false
): Promise<RAGEngineResult> {
    const classified = classifyQuery(options.queryText);
    const historyBlock = buildHistoryBlock(options.conversationHistory);

    const messages: Parameters<typeof complete>[0] = [
        { role: "system", content: generalMode ? GENERAL_SYSTEM : GENERATION_SYSTEM },
    ];

    if (historyBlock) {
        messages.push({ role: "user", content: historyBlock });
    }

    messages.push({
        role: "user",
        content: contexts.length > 0
            ? `Health records:\n${buildContextBlock(contexts)}\n\nQuestion: ${options.queryText}`
            : options.queryText,
    });

    // General knowledge + simple factual with no records → Nova Micro (22× cheaper, faster).
    // All patient-specific contexts → Kimi K2.5 for richer reasoning.
    const isLightQuery = generalMode || (classified.queryType === "SIMPLE_FACTUAL" && contexts.length === 0);
    const llmCall = isLightQuery
        ? completeFast(messages, { temperature: 0.3, maxTokens: 400 })
        : complete(messages, { temperature: 0.35, maxTokens: 1200 });

    const result = await llmCall;

    return {
        answer: result.text,
        contexts,
        strategy,
        queryType: classified.queryType,
        confidence: contexts.length > 0 ? 0.72 : 0.55,
        groundingScore: 0.7,
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

/** SPECULATIVE: draft + retrieve concurrently, then verify once */
async function runSpeculative(
    options: RAGEngineOptions,
    classified: ReturnType<typeof classifyQuery>
): Promise<RAGEngineResult> {
    const topK = options.topK || topKForQueryType(classified.queryType);

    // Draft generation and HealthLake retrieval run concurrently
    const [contexts, specResult] = await Promise.all([
        retrieve(options.patientId, options.queryText, { topK }),
        speculateAndVerify(options.queryText, [], options.conversationHistory),
    ]);

    // Verify the draft against the now-available contexts (single verify pass)
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
        provider: specResult.draftAccepted ? "kimi" : "kimi",
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
