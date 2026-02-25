// ============================================================
// Data Export Service
// PDF and FHIR JSON exports with client-side decryption
// ============================================================

import * as healthlake from "../aws/healthlake";
import { downloadEncryptedBlob, getDocumentKey } from "../aws/s3";
import { deserializeBlob, decrypt } from "../crypto/aesGcm";
import { logAccess, patientActor } from "./audit.service";
import type { HealthEntry } from "../types/timeline";

/**
 * Exports patient data as a FHIR JSON bundle.
 * All data is decrypted client-side before export.
 *
 * @param patientId  Patient identifier
 * @param entryIds   Specific entries to export (empty = all)
 * @param masterKey  Patient's CryptoKey for decryption
 * @returns          JSON string of FHIR bundle
 */
export async function exportFhirJson(
    patientId: string,
    entryIds: string[],
    masterKey: CryptoKey
): Promise<string> {
    const entries: HealthEntry[] = [];

    for (const entryId of entryIds) {
        const key = getDocumentKey(patientId, entryId);
        const serialized = await downloadEncryptedBlob(key);
        const blob = deserializeBlob(serialized);
        const decrypted = await decrypt(blob, masterKey);
        const text = new TextDecoder().decode(decrypted);
        entries.push(JSON.parse(text));
    }

    // Build FHIR export bundle
    const exportBundle = {
        resourceType: "Bundle",
        type: "collection",
        meta: {
            lastUpdated: new Date().toISOString(),
        },
        total: entries.length,
        entry: entries.map((e) => ({
            fullUrl: `urn:arogyasutra:entry:${e.entryId}`,
            resource: {
                resourceType: "DocumentReference",
                id: e.entryId,
                status: "current",
                type: { text: e.documentType },
                subject: { reference: `Patient/${patientId}` },
                date: e.date,
                description: e.title,
                content: [
                    {
                        attachment: {
                            contentType: "application/json",
                            title: e.title,
                        },
                    },
                ],
                context: {
                    sourceInstitution: e.sourceInstitution,
                    doctorName: e.doctorName,
                    metadata: e.metadata,
                },
            },
        })),
    };

    await logAccess(
        patientId,
        "DATA_EXPORT",
        patientActor(patientId, patientId),
        { format: "FHIR_JSON", entryCount: String(entries.length) }
    );

    return JSON.stringify(exportBundle, null, 2);
}

/**
 * Triggers a browser download of the export data.
 */
export function downloadAsFile(
    content: string,
    filename: string,
    mimeType: string = "application/json"
): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();

    // Clean up after 24 hours
    setTimeout(() => URL.revokeObjectURL(url), 24 * 60 * 60 * 1000);
}
