// ============================================================
// Amazon Bedrock Integration
// RAG-powered clinical assistant using Nova Pro
// ============================================================

import {
    BedrockRuntimeClient,
    ConverseCommand,
    type ConverseCommandInput,
    type Message,
    type SystemContentBlock,
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
// Nova Pro is the GUARANTEED fallback model — hardcoded, never configurable via env var.
// Do NOT use BEDROCK_MODEL_ID here; if that var points to Kimi, we'd loop into the same failure.
// Nova Pro cross-region inference profile works in us-east-1 with no Marketplace subscription.
const NOVA_MODEL_ID = "us.amazon.nova-pro-v1:0";

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

    const userText = contextBlock
        ? `Here are the patient's relevant medical records:\n\n${contextBlock}\n\nQuestion: ${query}`
        : query;

    const converseMessages: Message[] = [
        { role: "user", content: [{ text: userText }] },
    ];

    const input: ConverseCommandInput = {
        modelId: NOVA_MODEL_ID,
        messages: converseMessages,
        system: [{ text: systemPrompt || defaultSystem } as SystemContentBlock],
        inferenceConfig: {
            maxTokens: 2048,
            temperature: 0.3,
        },
    };

    const result = await bedrockClient.send(new ConverseCommand(input));

    const text =
        result.output?.message?.content
            ?.map((b) => ("text" in b ? b.text ?? "" : ""))
            .join("") ?? "";

    return {
        answer: text,
        inputTokens: result.usage?.inputTokens ?? 0,
        outputTokens: result.usage?.outputTokens ?? 0,
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
