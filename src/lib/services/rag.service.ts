// ============================================================
// RAG Clinical Assistant Service
// Patient & doctor AI assistant using Bedrock + HealthLake
// ============================================================

import { invokeModel, generateInsights, type RAGContext } from "../aws/bedrock";
import * as healthlake from "../aws/healthlake";
import { logAccess, patientActor, doctorActor } from "./audit.service";
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
    "⚕️ This is AI-generated information, not medical advice. " +
    "Always consult a qualified healthcare professional for diagnosis and treatment decisions.";

/**
 * Sends a query to the RAG assistant.
 *
 * 1. Retrieves relevant context from HealthLake
 * 2. Invokes Bedrock with context + query
 * 3. Parses citations from the response
 * 4. Returns structured RAG response
 */
export async function query(ragQuery: RAGQuery): Promise<RAGResponse> {
    const conversationId = ragQuery.conversationId || uuidv4();

    // 1. Retrieve relevant patient data from HealthLake
    const contexts = await retrieveContext(ragQuery.patientId, ragQuery.queryText);

    // 2. Invoke Bedrock
    const result = await invokeModel(ragQuery.queryText, contexts);

    // 3. Parse citations from the response
    const citations = parseCitations(result.answer, contexts);

    // 4. Build response
    const response: RAGResponse = {
        answer: result.answer,
        citations,
        confidence: citations.length > 0 ? 80 : 50,
        modelId: "anthropic.claude-3-sonnet",
        generatedAt: new Date().toISOString(),
        conversationId,
        disclaimer: MEDICAL_DISCLAIMER,
    };

    // 5. Update conversation history
    updateConversation(conversationId, ragQuery, response);

    // 6. Log the query
    const actor =
        ragQuery.queryBy === "DOCTOR"
            ? doctorActor(ragQuery.queryByUserId, ragQuery.queryByUserId, "")
            : patientActor(ragQuery.queryByUserId, ragQuery.queryByUserId);

    await logAccess(
        ragQuery.patientId,
        "AI_QUERY",
        actor,
        { query: ragQuery.queryText.slice(0, 100), citationCount: String(citations.length) }
    );

    return response;
}

/**
 * Generates proactive health insights for a patient.
 */
export async function getInsights(
    patientId: string
): Promise<HealthInsight[]> {
    const contexts = await retrieveContext(patientId, "");
    if (contexts.length === 0) return [];

    const result = await generateInsights(contexts);

    // Parse structured insights from Bedrock response
    return parseInsights(result.answer, patientId, contexts);
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

async function retrieveContext(
    patientId: string,
    queryText: string
): Promise<RAGContext[]> {
    try {
        const resources = await healthlake.getPatientTimeline(patientId);

        return resources.slice(0, 10).map((resource, i) => ({
            entryId: (resource.id as string) || `ctx-${i}`,
            title: (resource.description as string) ||
                (resource.code as { text?: string })?.text ||
                resource.resourceType as string,
            date: (resource.effectiveDateTime as string) ||
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

function parseCitations(
    answer: string,
    contexts: RAGContext[]
): SourceCitation[] {
    const citations: SourceCitation[] = [];
    const sourcePattern = /\[Source (\d+)[^\]]*\]/g;
    let match;

    while ((match = sourcePattern.exec(answer)) !== null) {
        const index = parseInt(match[1], 10) - 1;
        if (index >= 0 && index < contexts.length) {
            const ctx = contexts[index];
            // Avoid duplicate citations
            if (!citations.find((c) => c.entryId === ctx.entryId)) {
                citations.push({
                    entryId: ctx.entryId,
                    entryTitle: ctx.title,
                    documentType: ctx.documentType as DocumentTypeTag,
                    date: ctx.date,
                    relevantExcerpt: ctx.content.slice(0, 200),
                    relevanceScore: 0.8,
                });
            }
        }
    }

    return citations;
}

function parseInsights(
    answer: string,
    patientId: string,
    contexts: RAGContext[]
): HealthInsight[] {
    const insights: HealthInsight[] = [];
    const lines = answer.split("\n");

    let current: Partial<HealthInsight> = {};

    for (const line of lines) {
        if (line.startsWith("TYPE:")) {
            if (current.title) {
                insights.push(finalizeInsight(current, patientId));
            }
            current = { type: line.replace("TYPE:", "").trim() as HealthInsight["type"] };
        } else if (line.startsWith("SEVERITY:")) {
            current.severity = line.replace("SEVERITY:", "").trim() as HealthInsight["severity"];
        } else if (line.startsWith("TITLE:")) {
            current.title = line.replace("TITLE:", "").trim();
        } else if (line.startsWith("DESCRIPTION:")) {
            current.description = line.replace("DESCRIPTION:", "").trim();
        }
    }

    if (current.title) {
        insights.push(finalizeInsight(current, patientId));
    }

    return insights;
}

function finalizeInsight(
    partial: Partial<HealthInsight>,
    patientId: string
): HealthInsight {
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
