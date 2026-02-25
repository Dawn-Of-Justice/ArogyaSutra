// ============================================================
// Amazon Bedrock Integration
// RAG-powered clinical assistant using Claude/Llama
// ============================================================

import {
    BedrockRuntimeClient,
    InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

const region = process.env.NEXT_PUBLIC_AWS_REGION || "ap-south-1";
const bedrockClient = new BedrockRuntimeClient({ region });
const MODEL_ID =
    process.env.BEDROCK_MODEL_ID || "anthropic.claude-3-sonnet-20240229-v1:0";

/** RAG context document */
export interface RAGContext {
    entryId: string;
    title: string;
    date: string;
    content: string; // Decrypted text summary
    documentType: string;
}

/** Bedrock model response */
export interface BedrockResponse {
    answer: string;
    inputTokens: number;
    outputTokens: number;
}

/**
 * Invokes Amazon Bedrock with a clinical query + patient context.
 *
 * @param query     Patient or doctor question
 * @param contexts  Relevant timeline entries (decrypted client-side)
 * @param systemPrompt  Optional system prompt override
 * @returns         Model response
 */
export async function invokeModel(
    query: string,
    contexts: RAGContext[],
    systemPrompt?: string
): Promise<BedrockResponse> {
    const contextBlock = contexts
        .map(
            (ctx, i) =>
                `[Source ${i + 1}: ${ctx.title} (${ctx.documentType}, ${ctx.date})] ${ctx.content}`
        )
        .join("\n\n");

    const defaultSystem = `You are ArogyaSutra's clinical assistant. You help patients and doctors understand medical records. You MUST:
1. Always cite sources using [Source N] format
2. Never diagnose — only summarize and highlight patterns
3. Flag anything potentially concerning with ⚠️
4. Include a medical disclaimer in every response
5. Respond in the same language the user asks in
6. Be concise but thorough`;

    const body = JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 2048,
        system: systemPrompt || defaultSystem,
        messages: [
            {
                role: "user",
                content: `Here are the patient's relevant medical records:\n\n${contextBlock}\n\nQuestion: ${query}`,
            },
        ],
        temperature: 0.3, // Low temperature for medical accuracy
    });

    const result = await bedrockClient.send(
        new InvokeModelCommand({
            modelId: MODEL_ID,
            body: new TextEncoder().encode(body),
            contentType: "application/json",
            accept: "application/json",
        })
    );

    const responseBody = JSON.parse(new TextDecoder().decode(result.body));

    return {
        answer: responseBody.content?.[0]?.text || "",
        inputTokens: responseBody.usage?.input_tokens || 0,
        outputTokens: responseBody.usage?.output_tokens || 0,
    };
}

/**
 * Generates proactive health insights by analyzing timeline trends.
 *
 * @param contexts    All relevant timeline entries
 * @returns           Structured insights
 */
export async function generateInsights(
    contexts: RAGContext[]
): Promise<BedrockResponse> {
    const insightPrompt = `Analyze these medical records and identify:
1. Trends (rising/declining values over time)
2. Potential drug interactions between current medications
3. Missed follow-ups or overdue screenings
4. Any abnormal lab values

Format each insight as:
TYPE: [trend_rising|trend_declining|drug_interaction|missed_followup|abnormal_lab]
SEVERITY: [info|warning|alert]
TITLE: Brief title
DESCRIPTION: One-line explanation
SOURCES: [Source numbers]

Only report clinically meaningful insights. Do NOT report normal values.`;

    return invokeModel(insightPrompt, contexts);
}
