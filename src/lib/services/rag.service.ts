// ============================================================
// RAG Clinical Assistant Service
// Patient & doctor AI assistant using Agentic RAG Engine
// (Kimi K2.5 primary → Amazon Bedrock Nova Pro fallback)
// ============================================================

import { generateInsights, type RAGContext } from "../aws/bedrock";
import * as healthlake from "../aws/healthlake";
import { logAccess, patientActor, doctorActor } from "./audit.service";
import { ragQuery as agenticRagQuery } from "../rag/engine";
import type {
    RAGQuery,
    RAGResponse,
    SourceCitation,
    HealthInsight,
    ChatConversation,
    ChatMessage,
} from "../types/rag";
import type { DocumentTypeTag } from "../types/timeline";
import { v4 as uuidv4 } from "uuid";

// In-memory conversation store (per session)
const conversations = new Map<string, ChatConversation>();

const MEDICAL_DISCLAIMER =
    "AI-generated summary based on your health records. Your doctor makes all clinical decisions.";

/**
 * Sends a query to the Agentic RAG assistant.
 *
 * 1. Classifies the query and selects the optimal RAG strategy
 * 2. Retrieves and ranks relevant patient contexts from HealthLake
 * 3. Generates an answer via Kimi K2.5 (→ Bedrock fallback)
 * 4. Applies corrective / reflective loops based on strategy
 * 5. Returns a structured RAG response with citations and confidence
 */
export async function query(ragQuery: RAGQuery): Promise<RAGResponse> {
    const conversationId = ragQuery.conversationId || uuidv4();

    // Retrieve conversation history for multi-turn context
    const existingConversation = conversations.get(conversationId);
    const conversationHistory = existingConversation?.messages.slice(-8).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
    }));

    // Run agentic RAG engine
    const engineResult = await agenticRagQuery({
        patientId: ragQuery.patientId,
        queryText: ragQuery.queryText,
        conversationHistory,
        topK: 12,
    });

    // Build SourceCitation array from scored contexts
    const citations = buildCitations(engineResult.answer, engineResult.contexts);

    // Confidence: combine engine confidence (0–1) → percentage (0–100)
    const confidence = Math.round(
        Math.max(engineResult.confidence, citations.length > 0 ? 0.7 : 0.45) * 100
    );

    const response: RAGResponse = {
        answer: engineResult.answer,
        citations,
        confidence,
        modelId: engineResult.modelId,
        generatedAt: new Date().toISOString(),
        conversationId,
        disclaimer: MEDICAL_DISCLAIMER,
    };

    // Update conversation history
    updateConversation(conversationId, ragQuery, response);

    // Audit log
    const actor =
        ragQuery.queryBy === "DOCTOR"
            ? doctorActor(ragQuery.queryByUserId, ragQuery.queryByUserId, "")
            : patientActor(ragQuery.queryByUserId, ragQuery.queryByUserId);

    await logAccess(
        ragQuery.patientId,
        "AI_QUERY",
        actor,
        {
            query: ragQuery.queryText.slice(0, 100),
            citationCount: String(citations.length),
            strategy: engineResult.strategy,
            queryType: engineResult.queryType,
            provider: engineResult.provider,
        }
    );

    return response;
}

/**
 * Generates proactive health insights for a patient using Bedrock.
 * Uses HealthLake records as context for Bedrock's insight generation.
 */
export async function getInsights(
    patientId: string
): Promise<HealthInsight[]> {
    const contexts = await fetchInsightContexts(patientId);
    if (contexts.length === 0) return [];

    const result = await generateInsights(contexts);

    return parseInsights(result.answer, patientId);
}

/**
 * Gets the conversation history for a session.
 */
export function getConversation(
    conversationId: string
): ChatConversation | undefined {
    return conversations.get(conversationId);
}

// ---- Internal ----

