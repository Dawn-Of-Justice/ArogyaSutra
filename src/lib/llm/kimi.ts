// ============================================================
// Kimi K2.5 LLM Client — via Amazon Bedrock
// Uses Bedrock ConverseCommand (standard chat interface).
// Falls back to Mistral Devstral-2-123B on any error.
// ============================================================

import {
    BedrockRuntimeClient,
    ConverseCommand,
    type ConverseCommandInput,
    type Message,
    type SystemContentBlock,
} from "@aws-sdk/client-bedrock-runtime";

// --------------- Types ---------------

export interface LLMMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

export interface LLMOptions {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    /** JSON mode hint — appended to system prompt so Kimi returns valid JSON */
    jsonMode?: boolean;
}

export interface LLMResult {
    text: string;
    model: string;
    provider: "kimi" | "bedrock";
    promptTokens?: number;
    completionTokens?: number;
}

// --------------- Bedrock Client ---------------

const _appCreds =
    process.env.APP_AWS_ACCESS_KEY_ID && process.env.APP_AWS_SECRET_ACCESS_KEY
        ? {
              credentials: {
                  accessKeyId: process.env.APP_AWS_ACCESS_KEY_ID,
                  secretAccessKey: process.env.APP_AWS_SECRET_ACCESS_KEY,
              },
          }
        : {};

// Kimi K2.5 cross-region inference is available in us-east-1
const kimiRegion = ["us-east-1", "us-west-2"].includes(
    process.env.NEXT_PUBLIC_AWS_REGION || ""
)
    ? process.env.NEXT_PUBLIC_AWS_REGION!
    : "us-east-1";

const kimiClient = new BedrockRuntimeClient({ region: kimiRegion, ..._appCreds });

// Devstral is available in ap-south-1
const devstralRegion = process.env.DEVSTRAL_BEDROCK_REGION || "ap-south-1";
const devstralClient = new BedrockRuntimeClient({ region: devstralRegion, ..._appCreds });

// Kimi K2.5 base model on Bedrock
// Override with KIMI_BEDROCK_MODEL env var if needed
const KIMI_MODEL_ID =
    process.env.KIMI_BEDROCK_MODEL || "moonshotai.kimi-k2.5";

// Mistral Devstral-2-123B — backup model if Kimi K2.5 is unavailable
// Override with DEVSTRAL_BEDROCK_MODEL env var if needed
const DEVSTRAL_MODEL_ID =
    process.env.DEVSTRAL_BEDROCK_MODEL || "mistral.devstral-2-123b";

// --------------- Core chat completion ---------------

/**
 * Send a chat completion request via Kimi K2.5 on Amazon Bedrock.
 * Automatically falls back to Devstral-2-123B (ap-south-1) if Kimi is unavailable or errors.
 */
export async function complete(
    messages: LLMMessage[],
    options: LLMOptions = {}
): Promise<LLMResult> {
    const primaryModel = options.model || KIMI_MODEL_ID;
    console.log(`[LLM] Using primary model: ${primaryModel}`);
    try {
        const result = await kimiBedrockComplete(messages, options);
        console.log(`[LLM] Response received from model: ${result.model}`);
        return result;
    } catch (err) {
        console.warn(
            "[LLM] Kimi K2.5 (Bedrock) failed, falling back to Devstral-2-123B:",
            (err as Error).message
        );
        console.log(`[LLM] Using fallback model: ${DEVSTRAL_MODEL_ID} in region ${devstralRegion}`);
        return devstralFallback(messages, options);
    }
}

/**
 * Convenience: complete and parse the result as JSON.
 * Returns null data if JSON parsing fails; raw text is always returned.
 */
export async function completeJSON<T = Record<string, unknown>>(
    messages: LLMMessage[],
    options: LLMOptions = {}
): Promise<{ data: T | null; raw: string; model: string; provider: "kimi" | "bedrock" }> {
    const result = await complete(messages, { ...options, jsonMode: true });
    let data: T | null = null;
    try {
        const cleaned = result.text
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/```\s*$/i, "")
            .trim();
        data = JSON.parse(cleaned) as T;
    } catch {
        // returns null data with raw text
    }
    return { data, raw: result.text, model: result.model, provider: result.provider };
}

// --------------- Kimi via Bedrock Converse API ---------------

async function kimiBedrockComplete(
    messages: LLMMessage[],
    options: LLMOptions
): Promise<LLMResult> {
    const modelId = options.model || KIMI_MODEL_ID;

    // Separate system messages from the conversation
    const systemMessages = messages.filter((m) => m.role === "system");
    const chatMessages   = messages.filter((m) => m.role !== "system");

    // Build system prompt; append JSON instruction when jsonMode is set
    let systemText = systemMessages.map((m) => m.content).join("\n\n").trim();
    if (options.jsonMode) {
        const jsonInstruction = "Respond with valid JSON only. Do not wrap in markdown code fences.";
        systemText = systemText ? `${systemText}\n\n${jsonInstruction}` : jsonInstruction;
    }

    // Map to Bedrock Message objects
    const converseMessages: Message[] = chatMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: [{ text: m.content }],
    }));

    // Bedrock Converse API requires the conversation to start with a user turn
    if (converseMessages.length === 0 || converseMessages[0].role !== "user") {
        converseMessages.unshift({ role: "user", content: [{ text: "(start)" }] });
    }

    const input: ConverseCommandInput = {
        modelId,
        messages: converseMessages,
        inferenceConfig: {
            maxTokens: options.maxTokens ?? 2048,
            temperature: options.temperature ?? 0.3,
        },
        ...(systemText ? { system: [{ text: systemText } as SystemContentBlock] } : {}),
    };

    // Timeout guard — must stay well under the 24s pipeline timeout.
    // 10s primary + 10s fallback = 20s, safely under the 24s budget.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    // Use devstralClient when calling the Devstral model (different region)
    const client = modelId === DEVSTRAL_MODEL_ID ? devstralClient : kimiClient;

    const response = await client
        .send(new ConverseCommand(input), { abortSignal: controller.signal })
        .finally(() => clearTimeout(timer));

    const text =
        response.output?.message?.content
            ?.map((b) => ("text" in b ? b.text ?? "" : ""))
            .join("") ?? "";

    // Empty text means the model was filtered, not available, or returned no content.
    // Throw so the fallback can handle it rather than returning a silent empty answer.
    if (!text.trim()) {
        throw new Error(`Kimi K2 returned empty response (stopReason: ${response.stopReason ?? "unknown"})`);
    }

    return {
        text,
        model: modelId,
        provider: "kimi",
        promptTokens: response.usage?.inputTokens,
        completionTokens: response.usage?.outputTokens,
    };
}

// --------------- Mistral Devstral-2-123B fallback ---------------

async function devstralFallback(
    messages: LLMMessage[],
    options: LLMOptions
): Promise<LLMResult> {
    const result = await kimiBedrockComplete(messages, {
        ...options,
        model: DEVSTRAL_MODEL_ID,
    });

    if (!result.text.trim()) {
        throw new Error("Devstral-2-123B fallback also returned empty answer");
    }

    return {
        ...result,
        model: DEVSTRAL_MODEL_ID,
        provider: "bedrock",
    };
}

