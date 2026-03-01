// ============================================================
// Document Extraction Service
// Textract OCR + Comprehend Medical entity extraction
// + rule-based document classification
// ============================================================

import {
    TextractClient,
    DetectDocumentTextCommand,
    type Block,
} from "@aws-sdk/client-textract";
import {
    ComprehendMedicalClient,
    DetectEntitiesV2Command,
} from "@aws-sdk/client-comprehendmedical";
import sharp from "sharp";
import type { DocumentTypeTag } from "../types/timeline";

const region = process.env.NEXT_PUBLIC_AWS_REGION || "ap-south-1";

const creds =
    process.env.APP_AWS_ACCESS_KEY_ID && process.env.APP_AWS_SECRET_ACCESS_KEY
        ? {
            credentials: {
                accessKeyId: process.env.APP_AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.APP_AWS_SECRET_ACCESS_KEY,
            },
        }
        : {};

const textractClient = new TextractClient({ region, ...creds });

// Comprehend Medical is only available in certain regions — fall back to us-east-1
const cmRegion = ["us-east-1", "us-east-2", "us-west-2", "eu-west-1", "ap-southeast-2"].includes(region)
    ? region
    : "us-east-1";
const comprehendClient = new ComprehendMedicalClient({ region: cmRegion, ...creds });

// ---- Types --------------------------------------------------------

export interface ExtractionResult {
    rawText: string;
    documentType: DocumentTypeTag;
    confidence: number; // 0-100
    title: string;
    metadata: {
        medications: string[];
        diagnoses: string[];
        labTests: string[];
        doctors: string[];
        institutions: string[];
        dates: string[];
    };
}

// ---- Textract OCR -------------------------------------------------

/**
 * Normalize any browser-uploaded image (WebP, JPEG, PNG, TIFF, BMP, GIF)
 * to a JPEG buffer that Textract accepts.
 */
async function toJpegBuffer(imageBytes: Buffer): Promise<Buffer> {
    return sharp(imageBytes)
        .jpeg({ quality: 92 })
        .toBuffer();
}

/** Extract raw text from image bytes using Textract DetectDocumentText */
export async function extractTextFromImage(imageBytes: Buffer): Promise<string> {
    // Normalize to JPEG — Textract sync API only accepts JPEG/PNG
    const jpegBytes = await toJpegBuffer(imageBytes);

    const cmd = new DetectDocumentTextCommand({
        Document: { Bytes: jpegBytes },
    });

    const result = await textractClient.send(cmd);
    const blocks: Block[] = result.Blocks ?? [];

    const lines = blocks
        .filter((b) => b.BlockType === "LINE" && b.Text)
        .map((b) => b.Text as string);

    return lines.join("\n");
}

// ---- Comprehend Medical entity extraction ------------------------

interface MedicalEntities {
    medications: string[];
    diagnoses: string[];
    labTests: string[];
}

async function extractMedicalEntities(text: string): Promise<MedicalEntities> {
    // Comprehend Medical has a 20,000 character limit
    const truncated = text.slice(0, 19500);

    try {
        const cmd = new DetectEntitiesV2Command({ Text: truncated });
        const result = await comprehendClient.send(cmd);
        const entities = result.Entities ?? [];

        const medications: string[] = [];
        const diagnoses: string[] = [];
        const labTests: string[] = [];

        for (const entity of entities) {
            if (!entity.Text || (entity.Score ?? 0) < 0.7) continue;
            switch (entity.Category) {
                case "MEDICATION":
                    medications.push(entity.Text);
                    break;
                case "MEDICAL_CONDITION":
                    diagnoses.push(entity.Text);
                    break;
                case "TEST_TREATMENT_PROCEDURE":
                    labTests.push(entity.Text);
                    break;
            }
        }

        return {
            medications: [...new Set(medications)],
            diagnoses: [...new Set(diagnoses)],
            labTests: [...new Set(labTests)],
        };
    } catch {
        // Comprehend Medical unavailable in region — return empty
        return { medications: [], diagnoses: [], labTests: [] };
    }
}

// ---- Rule-based document classifier ------------------------------

interface ClassifyResult {
    documentType: DocumentTypeTag;
    confidence: number;
    title: string;
}

