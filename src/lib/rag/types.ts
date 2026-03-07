// ============================================================
// Agentic RAG — Internal Types
// ============================================================

import type { RAGContext } from "../aws/bedrock";

export type { RAGContext };

// --------------- Query Classification ---------------

export type QueryType =
    | "SIMPLE_FACTUAL"   // Single fact: "What is my blood type?"
    | "TEMPORAL_TREND"   // Trend over time: "How has my BP changed?"
    | "MULTI_HOP"        // Requires chaining: "How do my meds relate to my labs?"
    | "COMPARATIVE"      // Compare values: "Is my latest HbA1c better or worse?"
    | "SUMMARIZATION"    // Summarize records: "Summarize my last 3 visits"
    | "GENERAL";         // No HealthLake data needed: "What is diabetes?"

export interface ClassifiedQuery {
    original: string;
    queryType: QueryType;
    /** Normalised version stripped of filler words */
    normalized: string;
    /** Extracted medical entities (keywords) for retrieval */
    entities: string[];
    /** Estimated complexity 1–5 */
    complexity: number;
}

// --------------- Retrieval ---------------

export interface ScoredContext extends RAGContext {
    /** Combined retrieval score 0–1 */
    score: number;
    /** BM25-style keyword overlap score 0–1 */
    keywordScore: number;
    /** Recency score 0–1 (more recent → higher) */
    recencyScore: number;
}

export interface RetrievalOptions {
    /** Maximum contexts to return */
    topK: number;
    /** Minimum score threshold */
    minScore: number;
    /** Boost recency in ranking */
    recencyWeight: number;
    /** Filter by specific doc types */
    docTypeFilter?: string[];
}

// --------------- Query Planning ---------------

export interface SubQuery {
    id: string;
    text: string;
    purpose: string;
    /** Which retrieval context types to target */
    targetDocTypes?: string[];
}

export interface PlannerResult {
    subQueries: SubQuery[];
    /** Whether sub-queries should be run in parallel */
    parallel: boolean;
    /** Strategy chosen for this plan */
    strategy: "direct" | "decomposed" | "iterative";
}

export interface SubQueryResult {
    subQuery: SubQuery;
    contexts: ScoredContext[];
    partialAnswer: string;
}

// --------------- Corrective RAG ---------------

export type GroundingVerdict = "GROUNDED" | "UNGROUNDED" | "PARTIAL";

export interface GroundingResult {
    verdict: GroundingVerdict;
    /** 0–1 — fraction of claims that are supported */
    score: number;
    /** Specific claims that are unsupported */
    unsupportedClaims: string[];
    /** Corrected query for re-retrieval */
    refinedQuery?: string;
}

export interface CorrectionResult {
    answer: string;
    groundingScore: number;
    iterations: number;
}

// --------------- Self-Reflective RAG ---------------

export type ReflectionVerdict = "GOOD" | "INCOMPLETE" | "INACCURATE" | "IRRELEVANT";

export interface ReflectionResult {
    verdict: ReflectionVerdict;
    /** 0–1 confidence in the current answer */
    confidence: number;
    /** What is missing or wrong */
    gaps: string[];
    /** Suggested follow-up retrieval query */
    refinementQuery?: string;
}

export interface RefinedAnswer {
    answer: string;
    confidence: number;
    reflectionIterations: number;
}

// --------------- Adaptive RAG ---------------

export type RAGStrategy =
    | "DIRECT"              // Simple: retrieve → generate
    | "QUERY_PLAN"          // Complex: plan → retrieve sub-queries → merge
    | "SPECULATIVE"         // Fast: speculate → verify → refine
    | "ITERATIVE_CORRECTIVE"; // Slow: multiple correction loops

export interface StrategyOutcome {
    strategy: RAGStrategy;
    queryType: QueryType;
    confidence: number;
    latencyMs: number;
    timestamp: number;
}

// --------------- Speculative RAG ---------------

export interface SpeculativeResult {
    draft: string;
    verified: string;
    /** Whether the draft was accepted without major changes */
    draftAccepted: boolean;
    groundingScore: number;
}

// --------------- Engine ---------------

export interface RAGEngineOptions {
    patientId: string;
    queryText: string;
    conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
    /** Override strategy selection */
    forceStrategy?: RAGStrategy;
    /** Max retrieval contexts */
    topK?: number;
    /** Who is querying — controls prompt tone (clinical vs plain language) */
    userRole?: "PATIENT" | "DOCTOR";
}

export interface RAGEngineResult {
    answer: string;
    contexts: ScoredContext[];
    strategy: RAGStrategy;
    queryType: QueryType;
    confidence: number;
    groundingScore: number;
    provider: "kimi" | "bedrock";
    modelId: string;
}
