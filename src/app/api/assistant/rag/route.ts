// ============================================================
// Patient-Aware RAG Chat API
// Used by patients (querying own records) and doctors
// (querying a verified patient's records)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import * as ragService from "../../../../lib/services/rag.service";
import { complete as kimiComplete } from "../../../../lib/llm/kimi";
import { checkRateLimit } from "../../../../lib/utils/rateLimit";
import { v4 as uuidv4 } from "uuid";

// Extend Lambda/Edge compute timeout to 30 s (Amplify Hosting supports up to 60 s)
export const maxDuration = 30;

export async function POST(req: NextRequest) {
    let query = "";
    let conversationId: string | undefined;
    try {
        const body = await req.json();
        query = body.query ?? "";
        const patientId: string = body.patientId ?? "";
        const queryBy = (body.queryBy === "DOCTOR" ? "DOCTOR" : "PATIENT") as "PATIENT" | "DOCTOR";
        const queryByUserId: string = body.queryByUserId || patientId;
        conversationId = body.conversationId;

        if (!query.trim() || !patientId) {
            return NextResponse.json(
                { error: "query and patientId are required" },
                { status: 400 }
            );
        }

        // Rate limit: patients 20 req/hr + 5/min burst; doctors 60 req/hr + 10/min burst
        const rateLimitUserId = queryByUserId || patientId;
        const rl = checkRateLimit(rateLimitUserId, queryBy, "rag");
        if (!rl.allowed) {
            return NextResponse.json(
                { error: rl.reason },
                {
                    status: 429,
                    headers: { "Retry-After": String(rl.retryAfterSeconds ?? 60) },
                }
            );
        }

        const response = await ragService.query({
            queryText: query,
            patientId,
            queryBy,
            queryByUserId,
            conversationId,
        });

        return NextResponse.json(response);
    } catch (err) {
        console.error("[assistant/rag] service failed, using direct fallback:", err);

        // Last-resort: call Kimi directly with anti-hallucination prompt
        if (query.trim()) {
            try {
                const noContextSystem = "You are ArogyaSutra, a medical AI assistant. The patient asked a question but we were unable to retrieve their medical records due to a system issue. Tell them you could not access their records right now and suggest they try again shortly. Do NOT make up any medical information, prescriptions, or doctor names.";
                const fallback = await kimiComplete(
                    [
                        { role: "system", content: noContextSystem },
                        { role: "user", content: query },
                    ],
                    { temperature: 0.2, maxTokens: 400 }
                );
                return NextResponse.json({
                    answer: fallback.text,
                    citations: [],
                    confidence: 30,
                    modelId: fallback.model,
                    generatedAt: new Date().toISOString(),
                    conversationId: conversationId || uuidv4(),
                    disclaimer: "AI-generated summary. Your doctor makes all clinical decisions.",
                });
            } catch (fallbackErr) {
                console.error("[assistant/rag] direct fallback also failed:", fallbackErr);
                return NextResponse.json(
                    { error: "Failed to process query", detail: (fallbackErr as Error).message },
                    { status: 500 }
                );
            }
        }

        return NextResponse.json(
            { error: "Failed to process query", detail: (err as Error).message },
            { status: 500 }
        );
    }
}