const CLASSIFICATION_RULES: Array<{
    type: DocumentTypeTag;
    weight: number;
    patterns: RegExp[];
}> = [
        {
            type: "RX",
            weight: 10,
            patterns: [
                /\bprescri(ption|bed|be)\b/i,
                /\brx\b/i,
                /\btablet|capsule|syrup|injection|mg|ml\b/i,
                /\bdosage|dose|twice daily|once daily|sos|od|bd|tds|qid\b/i,
                /\bRefill|Dispense|Sig:/i,
            ],
        },
        {
            type: "Lab",
            weight: 10,
            patterns: [
                /\blab(oratory)?\b/i,
                /\btest report|blood report|urine report|pathology\b/i,
                /\bHbA1c|CBC|hemoglobin|platelet|WBC|RBC|creatinine|glucose|cholesterol\b/i,
                /\bNormal Range|Reference Range|Result:/i,
                /\bPatholog(ist|y)|Clinical Lab\b/i,
            ],
        },
        {
            type: "H",
            weight: 10,
            patterns: [
                /\bhospital|discharge summary|admission|inpatient|IPD\b/i,
                /\bdischarge date|date of admission|ward|bed no\b/i,
                /\boperation|surgery|procedure|post-op|anaesthe\b/i,
            ],
        },
        {
            type: "Consult",
            weight: 10,
            patterns: [
                /\bconsult(ation|ant)?\b/i,
                /\bOPD|outpatient|clinic visit|follow.?up\b/i,
                /\bchiefComplaint|chief complaint|presenting complaint\b/i,
                /\badvice|advised|review after\b/i,
            ],
        },
        {
            type: "Imaging",
            weight: 10,
            patterns: [
                /\bx.?ray|mri|ct scan|ultrasound|sonography|mammogram|pet scan\b/i,
                /\bradiology|imaging|radiolog(ist|y)\b/i,
                /\bimpression:|findings:|no fracture|no lesion\b/i,
            ],
        },
        {
            type: "Insurance",
            weight: 10,
            patterns: [
                /\binsurance|claim|policy|mediclaim|cashless\b/i,
                /\bTPA|third.?party administrator|pre.?auth|pre-authorization\b/i,
                /\bICICILombard|StarHealth|HDFC Ergo|Bajaj Allianz\b/i,
                /\bcoverage|sum insured|deductible\b/i,
            ],
        },
    ];

function classifyDocument(text: string, entities: MedicalEntities): ClassifyResult {
    const scores: Partial<Record<DocumentTypeTag, number>> = {};

    for (const rule of CLASSIFICATION_RULES) {
        let score = 0;
        for (const pattern of rule.patterns) {
            if (pattern.test(text)) score += rule.weight;
        }
        if (score > 0) scores[rule.type] = (scores[rule.type] ?? 0) + score;
    }

    // Boost scores from entities
    if (entities.medications.length > 2) scores["RX"] = (scores["RX"] ?? 0) + 15;
    if (entities.diagnoses.length > 1) scores["Consult"] = (scores["Consult"] ?? 0) + 5;
    if (entities.labTests.length > 2) scores["Lab"] = (scores["Lab"] ?? 0) + 15;

    const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);

    if (sorted.length === 0 || sorted[0][1] < 10) {
        return { documentType: "Other", confidence: 40, title: "Health Document" };
    }

    const [topType, topScore] = sorted[0];
    const confidence = Math.min(95, 40 + topScore * 2);

    const titleMap: Record<DocumentTypeTag, string> = {
        RX: "Prescription",
        Lab: "Lab Report",
        H: "Hospital Discharge Summary",
        Consult: "Consultation Note",
        Imaging: "Imaging Report",
        Insurance: "Insurance Document",
        Vacc: "Vaccination Record",
        Other: "Health Document",
    };

    return {
        documentType: topType as DocumentTypeTag,
        confidence: Math.round(confidence),
        title: titleMap[topType as DocumentTypeTag] ?? "Health Document",
    };
}

// ---- Named entity extraction (non-medical) -----------------------

function extractNamedEntities(text: string) {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

    // Doctor name heuristics — "Dr." prefix
    const drPattern = /Dr\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g;
    const doctors: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = drPattern.exec(text)) !== null) doctors.push(m[1]);

    // Institution — lines that contain "Hospital", "Clinic", "Labs" etc.
    const institutions = lines.filter((l) =>
        /hospital|clinic|diagnostic|labs?|centre|center|medical/i.test(l) && l.length < 80
    );

    // Dates — common formats
    const datePattern = /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-]\d{2}[\/\-]\d{2})\b/g;
    const dates: string[] = [];
    while ((m = datePattern.exec(text)) !== null) dates.push(m[0]);

    return {
        doctors: [...new Set(doctors)].slice(0, 3),
        institutions: [...new Set(institutions)].slice(0, 2),
        dates: [...new Set(dates)].slice(0, 5),
    };
}

// ---- Main entry point --------------------------------------------

export async function analyzeDocument(imageBytes: Buffer): Promise<ExtractionResult> {
    // 1. OCR
    const rawText = await extractTextFromImage(imageBytes);

    // 2. Medical NLP
    const medEntities = await extractMedicalEntities(rawText);

    // 3. Classify
    const { documentType, confidence, title } = classifyDocument(rawText, medEntities);

    // 4. Named entities
    const namedEntities = extractNamedEntities(rawText);

    return {
        rawText,
        documentType,
        confidence,
        title,
        metadata: {
            ...medEntities,
            ...namedEntities,
        },
    };
}
