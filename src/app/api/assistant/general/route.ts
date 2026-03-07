// ============================================================
// General LLM Chat API — No patient context
// Used by doctors for generic medical knowledge queries
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { complete as kimiComplete } from "../../../../lib/llm/kimi";
import { checkRateLimit } from "../../../../lib/utils/rateLimit";
import { getPrompts } from "../../../../lib/rag/prompts";

export const maxDuration = 60;

// General route is only used by doctors (no patient context).
// The prompt comes from the central prompts.ts file for easy editing.

export async function POST(req: NextRequest) {
    try {
        const { query, conversationId, doctorId: bodyDoctorId } = await req.json();

        if (!query?.trim()) {
            return NextResponse.json({ error: "query is required" }, { status: 400 });
        }

        // Rate limit: doctors 40 req/hr + 8/min burst
        // Prefer explicit doctorId from body; fall back to x-user-id header; then IP
        const doctorId: string =
            bodyDoctorId ||
            req.headers.get("x-user-id") ||
            `ip-${req.headers.get("x-forwarded-for") || "unknown"}`;
        const rl = checkRateLimit(doctorId, "DOCTOR", "general");
        if (!rl.allowed) {
            return NextResponse.json(
                { error: rl.reason },
                {
                    status: 429,
                    headers: { "Retry-After": String(rl.retryAfterSeconds ?? 60) },
                }
            );
        }

        const result = await kimiComplete(
            [
                { role: "system", content: getPrompts("DOCTOR").general },
                { role: "user", content: query },
            ],
            { temperature: 0.3, maxTokens: 1200 }
        );

        return NextResponse.json({
            answer: result.text,
            conversationId: conversationId || `general-${Date.now()}`,
            generatedAt: new Date().toISOString(),
        });
    } catch (err) {
        console.error("[assistant/general]", err);
        return NextResponse.json({ error: "Failed to process query" }, { status: 500 });
    }
}
