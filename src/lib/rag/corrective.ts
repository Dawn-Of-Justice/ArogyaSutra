// ============================================================
// Agentic RAG — Corrective RAG (CRAG)
// Verifies whether the generated answer is grounded in the
// retrieved contexts. If not, re-retrieves and regenerates.
// ============================================================

import { complete, completeJSON } from "../llm/kimi";
import type { ScoredContext, GroundingResult, CorrectionResult, GroundingVerdict } from "./types";

const MAX_CORRECTION_ITERATIONS = 2;

// --------------- Prompts ---------------

const GROUNDING_SYSTEM = `You are a medical fact-checker for an AI health assistant.
Given an answer and the source contexts it should be based on, verify grounding.
Respond with JSON only:
{
  "verdict": "GROUNDED" | "UNGROUNDED" | "PARTIAL",
  "score": 0.0-1.0,
  "unsupportedClaims": ["claim 1", ...],
  "refinedQuery": "better retrieval query if needed, else null"
}
Be strict: any clinical claim not traceable to a context is unsupported.`;

const CORRECTION_SYSTEM = `You are a medical AI assistant. Generate a corrected answer 
strictly using ONLY the provided health record contexts. 
Do NOT include information not present in the contexts.
Cite sources as [Source N] where N is the context number.`;

// --------------- Public API ---------------

/**
 * Check if the answer is grounded in the provided contexts.
 */
export async function checkGrounding(
    answer: string,
    query: string,
    contexts: ScoredContext[]
): Promise<GroundingResult> {
    if (contexts.length === 0) {
        return { verdict: "UNGROUNDED", score: 0, unsupportedClaims: [answer.slice(0, 80)], refinedQuery: query };
    }

    const contextSummary = contexts
        .slice(0, 8)
        .map((c, i) => `[Source ${i + 1}] ${c.title} (${c.date}): ${c.content.slice(0, 200)}`)
        .join("\n\n");

    const result = await completeJSON<{
        verdict: GroundingVerdict;
        score: number;
        unsupportedClaims: string[];
        refinedQuery: string | null;
    }>(
        [
            { role: "system", content: GROUNDING_SYSTEM },
            {
                role: "user",
                content: `Query: ${query}\n\nAnswer to verify:\n${answer}\n\nContexts:\n${contextSummary}`,
            },
        ],
        { temperature: 0.1, maxTokens: 512 }
    );

    if (!result.data) {
        // If LLM failed to parse, assume partial grounding
        return { verdict: "PARTIAL", score: 0.5, unsupportedClaims: [], refinedQuery: undefined };
    }

    return {
        verdict: result.data.verdict,
        score: result.data.score ?? 0.5,
        unsupportedClaims: result.data.unsupportedClaims ?? [],
        refinedQuery: result.data.refinedQuery ?? undefined,
    };
}

/**
 * Generate a corrected answer strictly grounded in contexts.
 */
export async function generateCorrected(
    query: string,
    contexts: ScoredContext[]
): Promise<{ answer: string; provider: "kimi" | "bedrock" }> {
    const contextBlock = buildContextBlock(contexts);

    const result = await complete(
        [
            { role: "system", content: CORRECTION_SYSTEM },
            {
                role: "user",
                content: `Health records:\n${contextBlock}\n\nPatient query: ${query}\n\nPlease answer using only the above records.`,
            },
        ],
        { temperature: 0.3, maxTokens: 1024 }
    );

    return { answer: result.text, provider: result.provider };
}

/**
 * Full corrective loop: generate → check → correct if needed.
 */
export async function correctiveLoop(
    query: string,
    initialAnswer: string,
    contexts: ScoredContext[],
    reRetrieve: (refinedQuery: string) => Promise<ScoredContext[]>
): Promise<CorrectionResult> {
    let answer = initialAnswer;
    let currentContexts = contexts;
    let groundingScore = 1.0;
    let iterations = 0;

    for (let i = 0; i < MAX_CORRECTION_ITERATIONS; i++) {
        const grounding = await checkGrounding(answer, query, currentContexts);
        groundingScore = grounding.score;

        if (grounding.verdict === "GROUNDED" || grounding.score >= 0.75) break;

        iterations++;

        // Re-retrieve with refined query if suggested
        if (grounding.refinedQuery) {
            const freshContexts = await reRetrieve(grounding.refinedQuery);
            if (freshContexts.length > 0) {
                currentContexts = freshContexts;
            }
        }

        const corrected = await generateCorrected(query, currentContexts);
        answer = corrected.answer;
    }

    return { answer, groundingScore, iterations };
}

// --------------- Helpers ---------------

function buildContextBlock(contexts: ScoredContext[]): string {
    return contexts
        .slice(0, 10)
        .map((c, i) => `[Source ${i + 1}] ${c.title} (${c.date})\n${c.content.slice(0, 400)}`)
        .join("\n\n---\n\n");
}
