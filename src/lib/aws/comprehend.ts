// ============================================================
// Amazon Comprehend Medical Integration
// Medical entity extraction from OCR text
// ============================================================

import {
    ComprehendMedicalClient,
    DetectEntitiesV2Command,
    type Entity,
} from "@aws-sdk/client-comprehendmedical";
import type {
    ClinicalEntities,
    Medication,
    Diagnosis,
    LabResult,
    VitalSign,
    Procedure,
    AnatomyMention,
} from "../types/medvision";

// Amplify blocks "AWS_" prefix env vars — use APP_AWS_* workaround.
// Falls back to default credential chain (IAM role / local ~/.aws).
const _appCreds =
    process.env.APP_AWS_ACCESS_KEY_ID && process.env.APP_AWS_SECRET_ACCESS_KEY
        ? { credentials: { accessKeyId: process.env.APP_AWS_ACCESS_KEY_ID, secretAccessKey: process.env.APP_AWS_SECRET_ACCESS_KEY } }
        : {};


const region = process.env.NEXT_PUBLIC_AWS_REGION || "ap-south-1";
const comprehendClient = new ComprehendMedicalClient({ region, ..._appCreds });

/**
 * Detects medical entities from text using Comprehend Medical.
 *
 * @param text  Full text from OCR
 * @returns     Structured clinical entities
 */
export async function detectMedicalEntities(
    text: string
): Promise<ClinicalEntities> {
    const result = await comprehendClient.send(
        new DetectEntitiesV2Command({ Text: text })
    );

    const entities = result.Entities || [];

    return {
        medications: extractMedications(entities),
        diagnoses: extractDiagnoses(entities),
        labResults: extractLabResults(entities),
        vitals: extractVitals(entities),
        procedures: extractProcedures(entities),
        anatomyMentions: extractAnatomy(entities),
        doctorName: extractAttribute(entities, "NAME"),
        institutionName: extractAttribute(entities, "ADDRESS"),
        date: extractAttribute(entities, "DATE"),
        overallConfidence: calculateOverallConfidence(entities),
    };
}

function extractMedications(entities: Entity[]): Medication[] {
    return entities
        .filter((e) => e.Category === "MEDICATION")
        .map((e) => {
            const attrs = e.Attributes || [];
            return {
                name: e.Text || "",
                dosage: findAttribute(attrs, "DOSAGE"),
                frequency: findAttribute(attrs, "FREQUENCY"),
                route: findAttribute(attrs, "ROUTE_OR_MODE"),
                duration: findAttribute(attrs, "DURATION"),
                confidence: (e.Score || 0) * 100,
            };
        });
}

function extractDiagnoses(entities: Entity[]): Diagnosis[] {
    return entities
        .filter(
            (e) =>
                e.Category === "MEDICAL_CONDITION" &&
                e.Type === "DX_NAME"
        )
        .map((e) => {
            const attrs = e.Attributes || [];
            return {
                name: e.Text || "",
                icdCode: findAttribute(attrs, "ICD_CODE"),
                status: parseConditionStatus(findAttribute(attrs, "ACUITY")),
                confidence: (e.Score || 0) * 100,
            };
        });
}

function extractLabResults(entities: Entity[]): LabResult[] {
    return entities
        .filter(
            (e) =>
                e.Category === "TEST_TREATMENT_PROCEDURE" &&
                e.Type === "TEST_NAME"
        )
        .map((e) => {
            const attrs = e.Attributes || [];
            const value = findAttribute(attrs, "TEST_VALUE") || "";
            const unit = findAttribute(attrs, "TEST_UNIT") || "";
            return {
                testName: e.Text || "",
                value,
                unit,
                referenceRange: findAttribute(attrs, "REFERENCE_RANGE"),
                isAbnormal: undefined,
                confidence: (e.Score || 0) * 100,
            };
        });
}

function extractVitals(entities: Entity[]): VitalSign[] {
    return entities
        .filter(
            (e) =>
                e.Category === "TEST_TREATMENT_PROCEDURE" &&
                isVitalSign(e.Text || "")
        )
        .map((e) => {
            const attrs = e.Attributes || [];
            return {
                type: normalizeVitalType(e.Text || ""),
                value: findAttribute(attrs, "TEST_VALUE") || e.Text || "",
                unit: findAttribute(attrs, "TEST_UNIT") || "",
                confidence: (e.Score || 0) * 100,
            };
        });
}

function extractProcedures(entities: Entity[]): Procedure[] {
    return entities
        .filter(
            (e) =>
                e.Category === "TEST_TREATMENT_PROCEDURE" &&
                e.Type === "PROCEDURE_NAME"
        )
        .map((e) => ({
            name: e.Text || "",
            date: undefined,
            outcome: undefined,
            confidence: (e.Score || 0) * 100,
        }));
}

function extractAnatomy(entities: Entity[]): AnatomyMention[] {
    return entities
        .filter((e) => e.Category === "ANATOMY")
        .map((e) => ({
            name: e.Text || "",
            system: e.Type || "unknown",
            confidence: (e.Score || 0) * 100,
        }));
}

// ---- Helpers ----

function findAttribute(
    attrs: { Type?: string; Text?: string }[],
    type: string
): string | undefined {
    return attrs.find((a) => a.Type === type)?.Text;
}

function extractAttribute(
    entities: Entity[],
    type: string
): string | undefined {
    const entity = entities.find((e) => e.Type === type);
    return entity?.Text;
}

function calculateOverallConfidence(entities: Entity[]): number {
    if (entities.length === 0) return 0;
    const sum = entities.reduce((acc, e) => acc + (e.Score || 0), 0);
    return Math.round((sum / entities.length) * 10000) / 100;
}

function parseConditionStatus(
    acuity?: string
): "active" | "resolved" | "unknown" {
    if (!acuity) return "unknown";
    const lower = acuity.toLowerCase();
    if (lower.includes("chronic") || lower.includes("active")) return "active";
    if (lower.includes("resolved") || lower.includes("past")) return "resolved";
    return "unknown";
}

const VITAL_KEYWORDS = [
    "blood pressure",
    "bp",
    "heart rate",
    "pulse",
    "temperature",
    "spo2",
    "oxygen",
    "weight",
    "height",
    "bmi",
    "blood sugar",
    "glucose",
];

function isVitalSign(text: string): boolean {
    const lower = text.toLowerCase();
    return VITAL_KEYWORDS.some((kw) => lower.includes(kw));
}

function normalizeVitalType(text: string): string {
    const lower = text.toLowerCase();
    if (lower.includes("blood pressure") || lower.includes("bp"))
        return "blood_pressure";
    if (lower.includes("heart rate") || lower.includes("pulse"))
        return "heart_rate";
    if (lower.includes("temperature")) return "temperature";
    if (lower.includes("spo2") || lower.includes("oxygen")) return "spo2";
    if (lower.includes("weight")) return "weight";
    if (lower.includes("height")) return "height";
    if (lower.includes("bmi")) return "bmi";
    if (lower.includes("sugar") || lower.includes("glucose"))
        return "blood_sugar";
    return text.toLowerCase().replace(/\s+/g, "_");
}
