// ============================================================
// MedVision Service
// Document digitization: Camera → OCR → Entity Extraction → FHIR
// ============================================================

import { analyzeDocument } from "../aws/textract";
import { detectMedicalEntities } from "../aws/comprehend";
import { convertToFhirBundle } from "../fhir/converter";
import { validateBundle } from "../fhir/validator";
import type {
    OCRResult,
    ClinicalEntities,
    ExtractionResult,
    ExtractionPreview,
    EditableField,
} from "../types/medvision";
import type { DocumentTypeTag } from "../types/timeline";
import type { FHIRBundle } from "../fhir/types";

const CONFIDENCE_THRESHOLD = 70; // Below this → requiresReview = true

/**
 * Full Med-Vision pipeline:
 * 1. OCR with Textract
 * 2. Entity extraction with Comprehend Medical
 * 3. FHIR conversion
 * 4. Confidence scoring
 *
 * @param imageBuffer  Document photo as ArrayBuffer
 * @param patientId    Patient FHIR ID
 * @returns            Extraction result with confidence
 */
export async function processDocument(
    imageBuffer: ArrayBuffer,
    patientId: string
): Promise<ExtractionResult> {
    // Step 1: OCR
    const ocrResult = await analyzeDocument(imageBuffer);

    // Step 2: Entity extraction
    const clinicalEntities = await detectMedicalEntities(ocrResult.fullText);

    // Step 3: Calculate overall confidence
    const overallConfidence = calculateOverallConfidence(
        ocrResult,
        clinicalEntities
    );

    // Step 4: Suggest document type
    const suggestedType = inferDocumentType(clinicalEntities);

    // Step 5: Suggest title
    const suggestedTitle = generateTitle(clinicalEntities, suggestedType);

    return {
        ocrResult,
        clinicalEntities,
        overallConfidence,
        requiresReview: overallConfidence < CONFIDENCE_THRESHOLD,
        suggestedDocumentType: suggestedType,
        suggestedTitle,
        extractedAt: new Date().toISOString(),
    };
}

/**
 * Converts extraction result to FHIR bundle for HealthLake storage.
 */
export function toFhirBundle(
    extraction: ExtractionResult,
    patientId: string,
    documentDate: string,
    s3Key?: string
): FHIRBundle {
    const bundle = convertToFhirBundle(
        extraction.clinicalEntities,
        patientId,
        documentDate,
        s3Key
    );

    const validation = validateBundle(bundle);
    if (!validation.isValid) {
        console.warn(
            "FHIR validation warnings:",
            validation.errors.filter((e) => e.severity === "error")
        );
    }

    return bundle;
}

/**
 * Generates the extraction preview for user confirmation.
 */
export function generatePreview(
    extraction: ExtractionResult,
    originalImageKeys: string[]
): ExtractionPreview {
    const editableFields: EditableField[] = [];

    // Doctor name
    if (extraction.clinicalEntities.doctorName) {
        editableFields.push({
            fieldName: "Doctor Name",
            extractedValue: extraction.clinicalEntities.doctorName,
            confidence: extraction.ocrResult.overallConfidence,
            category: "metadata",
        });
    }

    // Institution
    if (extraction.clinicalEntities.institutionName) {
        editableFields.push({
            fieldName: "Institution",
            extractedValue: extraction.clinicalEntities.institutionName,
            confidence: extraction.ocrResult.overallConfidence,
            category: "metadata",
        });
    }

    // Medications
    for (const med of extraction.clinicalEntities.medications) {
        editableFields.push({
            fieldName: `Medication: ${med.name}`,
            extractedValue: [med.dosage, med.frequency, med.route]
                .filter(Boolean)
                .join(", "),
            confidence: med.confidence,
            category: "medication",
        });
    }

    // Diagnoses
    for (const diag of extraction.clinicalEntities.diagnoses) {
        editableFields.push({
            fieldName: `Diagnosis: ${diag.name}`,
            extractedValue: `${diag.status}${diag.icdCode ? ` (${diag.icdCode})` : ""}`,
            confidence: diag.confidence,
            category: "diagnosis",
        });
    }

    // Lab results
    for (const lab of extraction.clinicalEntities.labResults) {
        editableFields.push({
            fieldName: `Lab: ${lab.testName}`,
            extractedValue: `${lab.value} ${lab.unit}`,
            confidence: lab.confidence,
            category: "lab",
        });
    }

    // Vitals
    for (const vital of extraction.clinicalEntities.vitals) {
        editableFields.push({
            fieldName: `Vital: ${vital.type}`,
            extractedValue: `${vital.value} ${vital.unit}`,
            confidence: vital.confidence,
            category: "vital",
        });
    }

    return {
        extractionResult: extraction,
        originalImageKeys,
        editableFields,
    };
}

// ---- Internal Helpers ----

function calculateOverallConfidence(
    ocr: OCRResult,
    entities: ClinicalEntities
): number {
    // Weighted average: 40% OCR, 60% entity extraction
    return Math.round(ocr.overallConfidence * 0.4 + entities.overallConfidence * 0.6);
}

function inferDocumentType(entities: ClinicalEntities): DocumentTypeTag {
    if (entities.medications.length > 0 && entities.diagnoses.length > 0)
        return "RX";
    if (entities.labResults.length > 0) return "Lab";
    if (entities.procedures.length > 0) return "H";
    if (entities.vitals.length > 0) return "Consult";
    return "Other";
}

function generateTitle(
    entities: ClinicalEntities,
    type: DocumentTypeTag
): string {
    const parts: string[] = [];

    if (entities.institutionName) parts.push(entities.institutionName);

    switch (type) {
        case "RX":
            parts.push("Prescription");
            if (entities.diagnoses[0]) parts.push(`- ${entities.diagnoses[0].name}`);
            break;
        case "Lab":
            parts.push("Lab Report");
            if (entities.labResults[0])
                parts.push(`- ${entities.labResults[0].testName}`);
            break;
        case "H":
            parts.push("Hospital Record");
            break;
        case "Consult":
            parts.push("Consultation");
            break;
        default:
            parts.push("Medical Document");
    }

    return parts.join(" ");
}
