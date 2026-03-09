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
import type { LLMImageAttachment, LLMMessage } from "../llm/kimi";
import { retrieve, retrieveRefined } from "./retriever";
import { classifyQuery, topKForQueryType } from "./router";
import { plan, executeSubQueries, mergeContexts } from "./planner";
import { correctiveLoop } from "./corrective";
import { reflectiveLoop } from "./reflective";
import { selectStrategy, recordOutcome } from "./adaptive";
import { speculateAndVerify } from "./speculative";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import type {
    RAGEngineOptions,
    RAGEngineResult,
    RAGStrategy,
    ScoredContext,
} from "./types";
import { getPrompts } from "./prompts";

// ── Production: in-flight dedup + LRU response cache + hard timeout ───────
// In-flight map: concurrent identical (patientId, query) requests share one Promise
const _inflight = new Map<string, Promise<RAGEngineResult>>();
// LRU response cache: avoids full round-trips within a session (90 s TTL, 500 entries)
const _responseCache = new Map<string, { result: RAGEngineResult; ts: number }>();
const RESPONSE_CACHE_TTL_MS = 90_000;
const RESPONSE_CACHE_MAX    = 500;
// Hard deadline — leave ~25 s buffer before Next.js/Lambda's 60 s maxDuration
const PIPELINE_TIMEOUT_MS   = 35_000;

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

// ── S3 Image Fetching for multimodal RAG ──────────────────────────────
const _s3Creds =
    process.env.APP_AWS_ACCESS_KEY_ID && process.env.APP_AWS_SECRET_ACCESS_KEY
        ? { credentials: { accessKeyId: process.env.APP_AWS_ACCESS_KEY_ID, secretAccessKey: process.env.APP_AWS_SECRET_ACCESS_KEY } }
        : {};
const _s3Region = process.env.NEXT_PUBLIC_AWS_REGION || "ap-south-1";
const _s3Bucket = process.env.NEXT_PUBLIC_S3_BUCKET || "";
const _s3Client = new S3Client({ region: _s3Region, ..._s3Creds });

/** Maximum number of images to include per RAG query (avoid token/size limits) */
const MAX_RAG_IMAGES = 3;
/** Maximum image size in bytes (5 MB — Bedrock typical limit) */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Extracts the image format from an S3 key extension.
 * Returns null if the key does not look like a supported image.
 */
function _imageFormatFromKey(key: string): LLMImageAttachment["format"] | null {
    const ext = key.split(".").pop()?.toLowerCase();
    if (ext === "jpg" || ext === "jpeg") return "jpeg";
    if (ext === "png") return "png";
    if (ext === "webp") return "webp";
    return null;
}

/**
 * Fetches a single image from S3 and returns an LLMImageAttachment.
 * Returns null if the key isn't an image, the file is too large, or the fetch fails.
 */
async function _fetchImageFromS3(s3Key: string): Promise<LLMImageAttachment | null> {
    const format = _imageFormatFromKey(s3Key);
    if (!format) return null;
    if (!_s3Bucket) return null;

    try {
        const res = await _s3Client.send(new GetObjectCommand({ Bucket: _s3Bucket, Key: s3Key }));
        // Check size before downloading body
        if (res.ContentLength && res.ContentLength > MAX_IMAGE_BYTES) {
            console.warn(`[RAG Engine] Image too large (${(res.ContentLength / 1024 / 1024).toFixed(1)} MB): ${s3Key}`);
            return null;
        }
        const bytes = await res.Body?.transformToByteArray();
        if (!bytes || bytes.length === 0) return null;
        if (bytes.length > MAX_IMAGE_BYTES) return null;
        return { bytes, format };
    } catch (err) {
        console.warn(`[RAG Engine] Failed to fetch image: ${s3Key}`, (err as Error).message);
        return null;
    }
}

/**
 * Fetches images for the top scored contexts that have an s3Key.
 * Returns a map from entryId → LLMImageAttachment (at most MAX_RAG_IMAGES).
 * All fetches run in parallel with a tight timeout so they don't block the pipeline.
 */
