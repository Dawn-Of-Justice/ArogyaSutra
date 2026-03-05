// ============================================================
// Agentic RAG — Adaptive Strategy Selector
// Learns from prior query outcomes (in-memory per process)
// and adapts the RAG strategy for future queries.
// ============================================================

import type { RAGStrategy, QueryType, StrategyOutcome } from "./types";

// --------------- In-Memory Outcome Store ---------------

/** Store per (queryType + strategy) → quality metrics */
const outcomes = new Map<string, { totalConf: number; count: number; avgLatencyMs: number }>();

// --------------- Default Strategy Matrix ---------------

// Initial strategy preferences before any learning has occurred
const DEFAULT_STRATEGY: Record<QueryType, RAGStrategy> = {
    SIMPLE_FACTUAL:   "DIRECT",
    TEMPORAL_TREND:   "QUERY_PLAN",
    MULTI_HOP:        "ITERATIVE_CORRECTIVE",
    COMPARATIVE:      "QUERY_PLAN",
    SUMMARIZATION:    "DIRECT",
    GENERAL:          "DIRECT",
};

// --------------- Public API ---------------

/**
 * Select the best RAG strategy for the given query type,
 * informed by historical performance metrics.
 */
export function selectStrategy(
    queryType: QueryType,
    complexity: number,
    hasHistory: boolean
): RAGStrategy {
    const candidate = DEFAULT_STRATEGY[queryType];

    // Check if adaptive learning suggests a better option
    const strategies: RAGStrategy[] = ["DIRECT", "QUERY_PLAN", "SPECULATIVE", "ITERATIVE_CORRECTIVE"];
    let bestStrategy = candidate;
    let bestScore = strategyScore(queryType, candidate);

    for (const s of strategies) {
        const score = strategyScore(queryType, s);
        if (score > bestScore * 1.1) {
            // Only switch if significantly better (10% threshold to reduce churn)
            bestStrategy = s;
            bestScore = score;
        }
    }

    // Override for very complex queries: always use iterative corrective
    if (complexity >= 5) return "ITERATIVE_CORRECTIVE";

    // SPECULATIVE involves two LLM calls — only use it for queries that genuinely
    // benefit from the draft+verify pattern (trend/comparative, not simple factual)
    if (hasHistory && ["TEMPORAL_TREND", "COMPARATIVE"].includes(queryType) && bestStrategy !== "ITERATIVE_CORRECTIVE") {
        return "SPECULATIVE";
    }

    return bestStrategy;
}

// Batch buffer — flush to outcomes Map at most once every 500 ms
// so hot-path ragQuery() never blocks on Map writes under high concurrency.
const _pendingOutcomes: StrategyOutcome[] = [];
let _flushTimer: ReturnType<typeof setTimeout> | null = null;

function _flush(): void {
    _flushTimer = null;
    const batch = _pendingOutcomes.splice(0);
    for (const outcome of batch) {
        const key = `${outcome.queryType}:${outcome.strategy}`;
        const existing = outcomes.get(key) || { totalConf: 0, count: 0, avgLatencyMs: 0 };
        const count = existing.count + 1;
        outcomes.set(key, {
            totalConf: existing.totalConf + outcome.confidence,
            count,
            avgLatencyMs: (existing.avgLatencyMs * existing.count + outcome.latencyMs) / count,
        });
    }
}

/**
 * Record the outcome of a RAG run to improve future strategy selection.
 * Writes are batched and flushed asynchronously to keep the hot path non-blocking.
 */
export function recordOutcome(outcome: StrategyOutcome): void {
    _pendingOutcomes.push(outcome);
    if (!_flushTimer) _flushTimer = setTimeout(_flush, 500);
}

/**
 * Returns recorded statistics for debugging / admin dashboards.
 */
export function getStats(): Record<string, { avgConfidence: number; count: number; avgLatencyMs: number }> {
    const stats: Record<string, { avgConfidence: number; count: number; avgLatencyMs: number }> = {};
    for (const [key, v] of outcomes.entries()) {
        stats[key] = {
            avgConfidence: v.count > 0 ? v.totalConf / v.count : 0,
            count: v.count,
            avgLatencyMs: v.avgLatencyMs,
        };
    }
    return stats;
}

// --------------- Helpers ---------------

/**
 * Compute a score for a (queryType, strategy) pair using historical data.
 * Falls back to a heuristic if no history available.
 */
function strategyScore(queryType: QueryType, strategy: RAGStrategy): number {
    const key = `${queryType}:${strategy}`;
    const data = outcomes.get(key);

    if (data && data.count >= 3) {
        const avgConf = data.totalConf / data.count;
        // Penalise high-latency strategies slightly
        const latencyPenalty = Math.min(0.2, data.avgLatencyMs / 50_000);
        return avgConf - latencyPenalty;
    }

    // Heuristic defaults
    return HEURISTIC_SCORES[queryType]?.[strategy] ?? 0.5;
}

const HEURISTIC_SCORES: Record<QueryType, Partial<Record<RAGStrategy, number>>> = {
    SIMPLE_FACTUAL:   { DIRECT: 0.8, SPECULATIVE: 0.75, QUERY_PLAN: 0.5, ITERATIVE_CORRECTIVE: 0.4 },
    TEMPORAL_TREND:   { QUERY_PLAN: 0.85, ITERATIVE_CORRECTIVE: 0.7, DIRECT: 0.5, SPECULATIVE: 0.45 },
    MULTI_HOP:        { ITERATIVE_CORRECTIVE: 0.85, QUERY_PLAN: 0.8, DIRECT: 0.4, SPECULATIVE: 0.35 },
    COMPARATIVE:      { QUERY_PLAN: 0.8, ITERATIVE_CORRECTIVE: 0.72, DIRECT: 0.55, SPECULATIVE: 0.5 },
    SUMMARIZATION:    { DIRECT: 0.7, QUERY_PLAN: 0.65, SPECULATIVE: 0.55, ITERATIVE_CORRECTIVE: 0.5 },
    GENERAL:          { DIRECT: 0.9, SPECULATIVE: 0.8, QUERY_PLAN: 0.5, ITERATIVE_CORRECTIVE: 0.4 },
};
