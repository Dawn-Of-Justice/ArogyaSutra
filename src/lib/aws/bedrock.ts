// ============================================================
// Amazon Bedrock Integration
// RAG-powered clinical assistant using Claude/Llama
// ============================================================

import {
    BedrockRuntimeClient,
    InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

// Amplify blocks "AWS_" prefix env vars — use APP_AWS_* workaround.
// Falls back to default credential chain (IAM role / local ~/.aws).
const _appCreds =
    process.env.APP_AWS_ACCESS_KEY_ID && process.env.APP_AWS_SECRET_ACCESS_KEY
        ? { credentials: { accessKeyId: process.env.APP_AWS_ACCESS_KEY_ID, secretAccessKey: process.env.APP_AWS_SECRET_ACCESS_KEY } }
        : {};


// Claude 4 cross-region inference profiles only work in us-east-1 / us-west-2
const bedrockRegion = ["us-east-1", "us-west-2"].includes(process.env.NEXT_PUBLIC_AWS_REGION || "")
    ? process.env.NEXT_PUBLIC_AWS_REGION!
    : "us-east-1";
const bedrockClient = new BedrockRuntimeClient({ region: bedrockRegion, ..._appCreds });
const MODEL_ID =
    process.env.BEDROCK_MODEL_ID || "us.amazon.nova-pro-v1:0";

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

    const defaultSystem = `You are Arogya, a friendly and knowledgeable health assistant built into ArogyaSutra. You support both patients and their doctors by helping them understand medical records, lab results, prescriptions, and health history clearly and compassionately.

Your role is to EXPLAIN and SUMMARIZE — not to diagnose, prescribe, or draw clinical conclusions. The treating doctor always makes the final call.

Guidelines:
- Be warm, clear, and conversational. Avoid robotic or clinical-sounding language.
- Always cite the source of information using [Source N] format so readers know exactly where data came from.
- Explain medical terms in plain language that a patient can understand, while still being precise enough for a doctor.
- If something in the records looks noteworthy (e.g. a value outside normal range, a missed follow-up), mention it calmly and factually — no alarm language.
- DO NOT repeat legal disclaimers or boilerplate warnings in every message. Users of this app already understand they are reviewing their own health data.
- Respond in the same language the user writes in (Hindi, English, etc.).
- Keep answers focused and concise. Use bullet points or short paragraphs for readability.`;

    const body = JSON.stringify({
        messages: [
            {
                role: "user",
                content: [{ text: `Here are the patient's relevant medical records:\n\n${contextBlock}\n\nQuestion: ${query}` }],
            },
        ],
        system: [{ text: systemPrompt || defaultSystem }],
        inferenceConfig: {
            maxTokens: 2048,
            temperature: 0.3,
        },
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
        answer: responseBody.output?.message?.content?.[0]?.text || responseBody.content?.[0]?.text || "",
        inputTokens: responseBody.usage?.inputTokens || responseBody.usage?.input_tokens || 0,
        outputTokens: responseBody.usage?.outputTokens || responseBody.usage?.output_tokens || 0,
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