async function fetchContextImages(
    contexts: ScoredContext[]
): Promise<Map<string, LLMImageAttachment>> {
    const candidates = contexts
        .filter((c) => c.s3Key && _imageFormatFromKey(c.s3Key))
        .slice(0, MAX_RAG_IMAGES);

    if (candidates.length === 0) return new Map();

    console.info(`[RAG Engine] Fetching ${candidates.length} image(s) from S3 for multimodal RAG`);

    // 3s hard timeout for ALL image fetches combined
    const results = await Promise.race([
        Promise.allSettled(candidates.map((c) => _fetchImageFromS3(c.s3Key!))),
        new Promise<PromiseSettledResult<LLMImageAttachment | null>[]>((resolve) =>
            setTimeout(() => resolve(candidates.map(() => ({ status: "rejected" as const, reason: "timeout" }))), 3000)
        ),
    ]);

    const imageMap = new Map<string, LLMImageAttachment>();
    for (let i = 0; i < candidates.length; i++) {
        const r = results[i];
        if (r.status === "fulfilled" && r.value) {
            imageMap.set(candidates[i].entryId, r.value);
        }
    }

    console.info(`[RAG Engine] Successfully fetched ${imageMap.size}/${candidates.length} image(s)`);
    return imageMap;
}

// ── Vision Model — describe images as text for the RAG context ────────
// Kimi K2.5 is used for vision — excellent at reading handwritten
// prescriptions and extracting medical details from document photos.
const _visionRegion = ["us-east-1", "us-west-2"].includes(_s3Region) ? _s3Region : "us-east-1";
const _visionClient = new BedrockRuntimeClient({ region: _visionRegion, ..._s3Creds });
const VISION_MODEL_ID = process.env.KIMI_BEDROCK_MODEL?.trim() || "moonshotai.kimi-k2.5";
// Fallback to Nova Pro if Kimi is unavailable
const FALLBACK_VISION_MODEL_ID = process.env.BEDROCK_MODEL_ID?.trim() || "us.amazon.nova-pro-v1:0";

/**
 * Uses Kimi K2.5 (vision-capable) to describe medical content of document images.
 * Falls back to Nova Pro if Kimi is unavailable.
 * Returns a text description suitable for inclusion in the RAG context block.
 */
async function describeImagesWithVision(
    images: Array<{ bytes: Uint8Array; format: LLMImageAttachment["format"]; title: string }>
): Promise<string> {
    if (images.length === 0) return "";

    const contentBlocks = [
        ...images.map((img) => ({
            image: {
                format: img.format,
                source: { bytes: img.bytes },
            },
        })),
        {
            text: `You are an expert Indian medical document reader. Read and describe the medical content visible in ${images.length > 1 ? "these" : "this"} document image${images.length > 1 ? "s" : ""}.

IMPORTANT for handwritten prescriptions:
- Indian doctors write in cursive English or mixed Hindi-English. Read every word carefully.
- Abbreviations: OD=once daily, BD=twice daily, TDS=three times/day, QID=four times/day, SOS=as needed, HS=bedtime, AC=before food, PC=after food. Tab=tablet, Cap=capsule, Inj=injection, Syr=syrup.
- Look for the Rx symbol (℞) marking prescriptions.
- Extract ALL medications with doses, frequencies, and durations.

For each image extract ALL visible data: document type, medication names (with dosages and frequency), test results (values, units, reference ranges), diagnoses, vital signs, doctor/hospital names, dates, and handwritten notes.
For medical scans (X-rays, MRI, CT, etc.), describe findings in clinical terms.
Be thorough — include every number and value visible. Output plain text, no JSON.`,
        },
    ];

    // Try Kimi K2.5 first, fall back to Nova Pro
    for (const modelId of [VISION_MODEL_ID, FALLBACK_VISION_MODEL_ID]) {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 15_000);

            const response = await _visionClient
                .send(
                    new ConverseCommand({
                        modelId,
                        messages: [{ role: "user" as const, content: contentBlocks }],
                        inferenceConfig: { maxTokens: 1024, temperature: 0.1 },
                    }),
                    { abortSignal: controller.signal }
                )
                .finally(() => clearTimeout(timer));

            const result = (
                response.output?.message?.content
                    ?.map((b) => ("text" in b ? b.text ?? "" : ""))
                    .join("") ?? ""
            ).trim();

            if (result) {
                console.info(`[RAG Engine] Vision (${modelId}) succeeded`);
                return result;
            }
        } catch (err) {
            console.warn(`[RAG Engine] Vision ${modelId} failed:`, (err as Error).message);
            // Continue to fallback model
        }
    }

    return "";
}