/** Fetch minimal RAGContext objects for the Bedrock insights endpoint. */
async function fetchInsightContexts(patientId: string): Promise<RAGContext[]> {
    try {
        const resources = await healthlake.getPatientTimeline(patientId);
        return resources.slice(0, 10).map((resource, i) => ({
            entryId: (resource.id as string) || `ctx-${i}`,
            title:
                (resource.description as string) ||
                (resource.code as { text?: string })?.text ||
                (resource.resourceType as string),
            date:
                (resource.effectiveDateTime as string) ||
                (resource.date as string) ||
                (resource.recordedDate as string) ||
                "",
            content: JSON.stringify(resource).slice(0, 500),
            documentType: resource.resourceType as string,
        }));
    } catch {
        return [];
    }
}

/**
 * Build SourceCitation array by matching [Source N] patterns in the answer
 * against the scored contexts returned by the engine.
 */
function buildCitations(
    answer: string,
    contexts: Array<{ entryId: string; title: string; documentType: string; date: string; content: string; relevanceScore?: number }>
): SourceCitation[] {
    const citations: SourceCitation[] = [];
    const sourcePattern = /\[Source (\d+)[^\]]*\]/g;
    let match;

    while ((match = sourcePattern.exec(answer)) !== null) {
        const index = parseInt(match[1], 10) - 1;
        if (index >= 0 && index < contexts.length) {
            const ctx = contexts[index];
            if (!citations.find((c) => c.entryId === ctx.entryId)) {
                citations.push({
                    entryId: ctx.entryId,
                    entryTitle: ctx.title,
                    documentType: ctx.documentType as DocumentTypeTag,
                    date: ctx.date,
                    relevantExcerpt: ctx.content.slice(0, 200),
                    relevanceScore: (ctx as { relevanceScore?: number }).relevanceScore ?? 0.8,
                });
            }
        }
    }

    return citations;
}

function parseInsights(answer: string, patientId: string): HealthInsight[] {
    const insights: HealthInsight[] = [];
    const lines = answer.split("\n");
    let current: Partial<HealthInsight> = {};

    for (const line of lines) {
        if (line.startsWith("TYPE:")) {
            if (current.title) insights.push(finalizeInsight(current, patientId));
            current = { type: line.replace("TYPE:", "").trim() as HealthInsight["type"] };
        } else if (line.startsWith("SEVERITY:")) {
            current.severity = line.replace("SEVERITY:", "").trim() as HealthInsight["severity"];
        } else if (line.startsWith("TITLE:")) {
            current.title = line.replace("TITLE:", "").trim();
        } else if (line.startsWith("DESCRIPTION:")) {
            current.description = line.replace("DESCRIPTION:", "").trim();
        }
    }

    if (current.title) insights.push(finalizeInsight(current, patientId));
    return insights;
}

function finalizeInsight(partial: Partial<HealthInsight>, patientId: string): HealthInsight {
    return {
        insightId: uuidv4(),
        patientId,
        type: partial.type || "trend_rising",
        title: partial.title || "Health Insight",
        description: partial.description || "",
        severity: partial.severity || "info",
        relatedEntryIds: [],
        dataPoints: [],
        generatedAt: new Date().toISOString(),
        isRead: false,
        isDismissed: false,
    };
}

function updateConversation(
    conversationId: string,
    query: RAGQuery,
    response: RAGResponse
): void {
    let conversation = conversations.get(conversationId);

    if (!conversation) {
        conversation = {
            conversationId,
            patientId: query.patientId,
            messages: [],
            startedAt: new Date().toISOString(),
            lastMessageAt: new Date().toISOString(),
        };
        conversations.set(conversationId, conversation);
    }

    const userMessage: ChatMessage = {
        messageId: uuidv4(),
        role: "user",
        content: query.queryText,
        timestamp: new Date().toISOString(),
    };

    const assistantMessage: ChatMessage = {
        messageId: uuidv4(),
        role: "assistant",
        content: response.answer,
        citations: response.citations,
        timestamp: response.generatedAt,
    };

    conversation.messages.push(userMessage, assistantMessage);
    conversation.lastMessageAt = new Date().toISOString();
}
