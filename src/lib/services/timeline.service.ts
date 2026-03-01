// ============================================================
// Health Timeline Service
// Manages chronological health records with encryption + FHIR
// ============================================================

import { uploadEncryptedBlob, downloadEncryptedBlob, getDocumentKey, getOriginalPhotoKey } from "../aws/s3";
import * as healthlake from "../aws/healthlake";
import { serializeBlob, deserializeBlob, encrypt, decrypt, encryptString } from "../crypto/aesGcm";
import { logAccess, patientActor } from "./audit.service";
import { processDocument, toFhirBundle, generatePreview } from "./medvision.service";
import type {
    HealthEntry,
    TimelineRequest,
    TimelineResponse,
    StatusFlag,
    DocumentTypeTag,
} from "../types/timeline";
import type { ExtractionPreview } from "../types/medvision";
import { v4 as uuidv4 } from "uuid";

/**
 * Uploads a document photo, processes it through Med-Vision,
 * encrypts everything, and returns an extraction preview.
 */
export async function uploadAndProcess(
    imageBuffer: ArrayBuffer,
    patientId: string,
    masterKey: CryptoKey
): Promise<{ entryId: string; preview: ExtractionPreview }> {
    const entryId = uuidv4();

    // 1. Encrypt the original photo and upload to S3
    const encryptedPhoto = await encrypt(imageBuffer, masterKey);
    const photoKey = getOriginalPhotoKey(patientId, entryId);
    await uploadEncryptedBlob(photoKey, serializeBlob(encryptedPhoto));

    // 2. Run Med-Vision pipeline (OCR + entity extraction)
    const extraction = await processDocument(imageBuffer, patientId);

    // 3. Generate preview for user confirmation
    const preview = generatePreview(extraction, [photoKey]);

    // 4. Log the upload
    await logAccess(
        patientId,
        "DOCUMENT_UPLOAD",
        patientActor(patientId, patientId),
        { entryId, confidence: String(extraction.overallConfidence) }
    );

    return { entryId, preview };
}

/**
 * Confirms an extraction and saves it as a timeline entry.
 * Called after the user reviews and approves the AI extraction.
 */
export async function confirmAndSave(
    entryId: string,
    patientId: string,
    masterKey: CryptoKey,
    preview: ExtractionPreview,
    userEdits?: Record<string, string>,
    documentDate?: string
): Promise<HealthEntry> {
    const extraction = preview.extractionResult;
    const date = documentDate || extraction.clinicalEntities.date || new Date().toISOString();

    // 1. Convert to FHIR and store in HealthLake
    const docKey = getDocumentKey(patientId, entryId);
    const fhirBundle = toFhirBundle(extraction, patientId, date, docKey);
    const fhirResourceIds: string[] = [];

    if (fhirBundle.entry) {
        for (const entry of fhirBundle.entry) {
            const created = await healthlake.createFhirResource(
                entry.resource.resourceType,
                entry.resource as unknown as Record<string, unknown>
            );
            if (created.id) fhirResourceIds.push(created.id as string);
        }
    }

    // 2. Build the timeline entry
    const statusFlags: StatusFlag[] = [];
    if (extraction.overallConfidence >= 70) statusFlags.push("AI-READ");
    if (extraction.clinicalEntities.medications.some(
        (m) => m.name.toLowerCase().includes("warfarin") ||
            m.name.toLowerCase().includes("insulin")
    )) {
        statusFlags.push("CRITICAL");
    }

    const healthEntry: HealthEntry = {
        entryId,
        patientId,
        title: extraction.suggestedTitle,
        documentType: extraction.suggestedDocumentType,
        statusFlags,
        sourceInstitution: extraction.clinicalEntities.institutionName,
        doctorName: extraction.clinicalEntities.doctorName,
        date,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        encryptedBlobKey: docKey,
        fhirResourceIds,
        confidenceScore: extraction.overallConfidence,
        addedBy: { type: "PATIENT", userId: patientId, name: patientId },
        metadata: {
            medications: extraction.clinicalEntities.medications.map((m) => ({ name: m.name })),
            diagnoses: extraction.clinicalEntities.diagnoses.map((d) => d.name),
            labTests: extraction.clinicalEntities.labResults.map((l) => ({ name: l.testName })),
        },
    };

    // 3. Encrypt and store the entry metadata
    const encryptedEntry = await encryptString(
        JSON.stringify(healthEntry),
        masterKey
    );
    await uploadEncryptedBlob(docKey, serializeBlob(encryptedEntry));

    // 4. Log the save
    await logAccess(
        patientId,
        "AI_EXTRACTION",
        patientActor(patientId, patientId),
        { entryId, documentType: healthEntry.documentType }
    );

    return healthEntry;
}

/**
 * Retrieves timeline entries for a patient from DynamoDB.
 * Uses /api/timeline/entries — HealthLake is NOT available in ap-south-1.
 */
export async function getTimeline(
    request: TimelineRequest,
    _masterKey: CryptoKey
): Promise<TimelineResponse> {
    const params = new URLSearchParams({ patientId: request.patientId });

    const res = await fetch(`/api/timeline/entries?${params.toString()}`);
    if (!res.ok) {
        const text = await res.text();
        let msg = `Timeline fetch failed (${res.status})`;
        try { msg = JSON.parse(text).error ?? msg; } catch { /* not JSON */ }
        throw new Error(msg);
    }

    const data = await res.json();
    const entries: HealthEntry[] = data.entries ?? [];

    // Apply client-side filters
    let filtered = entries;
    if (request.filters?.documentTypes?.length) {
        filtered = filtered.filter((e) =>
            request.filters!.documentTypes!.includes(e.documentType)
        );
    }
    if (request.filters?.dateFrom) {
        filtered = filtered.filter((e) => e.date >= request.filters!.dateFrom!);
    }
    if (request.filters?.dateTo) {
        filtered = filtered.filter((e) => e.date <= request.filters!.dateTo!);
    }

    // Pagination
    const page = request.options.page ?? 1;
    const pageSize = request.options.pageSize ?? 20;
    const start = (page - 1) * pageSize;
    const paged = filtered.slice(start, start + pageSize);

    return {
        entries: paged,
        totalCount: filtered.length,
        page,
        pageSize,
        hasMore: start + pageSize < filtered.length,
    };
}


/**
 * Views a single timeline entry by decrypting its stored data.
 */
export async function getEntry(
    patientId: string,
    entryId: string,
    masterKey: CryptoKey
): Promise<HealthEntry> {
    const key = getDocumentKey(patientId, entryId);
    const serialized = await downloadEncryptedBlob(key);
    const blob = deserializeBlob(serialized);
    const decrypted = await decrypt(blob, masterKey);
    const text = new TextDecoder().decode(decrypted);

    await logAccess(
        patientId,
        "DOCUMENT_VIEW",
        patientActor(patientId, patientId),
        { entryId }
    );

    return JSON.parse(text) as HealthEntry;
}
