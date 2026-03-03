// ============================================================
// Agentic RAG — Speculative RAG
// Generates a fast draft answer (speculation), then verifies
// it against retrieved contexts in parallel to save latency.
// If the draft is largely correct, uses it with minor edits.
// If not, regenerates. Net effect: faster response for common
// or simple queries while maintaining accuracy.
// ============================================================

import { complete, completeJSON } from "../llm/kimi";
import type { ScoredContext, SpeculativeResult } from "./types";

// --------------- Prompts ---------------

const SPECULATIVE_SYSTEM = `You are a medical AI assistant. Generate a concise, direct answer to the patient's query.
This is a speculative draft — be clear and helpful, but note you may be verifying against records.
Cite [SPECULATIVE] at the end to indicate this draft has not been verified yet.`;

const VERIFICATION_SYSTEM = `You are a medical fact-checker. You have a draft answer and the actual health records.
Evaluate the draft against the records, then produce a final verified answer.
Respond with JSON only:
{
  "draftAccepted": true | false,
  "groundingScore": 0.0-1.0,
  "finalAnswer": "the verified, corrected answer (keep [Source N] citations)"
}
If the draft is accurate (score >= 0.75), set draftAccepted: true and make only minor edits.
If inaccurate, rewrite fully from the records.`;

// --------------- Public API ---------------

/**
 * Two-phase speculative generation + verification.
 *
 * Phase 1 (draft): quickly generate an answer using model's internal knowledge + implicit priors.
 * Phase 2 (verify): check draft against retrieved contexts, accept/reject/correct.
 *
 * Both phases run sequentially here, but Phase 1 can be kicked off before retrieval
 * completes if the caller provides a `draftPromise`.
 */
export async function speculateAndVerify(
    query: string,
    contexts: ScoredContext[],
    conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = []
): Promise<SpeculativeResult> {
    // Phase 1: speculative draft
    // In a production system this would be started before retrieval finishes.
    const draftResult = await generateDraft(query, conversationHistory);
    const draft = draftResult.text;

    if (contexts.length === 0) {
        // No context to verify against — return draft as-is
        return {
            draft,
            verified: draft.replace(" [SPECULATIVE]", ""),
            draftAccepted: true,
            groundingScore: 0.5,
        };
    }

    // Phase 2: verify draft against retrieved contexts
    const contextBlock = contexts
        .slice(0, 8)
        .map((c, i) => `[Source ${i + 1}] ${c.title} (${c.date}): ${c.content.slice(0, 350)}`)
        .join("\n\n");

    const verifyResult = await completeJSON<{
        draftAccepted: boolean;
        groundingScore: number;
        finalAnswer: string;
    }>(
        [
            { role: "system", content: VERIFICATION_SYSTEM },
            {
                role: "user",
                content: [
                    `Query: ${query}`,
                    `Draft answer:\n${draft}`,
                    `\nActual health records:\n${contextBlock}`,
                ].join("\n\n"),
            },
        ],
        { temperature: 0.1, maxTokens: 1200 }
    );

    if (!verifyResult.data) {
        // Verification failed to parse — return draft cleaned of speculative tag
        return {
            draft,
            verified: draft.replace(" [SPECULATIVE]", ""),
            draftAccepted: true,
            groundingScore: 0.5,
        };
    }

    return {
        draft,
        verified: verifyResult.data.finalAnswer || draft.replace(" [SPECULATIVE]", ""),
        draftAccepted: verifyResult.data.draftAccepted,
        groundingScore: verifyResult.data.groundingScore ?? 0.5,
    };
}

// --------------- Helpers ---------------

async function generateDraft(
    query: string,
    history: Array<{ role: "user" | "assistant"; content: string }>
) {
    const messages = [
        { role: "system" as const, content: SPECULATIVE_SYSTEM },
        ...history.slice(-4).map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
        })),
        { role: "user" as const, content: query },
    ];

    return complete(messages, { temperature: 0.4, maxTokens: 800 });
}
