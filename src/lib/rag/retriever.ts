// ============================================================
// Agentic RAG — Enhanced Retriever
// Fetches patient contexts from HealthLake and scores them
// using keyword overlap + recency weighting.
// ============================================================

import * as healthlake from "../aws/healthlake";
import type { ScoredContext, RetrievalOptions } from "./types";

const DEFAULT_OPTIONS: RetrievalOptions = {
    topK: 12,
    minScore: 0.1,
    recencyWeight: 0.25,
};

// --------------- Public API ---------------

/**
 * Retrieve and rank health records relevant to the query.
 */
export async function retrieve(
    patientId: string,
    query: string,
    options: Partial<RetrievalOptions> = {}
): Promise<ScoredContext[]> {
    const opts: RetrievalOptions = { ...DEFAULT_OPTIONS, ...options };

    const resources = await fetchAllResources(patientId);
    if (resources.length === 0) return [];

    const queryTokens = tokenize(query);
    const now = Date.now();
    const oldest = findOldestTimestamp(resources);
    const ageRange = now - oldest || 1;

    const scored: ScoredContext[] = resources.map((r) => {
        const content = JSON.stringify(r).slice(0, 600);
        const title =
            (r.description as string) ||
            (r.code as { text?: string })?.text ||
            (r.resourceType as string) ||
            "";
        const date =
            (r.effectiveDateTime as string) ||
            (r.date as string) ||
            (r.recordedDate as string) ||
            (r.onsetDateTime as string) ||
            "";
        const docType = r.resourceType as string;

        const keywordScore = computeKeywordScore(queryTokens, tokenize(title + " " + content));
        const recencyScore = computeRecencyScore(date, now, ageRange);
        const score =
            (1 - opts.recencyWeight) * keywordScore + opts.recencyWeight * recencyScore;

        return {
            entryId: (r.id as string) || `res-${Math.random().toString(36).slice(2)}`,
            title,
            date,
            content,
            documentType: docType,
            score,
            keywordScore,
            recencyScore,
        };
    });

    return scored
        .filter((c) => {
            if (c.score < opts.minScore) return false;
            if (opts.docTypeFilter && opts.docTypeFilter.length > 0) {
                return opts.docTypeFilter.includes(c.documentType);
            }
            return true;
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, opts.topK);
}

/**
 * Re-retrieve with a refined query (used by corrective/reflective modules).
 */
export async function retrieveRefined(
    patientId: string,
    originalContexts: ScoredContext[],
    refinedQuery: string,
    topK = 8
): Promise<ScoredContext[]> {
    const fresh = await retrieve(patientId, refinedQuery, { topK });
    // Merge: fresh results first, then add originals not already included
    const seen = new Set(fresh.map((c) => c.entryId));
    const merged = [...fresh];
    for (const ctx of originalContexts) {
        if (!seen.has(ctx.entryId) && merged.length < topK * 2) {
            merged.push(ctx);
            seen.add(ctx.entryId);
        }
    }
    return merged.slice(0, topK);
}

// --------------- Helpers ---------------

async function fetchAllResources(patientId: string): Promise<Record<string, unknown>[]> {
    try {
        // Timeout guard — HealthLake latency can spike; cap at 8 s to leave room for LLM
        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("HealthLake timeout")), 8_000)
        );
        const result = await Promise.race([
            healthlake.getPatientTimeline(patientId) as Promise<Record<string, unknown>[]>,
            timeoutPromise,
        ]);
        return result;
    } catch {
        return [];
    }
}

function tokenize(text: string): Set<string> {
    return new Set(
        text
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, " ")
            .split(/\s+/)
            .filter((t) => t.length > 2 && !STOP_WORDS.has(t))
    );
}

function computeKeywordScore(queryTokens: Set<string>, docTokens: Set<string>): number {
    if (queryTokens.size === 0) return 0;
    let hits = 0;
    for (const token of queryTokens) {
        if (docTokens.has(token)) hits++;
    }
    // Jaccard-ish: hits / union size, but capped for clinical terms
    const union = queryTokens.size + docTokens.size - hits;
    return union === 0 ? 0 : hits / Math.sqrt(union);
}

function computeRecencyScore(
    dateStr: string,
    now: number,
    ageRange: number
): number {
    if (!dateStr) return 0.3;
    const ts = Date.parse(dateStr);
    if (isNaN(ts)) return 0.3;
    return Math.max(0, (ts - (now - ageRange)) / ageRange);
}

function findOldestTimestamp(resources: Record<string, unknown>[]): number {
    let oldest = Date.now();
    for (const r of resources) {
        const dateStr =
            (r.effectiveDateTime as string) ||
            (r.date as string) ||
            (r.recordedDate as string) ||
            "";
        const ts = Date.parse(dateStr);
        if (!isNaN(ts) && ts < oldest) oldest = ts;
    }
    return oldest;
}

const STOP_WORDS = new Set([
    "the", "and", "for", "are", "was", "has", "have", "that", "with",
    "this", "from", "but", "not", "you", "all", "can", "had", "his",
    "her", "she", "they", "what", "when", "who", "will", "would",
    "been", "than", "then", "into", "your", "our",
]);
