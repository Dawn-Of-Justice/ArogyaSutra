// ============================================================
// Agentic RAG — Query Router / Classifier
// Classifies the user's query so the engine can pick the
// optimal retrieval strategy without an LLM call.
// ============================================================

import type { ClassifiedQuery, QueryType } from "./types";

// --------------- Keyword Patterns ---------------

const PATTERNS: Array<{ type: QueryType; regex: RegExp; complexity: number }> = [
    // Trend / temporal
    {
        type: "TEMPORAL_TREND",
        regex: /\b(trend|over time|history|chang|progression|last \d|past \d|recent \d|month|year|week|wors|improv|increas|decreas)\b/i,
        complexity: 3,
    },
    // Multi-hop relational
    {
        type: "MULTI_HOP",
        regex: /\b(relat|connect|because|caus|affect|impact|due to|result|correlat|between.*and|how.*influenc|explain why)\b/i,
        complexity: 4,
    },
    // Comparative
    {
        type: "COMPARATIVE",
        regex: /\b(better|worse|higher|lower|compared|versus|vs\.?|differ|same as|change from|normal|abnormal|above|below|threshold)\b/i,
        complexity: 3,
    },
    // Summarization
    {
        type: "SUMMARIZATION",
        regex: /\b(summar|overview|brief|all my|list all|show all|give me all|what are all|tell me everything|full history)\b/i,
        complexity: 2,
    },
    // General knowledge (no patient data needed)
    {
        type: "GENERAL",
        regex: /^(what is|what are|how does|explain|define|tell me about|describe|why does|what causes|what.*mean)\b/i,
        complexity: 1,
    },
];

// Medical entity keywords for retrieval boosting
const MEDICAL_ENTITY_PATTERNS = [
    /\b(diabetes|hypertension|bp|blood pressure|cholesterol|hba1c|glucose|sugar|insulin)\b/gi,
    /\b(medication|medicine|drug|tablet|dose|prescription|metformin|aspirin|statin)\b/gi,
    /\b(lab|test|report|result|value|reading|scan|x.?ray|mri|ct|ecg|ekg)\b/gi,
    /\b(visit|appointment|consult|doctor|hospital|clinic|admission|discharge)\b/gi,
    /\b(heart|kidney|liver|lung|brain|eye|weight|height|bmi|pulse|temperature)\b/gi,
    /\b(pain|fever|fatigue|nausea|vomit|cough|diarrhea|constipation|rash|swelling)\b/gi,
];

// --------------- Public API ---------------

/**
 * Classify a user query for optimal RAG routing.
 * Pure CPU — no LLM call, so sub-millisecond.
 */
export function classifyQuery(queryText: string): ClassifiedQuery {
    const normalized = normalize(queryText);
    const entities = extractEntities(queryText);

    for (const pattern of PATTERNS) {
        if (pattern.regex.test(queryText)) {
            return {
                original: queryText,
                queryType: pattern.type,
                normalized,
                entities,
                complexity: pattern.complexity + (entities.length > 3 ? 1 : 0),
            };
        }
    }

    // Default: simple factual
    return {
        original: queryText,
        queryType: "SIMPLE_FACTUAL",
        normalized,
        entities,
        complexity: 2,
    };
}

/**
 * Decide how many contexts to retrieve based on query type.
 */
export function topKForQueryType(queryType: QueryType): number {
    switch (queryType) {
        case "SUMMARIZATION":  return 20;
        case "TEMPORAL_TREND": return 15;
        case "MULTI_HOP":      return 12;
        case "COMPARATIVE":    return 8;
        case "SIMPLE_FACTUAL": return 4;  // Small retrieval set — fast
        case "GENERAL":        return 0;  // No retrieval needed
    }
}

// --------------- Helpers ---------------

function normalize(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function extractEntities(text: string): string[] {
    const found = new Set<string>();
    for (const pattern of MEDICAL_ENTITY_PATTERNS) {
        const matches = text.matchAll(pattern);
        for (const m of matches) {
            found.add(m[0].toLowerCase());
        }
    }
    return Array.from(found);
}
