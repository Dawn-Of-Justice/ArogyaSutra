// ============================================================
// Agentic RAG — Self-Reflective RAG
// Evaluates the quality of the generated answer and refines
// it when completeness or accuracy is insufficient.
// ============================================================

import { complete, completeJSON } from "../llm/kimi";
import type { ScoredContext, ReflectionResult, ReflectionVerdict, RefinedAnswer } from "./types";

const MAX_REFLECTION_ITERATIONS = 2;
const CONFIDENCE_THRESHOLD = 0.70;

// --------------- Prompts ---------------

const REFLECTION_SYSTEM = `You are a medical AI quality auditor reviewing an answer about a patient's health.
Evaluate the answer for completeness, accuracy, and relevance to the query.
Respond with JSON only:
{
  "verdict": "GOOD" | "INCOMPLETE" | "INACCURATE" | "IRRELEVANT",
  "confidence": 0.0-1.0,
  "gaps": ["missing info 1", ...],
  "refinementQuery": "query to retrieve missing info, or null if none needed"
}
Be concise. Focus on whether the answer satisfactorily addresses the patient's health question.`;

const REFINEMENT_SYSTEM = `You are a medical AI assistant refining a health answer.
Using the original answer as a base and the additional context provided, produce an improved answer.
Preserve accurate information from the original. Fill in gaps. Remove inaccuracies.
Cite sources as [Source N]. Keep the response patient-friendly.`;

// --------------- Public API ---------------

/**
 * Self-evaluate the generated answer against the query and contexts.
 */
export async function reflect(
    query: string,
    answer: string,
    contexts: ScoredContext[]
): Promise<ReflectionResult> {
    const contextTitles = contexts.slice(0, 8).map((c) => c.title).join(", ");

    const result = await completeJSON<{
        verdict: ReflectionVerdict;
        confidence: number;
        gaps: string[];
        refinementQuery: string | null;
    }>(
        [
            { role: "system", content: REFLECTION_SYSTEM },
            {
                role: "user",
                content: [
                    `Patient query: ${query}`,
                    `Available contexts: ${contextTitles}`,
                    `Generated answer:\n${answer}`,
                ].join("\n\n"),
            },
        ],
        { temperature: 0.1, maxTokens: 512 }
    );

    if (!result.data) {
        return { verdict: "GOOD", confidence: 0.65, gaps: [], refinementQuery: undefined };
    }

    return {
        verdict: result.data.verdict,
        confidence: result.data.confidence ?? 0.65,
        gaps: result.data.gaps ?? [],
        refinementQuery: result.data.refinementQuery ?? undefined,
    };
}

/**
 * Refine an answer given a reflection and additional contexts.
 */
export async function refine(
    query: string,
    originalAnswer: string,
    reflection: ReflectionResult,
    additionalContexts: ScoredContext[]
): Promise<{ answer: string; provider: "kimi" | "bedrock" }> {
    const contextBlock = additionalContexts
        .slice(0, 8)
        .map((c, i) => `[Source ${i + 1}] ${c.title} (${c.date}): ${c.content.slice(0, 350)}`)
        .join("\n\n");

    const gapsList = reflection.gaps.length > 0
        ? `\nIdentified gaps to address:\n${reflection.gaps.map((g) => `- ${g}`).join("\n")}`
        : "";

    const result = await complete(
        [
            { role: "system", content: REFINEMENT_SYSTEM },
            {
                role: "user",
                content: [
                    `Query: ${query}`,
                    `Original answer:\n${originalAnswer}`,
                    gapsList,
                    `Additional contexts:\n${contextBlock}`,
                ].join("\n\n"),
            },
        ],
        { temperature: 0.3, maxTokens: 1200 }
    );

    return { answer: result.text, provider: result.provider };
}

/**
 * Full reflection loop: answer → reflect → refine if needed.
 */
export async function reflectiveLoop(
    query: string,
    initialAnswer: string,
    contexts: ScoredContext[],
    reRetrieve: (refinedQuery: string) => Promise<ScoredContext[]>
): Promise<RefinedAnswer> {
    let answer = initialAnswer;
    let confidence = 0.7;
    let iterations = 0;

    for (let i = 0; i < MAX_REFLECTION_ITERATIONS; i++) {
        const reflection = await reflect(query, answer, contexts);
        confidence = reflection.confidence;

        if (reflection.verdict === "GOOD" || reflection.confidence >= CONFIDENCE_THRESHOLD) break;
        if (reflection.verdict === "IRRELEVANT") break; // Retrieval problem, not generation

        iterations++;

        let additionalContexts = contexts;
        if (reflection.refinementQuery) {
            const fresh = await reRetrieve(reflection.refinementQuery);
            if (fresh.length > 0) {
                additionalContexts = fresh;
            }
        }

        const refined = await refine(query, answer, reflection, additionalContexts);
        answer = refined.answer;
    }

    return { answer, confidence, reflectionIterations: iterations };
}
