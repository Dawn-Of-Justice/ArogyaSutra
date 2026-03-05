// ============================================================
// Agentic RAG — Enhanced Retriever
// Fetches patient contexts from HealthLake + DynamoDB health
// records table and scores them using keyword overlap + recency.
// ============================================================

import * as healthlake from "../aws/healthlake";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { ScoredContext, RetrievalOptions } from "./types";

const _region = process.env.NEXT_PUBLIC_AWS_REGION || process.env.APP_AWS_REGION || "ap-south-1";
const _creds =
    process.env.APP_AWS_ACCESS_KEY_ID && process.env.APP_AWS_SECRET_ACCESS_KEY
        ? { credentials: { accessKeyId: process.env.APP_AWS_ACCESS_KEY_ID, secretAccessKey: process.env.APP_AWS_SECRET_ACCESS_KEY } }
        : {};
const _dynamoClient = new DynamoDBClient({ region: _region, ..._creds });
const _db = DynamoDBDocumentClient.from(_dynamoClient);
const HEALTH_RECORDS_TABLE = process.env.DYNAMODB_HEALTH_RECORDS_TABLE || "arogyasutra-health-records";

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
        // DynamoDB entries pre-build a rich _content string; FHIR resources use JSON serialisation
        const content = ((r._content as string) || JSON.stringify(r)).slice(0, 1200);
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
        const docType = (r.resourceType as string) || "UNKNOWN";

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
    // Fetch DynamoDB (primary) and HealthLake (FHIR) in parallel; both are best-effort
    const [dynamoResults, healthlakeResults] = await Promise.all([
        fetchDynamoRecords(patientId),
        // HealthLake with timeout guard — cap at 8 s
        Promise.race([
            healthlake.getPatientTimeline(patientId) as Promise<Record<string, unknown>[]>,
            new Promise<Record<string, unknown>[]>((resolve) =>
                setTimeout(() => resolve([]), 8_000)
            ),
        ]).catch(() => [] as Record<string, unknown>[]),
    ]);

    // DynamoDB entries are authoritative; deduplicate any HealthLake FHIR resources by id
    const seen = new Set<string>(dynamoResults.map((r) => r.id as string).filter(Boolean));
    const merged: Record<string, unknown>[] = [...dynamoResults];
    for (const r of healthlakeResults) {
        const rid = r.id as string;
        if (!rid || !seen.has(rid)) {
            merged.push(r);
            if (rid) seen.add(rid);
        }
    }
    return merged;
}

/** Fetch all timeline entries for a patient directly from DynamoDB health-records table. */
async function fetchDynamoRecords(patientId: string): Promise<Record<string, unknown>[]> {
    try {
        const result = await _db.send(
            new QueryCommand({
                TableName: HEALTH_RECORDS_TABLE,
                KeyConditionExpression: "patientId = :pid",
                ExpressionAttributeValues: { ":pid": patientId },
                ScanIndexForward: false,
            })
        );
        return (result.Items ?? []).map((item) => {
            const meta: Record<string, unknown> = (item.metadata as Record<string, unknown>) ?? {};
            // Build rich content from structured metadata for better keyword matching
            const parts: string[] = [];
            if (meta.summary) parts.push(`Summary: ${meta.summary}`);
            if (meta.rawText) parts.push((meta.rawText as string).slice(0, 800));
            if (Array.isArray(meta.medications) && meta.medications.length)
                parts.push(`Medications: ${(meta.medications as { name?: string }[]).map((m) => m.name).filter(Boolean).join(", ")}`);
            if (Array.isArray(meta.diagnoses) && meta.diagnoses.length)
                parts.push(`Diagnoses: ${(meta.diagnoses as string[]).join(", ")}`);
            if (Array.isArray(meta.labTests) && meta.labTests.length)
                parts.push(`Lab Tests: ${(meta.labTests as { name?: string; value?: string; unit?: string; status?: string }[]).map((t) => `${t.name}: ${t.value ?? ""}${t.unit ?? ""} (${t.status ?? ""})`).join(", ")}`);
            if (meta.findings) parts.push(`Findings: ${meta.findings}`);
            if (meta.impression) parts.push(`Impression: ${meta.impression}`);
            if (meta.chiefComplaint) parts.push(`Chief Complaint: ${meta.chiefComplaint}`);
            if (meta.treatmentPlan) parts.push(`Treatment Plan: ${meta.treatmentPlan}`);
            if (Array.isArray(meta.allergies) && meta.allergies.length)
                parts.push(`Allergies: ${(meta.allergies as string[]).join(", ")}`);
            if (Array.isArray(meta.vitals) && meta.vitals.length)
                parts.push(`Vitals: ${JSON.stringify(meta.vitals).slice(0, 200)}`);
            if (meta.dischargeInstructions) parts.push(`Discharge Instructions: ${meta.dischargeInstructions}`);
            if (Array.isArray(meta.advice) && meta.advice.length)
                parts.push(`Advice: ${(meta.advice as string[]).join("; ")}`);

            return {
                id: item.entryId as string,
                resourceType: item.documentType as string,
                description: item.title as string,
                date: item.date as string,
                _content: parts.join("\n").slice(0, 1500),
                _institution: item.sourceInstitution,
                _doctor: item.doctorName,
                _isDynamo: true,
            };
        });
    } catch (err) {
        console.warn("[retriever] DynamoDB fetch failed:", (err as Error).message);
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