// --------------- Generation Prompts ---------------
// Role-based prompts are maintained in prompts.ts for easy editing.
// getPrompts(role) returns { generation, noRecords, general } per role.
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

    // Choose the right system prompt based on role (DOCTOR vs PATIENT) and context:
    // 1. General mode (no patient data needed) → general prompt
    // 2. Patient-specific but NO contexts retrieved → noRecords prompt (prevents hallucination)
    // 3. Patient-specific WITH contexts → generation prompt (cite sources)
    const prompts = getPrompts(options.userRole);
    const hasContexts = contexts.length > 0;
    let systemPrompt: string;
    if (generalMode) {
        systemPrompt = prompts.general;
    } else if (!hasContexts) {
        systemPrompt = prompts.noRecords;
        console.warn(`[RAG Engine] No contexts found for patient-specific query: "${options.queryText.slice(0, 80)}" — using noRecords prompt (role=${options.userRole || "PATIENT"}) to prevent hallucination`);
    } else {
        systemPrompt = prompts.generation;
    }

    // Fetch images from S3 and describe them with a vision model (Nova Pro).
    // Kimi K2.5 doesn't support vision, so we convert images → text with Nova Pro first.
    let imageDescription = "";
    let imageCount = 0;
    if (hasContexts) {
        try {
            const imageMap = await fetchContextImages(contexts);
            if (imageMap.size > 0) {
                const imagesWithTitles: Array<{ bytes: Uint8Array; format: LLMImageAttachment["format"]; title: string }> = [];
                for (const ctx of contexts.slice(0, 12)) {
                    const img = imageMap.get(ctx.entryId);
                    if (img) imagesWithTitles.push({ ...img, title: ctx.title });
                }
                imageCount = imagesWithTitles.length;
                if (imagesWithTitles.length > 0) {
                    imageDescription = await describeImagesWithVision(imagesWithTitles);
                    if (imageDescription) {
                        console.info(`[RAG Engine] Vision described ${imagesWithTitles.length} image(s), output=${imageDescription.length} chars`);
                    }
                }
            }
        } catch (err) {
            console.warn("[RAG Engine] Image processing failed, continuing text-only:", (err as Error).message);
        }
    }

    const messages: LLMMessage[] = [
        { role: "system", content: systemPrompt },
    ];

    if (historyBlock) {
        messages.push({ role: "user", content: historyBlock });
    }

    if (imageDescription) {
        messages[0].content += "\n- Some health records include AI-analyzed document images. Use the [Image Analysis] section for additional medical data that may not appear in the text summaries.";
    }

    // Build user message: text context + optional vision-extracted image analysis
    const contextBlock = hasContexts ? buildContextBlock(contexts) : "";
    const imageBlock = imageDescription
        ? `\n\n---\n\n[Image Analysis — extracted from document photos by AI vision]\n${imageDescription}`
        : "";

    messages.push({
        role: "user",
        content: hasContexts
            ? `Health records:\n${contextBlock}${imageBlock}\n\nQuestion: ${options.queryText}`
            : options.queryText,
    });

    // All queries go through Kimi K2.5 for consistent, high-quality reasoning.
    const result = await complete(messages, {
        temperature: generalMode ? 0.3 : 0.35,
        maxTokens: generalMode ? 600 : 1200,
    });

    console.info(`[RAG Engine] Generation complete: model=${result.model} provider=${result.provider} contexts=${contexts.length} images=${imageCount} strategy=${strategy}`);

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
