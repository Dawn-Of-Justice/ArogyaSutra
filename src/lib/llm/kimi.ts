// ============================================================
// Kimi K2 LLM Client — via Amazon Bedrock
// Uses Bedrock ConverseCommand (standard chat interface).
// Falls back to Amazon Nova Pro on any error.
// ============================================================

import {
    BedrockRuntimeClient,
    ConverseCommand,
    type ConverseCommandInput,
    type Message,
    type SystemContentBlock,
} from "@aws-sdk/client-bedrock-runtime";
import { invokeModel, type RAGContext } from "../aws/bedrock";

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

// Kimi K2 cross-region inference is available in us-east-1
const bedrockRegion = ["us-east-1", "us-west-2"].includes(
    process.env.NEXT_PUBLIC_AWS_REGION || ""
)
    ? process.env.NEXT_PUBLIC_AWS_REGION!
    : "us-east-1";

const kimiClient = new BedrockRuntimeClient({ region: bedrockRegion, ..._appCreds });

// Kimi K2.5 base model on Bedrock (confirmed ACTIVE via list-foundation-models)
// Override with KIMI_BEDROCK_MODEL env var if needed
const KIMI_MODEL_ID =
    process.env.KIMI_BEDROCK_MODEL || "moonshotai.kimi-k2.5";

// --------------- Core chat completion ---------------

/**
 * Send a chat completion request via Kimi K2 on Amazon Bedrock.
 * Automatically falls back to Nova Pro if Kimi is unavailable or errors.
 */
export async function complete(
    messages: LLMMessage[],
    options: LLMOptions = {}
): Promise<LLMResult> {
    try {
        return await kimiBedrockComplete(messages, options);
    } catch (err) {
        console.warn(
            "[LLM] Kimi K2 (Bedrock) failed, falling back to Nova Pro:",
            (err as Error).message
        );
        return bedrockNovaFallback(messages, options);
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

    // Timeout guard — must stay well under Lambda's compute limit.
    // Route has maxDuration=30s; leave ~15s budget for retrieval + generation overhead.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);

    const response = await kimiClient
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

// --------------- Nova Pro fallback ---------------

async function bedrockNovaFallback(
    messages: LLMMessage[],
    _options: LLMOptions
): Promise<LLMResult> {
    const systemMsg = messages.find((m) => m.role === "system")?.content ?? "";
    const userMessages = messages.filter((m) => m.role !== "system");
    const lastUser = userMessages.filter((m) => m.role === "user").pop();
    let rawQuery = lastUser?.content ?? "";

    // When runDirect embeds context in the user message ("Health records:\n...\n\nQuestion: X"),
    // extract just the question so Nova Pro receives a clean prompt with an empty contextBlock.
    // Otherwise Nova Pro gets confused by the duplicated structure.
    const questionMatch = rawQuery.match(/\bQuestion:\s*([\s\S]+)$/i);
    const query = questionMatch ? questionMatch[1].trim() : rawQuery;

    // Pass prior assistant turns as lightweight context objects
    const contexts: RAGContext[] = userMessages
        .filter((m) => m.role === "assistant")
        .map((m, i) => ({
            entryId: `conv-${i}`,
            title: `Previous response ${i + 1}`,
            date: new Date().toISOString(),
            content: m.content.slice(0, 400),
            documentType: "conversation",
        }));

    const result = await invokeModel(query, contexts, systemMsg || undefined);

    if (!result.answer.trim()) {
        throw new Error("Nova Pro fallback also returned empty answer");
    }

    return {
        text: result.answer,
        model: process.env.BEDROCK_MODEL_ID || "us.amazon.nova-pro-v1:0",
        provider: "bedrock",
        promptTokens: result.inputTokens,
        completionTokens: result.outputTokens,
    };
}
