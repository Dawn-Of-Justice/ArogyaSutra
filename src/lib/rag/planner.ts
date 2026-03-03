// ============================================================
// Agentic RAG — Query Planner
// Decomposes complex queries into sub-queries that can be
// retrieved and answered in parallel, then merged.
// ============================================================

import { complete } from "../llm/kimi";
import { retrieve } from "./retriever";
import type {
    ClassifiedQuery,
    PlannerResult,
    SubQuery,
    SubQueryResult,
    ScoredContext,
} from "./types";
import { v4 as uuidv4 } from "uuid";

// --------------- Prompts ---------------

const DECOMPOSE_SYSTEM = `You are a medical query decomposition expert.
Break the user's health query into 2-4 focused sub-queries that together fully answer it.
Respond with JSON only, format:
{
  "subQueries": [
    { "text": "<sub-query>", "purpose": "<what this sub-query answers>", "targetDocTypes": ["Observation","Condition"] }
  ],
  "parallel": true
}
Valid targetDocTypes: Observation, Condition, MedicationRequest, Procedure, DiagnosticReport, Encounter, AllergyIntolerance.
Keep sub-queries concise and medically focused.`;

// --------------- Public API ---------------

/**
 * Build a query plan for complex / multi-hop queries.
 * Falls back to a trivial single-query plan for simple ones.
 */
export async function plan(classified: ClassifiedQuery): Promise<PlannerResult> {
    // Simple queries don't need decomposition
    if (classified.complexity <= 2 || classified.queryType === "SIMPLE_FACTUAL") {
        return directPlan(classified.original);
    }

    try {
        return await llmDecompose(classified);
    } catch {
        return directPlan(classified.original);
    }
}

/**
 * Execute a query plan: retrieve contexts for all sub-queries (in parallel if flagged).
 */
export async function executeSubQueries(
    planResult: PlannerResult,
    patientId: string,
    topKPerQuery = 6
): Promise<SubQueryResult[]> {
    if (planResult.strategy === "direct") {
        const sq = planResult.subQueries[0];
        const contexts = await retrieve(patientId, sq.text, {
            topK: topKPerQuery * 2,
            docTypeFilter: sq.targetDocTypes,
        });
        return [{ subQuery: sq, contexts, partialAnswer: "" }];
    }

    if (planResult.parallel) {
        // All sub-queries executed concurrently
        const results = await Promise.all(
            planResult.subQueries.map(async (sq) => {
                const contexts = await retrieve(patientId, sq.text, {
                    topK: topKPerQuery,
                    docTypeFilter: sq.targetDocTypes,
                });
                return { subQuery: sq, contexts, partialAnswer: "" };
            })
        );
        return results;
    }

    // Sequential (iterative planning — each result informs the next)
    const results: SubQueryResult[] = [];
    for (const sq of planResult.subQueries) {
        const contexts = await retrieve(patientId, sq.text, {
            topK: topKPerQuery,
            docTypeFilter: sq.targetDocTypes,
        });
        results.push({ subQuery: sq, contexts, partialAnswer: "" });
    }
    return results;
}

/**
 * Merge sub-query context sets into a single deduplicated list.
 */
export function mergeContexts(subResults: SubQueryResult[], totalTopK = 12): ScoredContext[] {
    const seen = new Set<string>();
    const merged: ScoredContext[] = [];

    for (const sr of subResults) {
        for (const ctx of sr.contexts) {
            if (!seen.has(ctx.entryId)) {
                seen.add(ctx.entryId);
                merged.push(ctx);
            }
        }
    }

    // Re-sort by score descending and cap
    return merged.sort((a, b) => b.score - a.score).slice(0, totalTopK);
}

// --------------- Helpers ---------------

function directPlan(queryText: string): PlannerResult {
    return {
        subQueries: [
            {
                id: uuidv4(),
                text: queryText,
                purpose: "direct answer",
                targetDocTypes: undefined,
            },
        ],
        parallel: false,
        strategy: "direct",
    };
}

async function llmDecompose(classified: ClassifiedQuery): Promise<PlannerResult> {
    const result = await complete(
        [
            { role: "system", content: DECOMPOSE_SYSTEM },
            {
                role: "user",
                content: `Decompose this health query: "${classified.original}"\nDetected type: ${classified.queryType}`,
            },
        ],
        { jsonMode: true, temperature: 0.2, maxTokens: 512 }
    );

    const json = safeParseJSON<{ subQueries: Array<{ text: string; purpose: string; targetDocTypes?: string[] }>; parallel: boolean }>(
        result.text
    );

    if (!json || !Array.isArray(json.subQueries) || json.subQueries.length === 0) {
        return directPlan(classified.original);
    }

    return {
        subQueries: json.subQueries.slice(0, 4).map((sq) => ({
            id: uuidv4(),
            text: sq.text,
            purpose: sq.purpose,
            targetDocTypes: sq.targetDocTypes,
        })),
        parallel: json.parallel ?? true,
        strategy: "decomposed",
    };
}

function safeParseJSON<T>(text: string): T | null {
    try {
        const cleaned = text
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/```\s*$/i, "")
            .trim();
        return JSON.parse(cleaned) as T;
    } catch {
        return null;
    }
}
