// ============================================================
// General LLM Chat API — No patient context
// Used by doctors for generic medical knowledge queries
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { complete as kimiComplete } from "../../../../lib/llm/kimi";
import { checkRateLimit } from "../../../../lib/utils/rateLimit";

export const maxDuration = 30;

const DOCTOR_SYSTEM_PROMPT = `You are Arogya, an intelligent clinical assistant built into ArogyaSutra, a digital health records platform used by licensed doctors in India.

You are speaking with a verified doctor. Your role is to:
- Answer general medical knowledge questions clearly and precisely
- Explain medical concepts, drug interactions, treatment protocols, diagnostic criteria
- Help with clinical decision-making by providing evidence-based information
- Format differential diagnoses, diagnostic checklists, or treatment summaries when asked

When you don't have patient-specific data available, acknowledge that and guide the doctor to verify a patient for context-aware queries.

Guidelines:
- Be concise and professional — you're talking to a medical professional
- Use correct medical terminology, but clarify abbreviations on first use
- Cite standard guidelines (Indian/WHO/ICMR) when relevant
- Never replace clinical judgment — always frame answers as informational
- If a question requires specific patient data, suggest the doctor use "Verify Patient" to unlock context-aware AI queries`;

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
                { role: "system", content: DOCTOR_SYSTEM_PROMPT },
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
