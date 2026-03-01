// ============================================================
// Document Extraction Service — Deep Multi-Type Parser
// Textract OCR → Comprehend Medical (with attributes) →
// document-type-specific regex parsers → RAG summary
// ============================================================

import {
    TextractClient,
    DetectDocumentTextCommand,
    type Block,
} from "@aws-sdk/client-textract";
import {
    ComprehendMedicalClient,
    DetectEntitiesV2Command,
    type Entity,
} from "@aws-sdk/client-comprehendmedical";
import {
    BedrockRuntimeClient,
    InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import sharp from "sharp";
import type {
    DocumentTypeTag,
    EntryMetadata,
    MedicationDetail,
    LabTestResult,
} from "../types/timeline";

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

// Comprehend Medical is only available in certain regions
const cmRegion = ["us-east-1", "us-east-2", "us-west-2", "eu-west-1", "ap-southeast-2"].includes(region)
    ? region
    : "us-east-1";
const comprehendClient = new ComprehendMedicalClient({ region: cmRegion, ...creds });

// Nova Pro / cross-region inference profiles require us-east-1 or us-west-2
const bedrockRegion = ["us-east-1", "us-west-2"].includes(region) ? region : "us-east-1";
const BEDROCK_MODEL = process.env.BEDROCK_MODEL_ID?.trim() || "us.amazon.nova-pro-v1:0";
const bedrockClient = new BedrockRuntimeClient({ region: bedrockRegion, ...creds });
let bedrockVisionDisabledReason: string | null =
    process.env.DISABLE_BEDROCK_VISION === "true" ? "Disabled by DISABLE_BEDROCK_VISION" : null;

// ── Bedrock Vision — clinical image analysis ────────────────────────

interface VisionAnalysis {
    documentCategory: 'scan' | 'document' | 'unknown'; // is this a medical imaging scan or a text document?
    modality?: string;   // X-Ray, MRI, CT Scan, Ultrasound, etc.
    bodyPart?: string;   // Chest, Abdomen, Right Knee, Brain, etc.
    findings?: string;   // Visible pathology or normal
    impression?: string; // One-line clinical summary
    title: string;       // e.g. "Chest X-Ray – Bilateral Pleural Effusion (Fluid Around Lungs)"
}

async function analyzeImageWithBedrock(jpegBytes: Buffer): Promise<VisionAnalysis | null> {
    if (bedrockVisionDisabledReason) return null;

    const b64 = jpegBytes.toString("base64");
    const prompt = `You are an experienced radiologist and clinician. Look at this image carefully.

First, determine whether this is:
- A medical imaging scan (X-Ray, MRI, CT, Ultrasound, Echo, PET Scan, Mammogram, etc.) → documentCategory: "scan"
- A photo of a medical text document (prescription, lab report, discharge summary, etc.) → documentCategory: "document"
- Unclear → documentCategory: "unknown"

Respond ONLY with a valid JSON object (no markdown, no explanation) in this exact schema:
{
  "documentCategory": "<scan|document|unknown>",
  "modality": "<X-Ray|MRI|CT Scan|Ultrasound|PET Scan|Mammogram|Echo|Other — null if document/unknown>",
  "bodyPart": "<specific body region and laterality, e.g. 'Chest', 'Right Knee', 'Brain', 'Abdomen' — null if not a scan>",
  "findings": "<concise clinical description of what is visually seen — normal structures AND any abnormalities, max 120 words — null if not a scan>",
  "impression": "<one-sentence clinical impression that a doctor would write, describing the key finding in plain English as well as clinical terms, e.g. 'Clear lung fields bilaterally with no consolidation or effusion' or 'Left lower lobe consolidation consistent with pneumonia' — null if not a scan>",
  "title": "<for scans: modality + body part + key finding in BOTH clinical terms AND plain English in parentheses, e.g. 'Chest X-Ray – Clear Lung Fields (Healthy Lungs)' or 'Chest X-Ray – Bilateral Pleural Effusion (Fluid Around Both Lungs)' or 'MRI Right Knee – ACL Tear (Ligament Damage)' or 'CT Brain – Hyperdense Lesion Left Temporal Lobe (Possible Mass)' or 'Ultrasound Abdomen – Cholelithiasis (Gallstones Present)'. For documents: a short descriptive title based on visible text content.>"
}
Always include a title. If it is a document photo and you can read the content, describe it. For scans, always describe what you see in both medical and plain-English terms.`;

    try {
        const body = JSON.stringify({
            messages: [{
                role: "user",
                content: [
                    { image: { format: "jpeg", source: { bytes: b64 } } },
                    { text: prompt },
                ],
            }],
            inferenceConfig: { maxTokens: 512 },
        });

        // 8-second hard timeout — fail fast instead of hanging on billing/access errors
        const abort = new AbortController();
        const timer = setTimeout(() => abort.abort(), 8000);
        let res;
        try {
            res = await bedrockClient.send(new InvokeModelCommand({
                modelId: BEDROCK_MODEL,
                contentType: "application/json",
                accept: "application/json",
                body: Buffer.from(body),
            }), { abortSignal: abort.signal });
        } finally {
            clearTimeout(timer);
        }

        const text = new TextDecoder().decode(res.body);
        const parsed = JSON.parse(text);
        const content = parsed?.output?.message?.content?.[0]?.text ?? parsed?.content?.[0]?.text ?? "";

        // Strip any accidental markdown fences
        const jsonStr = content.replace(/```json\n?|```/g, "").trim();
        const vision: VisionAnalysis = JSON.parse(jsonStr);
        return vision;
    } catch (e) {
        const message = (e as Error).message ?? "Unknown Bedrock error";

        // Circuit breaker for account/subscription issues so uploads don't keep paying retry latency.
        if (
            /INVALID_PAYMENT_INSTRUMENT|AWS Marketplace subscription|Model access is denied|Access denied/i.test(message)
        ) {
            bedrockVisionDisabledReason = message;
            console.warn("[Bedrock vision] disabled for this server session:", message);
            return null;
        }

        console.warn("[Bedrock vision] failed:", message);
        return null;
    }
}

// ── Public result type ───────────────────────────────────────────────

export interface ExtractionResult {
    rawText: string;
    documentType: DocumentTypeTag;
    confidence: number;
    title: string;
    metadata: EntryMetadata;
}

// ── Image normalisation ──────────────────────────────────────────────

async function toJpegBuffer(imageBytes: Buffer): Promise<Buffer> {
    return sharp(imageBytes).jpeg({ quality: 92 }).toBuffer();
}

export async function extractTextFromImage(imageBytes: Buffer): Promise<string> {
    const jpegBytes = await toJpegBuffer(imageBytes);
    const result = await textractClient.send(
        new DetectDocumentTextCommand({ Document: { Bytes: jpegBytes } })
    );
    const blocks: Block[] = result.Blocks ?? [];
    return blocks
        .filter((b) => b.BlockType === "LINE" && b.Text)
        .map((b) => b.Text as string)
        .join("\n");
}

// ── Comprehend Medical — enriched entity extraction ──────────────────

interface ComprehendResult {
    medications: MedicationDetail[];
    diagnoses: string[];
    labEntities: string[];   // raw test/procedure names from Comprehend
    allergies: string[];
    entities: Entity[];      // raw for further processing
}

async function runComprehend(text: string): Promise<ComprehendResult> {
    const truncated = text.slice(0, 19500);
    try {
        const result = await comprehendClient.send(
            new DetectEntitiesV2Command({ Text: truncated })
        );
        const entities: Entity[] = result.Entities ?? [];

        const medications: MedicationDetail[] = [];
        const diagnoses: string[] = [];
        const labEntities: string[] = [];
        const allergies: string[] = [];

        for (const entity of entities) {
            if (!entity.Text || (entity.Score ?? 0) < 0.65) continue;

            switch (entity.Category) {
                case "MEDICATION": {
                    const med: MedicationDetail = { name: entity.Text };
                    for (const attr of entity.Attributes ?? []) {
                        if (!attr.Text) continue;
                        switch (attr.Type) {
                            case "DOSAGE": med.dosage = attr.Text; break;
                            case "FREQUENCY": med.frequency = attr.Text; break;
                            case "DURATION": med.duration = attr.Text; break;
                            case "ROUTE_OR_MODE": med.route = attr.Text; break;
                            case "FORM": if (!med.dosage) med.dosage = attr.Text; break;
                        }
                    }
                    if (!medications.some(m => m.name.toLowerCase() === med.name.toLowerCase())) {
                        medications.push(med);
                    }
                    break;
                }
                case "MEDICAL_CONDITION":
                    if (!diagnoses.includes(entity.Text)) diagnoses.push(entity.Text);
                    break;
                case "TEST_TREATMENT_PROCEDURE":
                    if (!labEntities.includes(entity.Text)) labEntities.push(entity.Text);
                    break;
                case "PROTECTED_HEALTH_INFORMATION":
                    // skip names/dates from PHI
                    break;
            }

            // Check traits for allergy
            if (entity.Traits?.some(t => t.Name === "NEGATION" || t.Name === "HYPOTHETICAL")) continue;
            if (entity.Category === "MEDICATION" && entity.Traits?.some(t => t.Name === "PAST_HISTORY")) {
                // could be allergy context — handled below
            }
        }

        // Allergy detection heuristic
        const allergySection = text.match(/allerg[yi][^\n]{0,200}/gi) ?? [];
        for (const chunk of allergySection) {
            const words = chunk.replace(/allerg[yi]/i, "").trim().split(/[\s,;]+/);
            allergies.push(...words.filter(w => w.length > 2).slice(0, 5));
        }

        return { medications, diagnoses, labEntities, allergies: [...new Set(allergies)], entities };
    } catch {
        return { medications: [], diagnoses: [], labEntities: [], allergies: [], entities: [] };
    }
}

// ── Classification ───────────────────────────────────────────────────

interface ClassifyResult {
    documentType: DocumentTypeTag;
    confidence: number;
}

const RULES: Array<{ type: DocumentTypeTag; patterns: RegExp[] }> = [
    {
        type: "RX",
        patterns: [
            /\bprescri(ption|bed|be)\b/i,
            /\brx\b/i,
            /\b(tablet|capsule|syrup|injection|mg|ml)\b/i,
            /\b(dosage|dose|twice daily|once daily|sos|od|bd|tds|qid)\b/i,
            /\b(Refill|Dispense|Sig:|take|apply)\b/i,
        ],
    },
    {
        type: "Lab",
        patterns: [
            /\blab(oratory)?\b/i,
            /\b(test report|blood report|urine report|pathology)\b/i,
            /\b(HbA1c|CBC|hemoglobin|platelet|WBC|RBC|creatinine|glucose|cholesterol)\b/i,
            /\b(Normal Range|Reference Range|Result:)\b/i,
            /\b(Patholog(ist|y)|Clinical Lab)\b/i,
        ],
    },
    {
        type: "H",
        patterns: [
            /\b(hospital|discharge summary|admission|inpatient|IPD)\b/i,
            /\b(discharge date|date of admission|ward|bed no)\b/i,
            /\b(operation|surgery|procedure|post-op|anaesthe)\b/i,
        ],
    },
    {
        type: "Consult",
        patterns: [
            /\bconsult(ation|ant)?\b/i,
            /\b(OPD|outpatient|clinic visit|follow.?up)\b/i,
            /\b(chief.?complaint|presenting complaint|c\/o)\b/i,
            /\b(advice|advised|review after)\b/i,
        ],
    },
    {
        type: "Imaging",
        patterns: [
            /\b(x.?ray|mri|ct scan|ultrasound|sonography|mammogram|pet scan)\b/i,
            /\b(radiology|imaging|radiolog(ist|y))\b/i,
            /\b(impression:|findings:|no fracture|no lesion)\b/i,
        ],
    },
    {
        type: "Insurance",
        patterns: [
            /\b(insurance|claim|policy|mediclaim|cashless)\b/i,
            /\b(TPA|third.?party|pre.?auth|pre-authorization)\b/i,
            /\b(coverage|sum insured|deductible|premium)\b/i,
        ],
    },
    {
        type: "Vacc",
        patterns: [
            /\b(vaccin(e|ation|ated)|immuniz(e|ation))\b/i,
            /\b(dose|booster|antigen)\b/i,
            /\b(covid|polio|hepatitis|typhoid|flu shot|mmr)\b/i,
        ],
    },
];

function classify(text: string, cm: ComprehendResult, filename = ""): ClassifyResult {
    const scores: Partial<Record<DocumentTypeTag, number>> = {};

    for (const rule of RULES) {
        let s = 0;
        for (const p of rule.patterns) if (p.test(text)) s += 10;
        if (s > 0) scores[rule.type] = (scores[rule.type] ?? 0) + s;
    }

    // Entity boosts
    if (cm.medications.length > 2) scores["RX"] = (scores["RX"] ?? 0) + 15;
    if (cm.diagnoses.length > 1) scores["Consult"] = (scores["Consult"] ?? 0) + 5;
    if (cm.labEntities.length > 2) scores["Lab"] = (scores["Lab"] ?? 0) + 15;

    // Filename hint — strongest signal when text is sparse
    const imagingFilenamePattern = /x.?ray|xr\d|\bmri\b|ct.?scan|ctscan|dxa|dexa|ultrasound|usg|sono|mammo|pet.?scan|radiolog/i;
    if (imagingFilenamePattern.test(filename)) {
        scores["Imaging"] = (scores["Imaging"] ?? 0) + 50;
    }

    const sorted = (Object.entries(scores) as [DocumentTypeTag, number][])
        .sort(([, a], [, b]) => b - a);

    if (!sorted.length || sorted[0][1] < 10) {
        return { documentType: "Other", confidence: 40 };
    }

    const [topType, topScore] = sorted[0];
    return {
        documentType: topType,
        confidence: Math.min(95, Math.round(40 + topScore * 2)),
    };
}

// ── Document-type-specific deep parsers ─────────────────────────────

/** Extract lab test results from raw text lines */
function parseLabResults(text: string): LabTestResult[] {
    const results: LabTestResult[] = [];
    // Pattern: "Test Name   value  unit  (range)"
    // e.g. "Hemoglobin  13.2  g/dL  (13.0-17.0)"
    const pattern = /([A-Za-z][A-Za-z0-9 \-\/()]{2,40})\s{2,}(\d[\d.]*)\s*(g\/dL|mg\/dL|U\/L|mmol\/L|mEq\/L|%|g\/L|x10\^3|x10\^6|IU\/L|ng\/mL|pg\/mL|µg\/dL|µIU\/mL|mL\/min|fL|pg|mm\/hr)?\s*(?:[(\[]?([\d.]+\s*[-–]\s*[\d.]+)[)\]]?)?/gm;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
        const name = m[1].trim();
        const value = m[2].trim();
        const unit = m[3]?.trim();
        const referenceRange = m[4]?.trim();

        // Determine status from reference range
        let status: LabTestResult["status"];
        if (referenceRange && value) {
            const [low, high] = referenceRange.split(/[-–]/).map(Number);
            const val = parseFloat(value);
            if (!isNaN(val) && !isNaN(low) && !isNaN(high)) {
                if (val < low) status = "Low";
                else if (val > high) status = "High";
                else status = "Normal";
            }
        }

        if (name.length > 3 && name.length < 50 && value) {
            results.push({ name, value, unit, referenceRange, status });
        }
    }
    return results;
}

/** Extract imaging modality and body part */
function parseImaging(text: string) {
    const modalityPatterns: [string, RegExp][] = [
        ["X-Ray", /\bx.?ray\b/i],
        ["MRI", /\bmri\b/i],
        ["CT Scan", /\bct.?scan\b/i],
        ["Ultrasound", /\b(ultrasound|sonography|usg)\b/i],
        ["PET Scan", /\bpet.?scan\b/i],
        ["Mammogram", /\bmammogram\b/i],
        ["Echo", /\b(echo|echocardiogram)\b/i],
        ["DEXA", /\bdexa\b/i],
    ];
    let modality: string | undefined;
    for (const [label, pat] of modalityPatterns) {
        if (pat.test(text)) { modality = label; break; }
    }

    // Body part — look for common patterns
    const bodyPartMatch = text.match(
        /\b(chest|spine|lumbar|cervical|thoracic|abdomen|pelvis|skull|brain|knee|shoulder|hip|elbow|wrist|ankle|foot|hand|neck|liver|kidney|thyroid|breast|lung|heart)\b/i
    );
    const bodyPart = bodyPartMatch?.[1];

    // Extract findings block
    const findingsMatch = text.match(/findings?[:\s]+([\s\S]{20,600}?)(?:impression:|$)/i);
    const impressionMatch = text.match(/impression[:\s]+([\s\S]{10,400}?)(?:recommendation|$)/i);

    // Radiologist
    const radMatch = text.match(/\b(?:Dr\.?\s+)?([A-Z][a-z]+ [A-Z][a-z]+)\s*(?:MD|DMRD|FRCR|radiolog)/i);

    return {
        modality,
        bodyPart: bodyPart ? (bodyPart.charAt(0).toUpperCase() + bodyPart.slice(1)) : undefined,
        findings: findingsMatch?.[1]?.trim().slice(0, 600),
        impression: impressionMatch?.[1]?.trim().slice(0, 300),
        radiologist: radMatch?.[1],
    };
}

/** Extract hospital/discharge fields */
function parseHospital(text: string) {
    const admDate = text.match(/(?:admission|admitted|DOA)[:\s\-]+([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4})/i)?.[1];
    const disDate = text.match(/(?:discharge|DOD)[:\s\-]+([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4})/i)?.[1];
    const ward = text.match(/(?:ward|room|bed|unit)[:\s]+([A-Za-z0-9 \-\/]{1,30})/i)?.[1]?.trim();

    // Procedures — lines containing surgical/procedure keywords
    const procPattern = /(?:procedure|surgery|operation|bypass|angioplasty|appendectomy|biopsy|laparoscopy|catheter)[^\n]{0,80}/gi;
    const procedures: string[] = [];
    let pm: RegExpExecArray | null;
    while ((pm = procPattern.exec(text)) !== null) procedures.push(pm[0].trim().slice(0, 80));

    const dischargeInstr = text.match(/(?:discharge instructions?|advice at discharge)[:\s]+([\s\S]{20,400})/i)?.[1]?.trim().slice(0, 400);

    return { admissionDate: admDate, dischargeDate: disDate, wardInfo: ward, procedures: [...new Set(procedures)].slice(0, 5), dischargeInstructions: dischargeInstr };
}

/** Extract consultation fields */
function parseConsultation(text: string) {
    const ccMatch = text.match(/(?:c\/o|chief complaint|presenting complaint|complaint)[:\s]+(.*)/i)?.[1]?.trim().slice(0, 200);
    const examMatch = text.match(/(?:examination|on examination|p\/e|general examination)[:\s]+([\s\S]{10,400}?)(?:diagnosis|impression|plan|treatment|$)/i)?.[1]?.trim().slice(0, 400);
    const planMatch = text.match(/(?:plan|management|treatment plan)[:\s]+([\s\S]{10,400}?)(?:advice|follow|$)/i)?.[1]?.trim().slice(0, 400);
    const followMatch = text.match(/(?:follow.?up|review after|next visit)[:\s]+([^\n]{0,80})/i)?.[1]?.trim();
    const adviceLines = text.match(/(?:advice|advised|instructions?)[:\s]+([\s\S]{10,300})/i)?.[1]?.trim()
        .split(/\n|;/)
        .map(s => s.trim())
        .filter(s => s.length > 3)
        .slice(0, 8);

    return {
        chiefComplaint: ccMatch,
        examinationFindings: examMatch,
        treatmentPlan: planMatch,
        followUpDate: followMatch,
        advice: adviceLines,
    };
}

/** Extract insurance fields */
function parseInsurance(text: string) {
    const policyNum = text.match(/policy\s*(?:no\.?|number|#)[:\s]+([A-Z0-9\-\/]{5,25})/i)?.[1];
    const insurer = text.match(/(?:insurer|insurance company|insured by)[:\s]+([^\n]{3,50})/i)?.[1]?.trim() ||
        text.match(/\b(Star Health|ICICI Lombard|HDFC Ergo|Bajaj Allianz|New India Assurance|United India|National Insurance|Oriental Insurance|Niva Bupa|Max Bupa|Religare|Care Health)\b/i)?.[1];
    const holder = text.match(/(?:policy holder|insured name|member name)[:\s]+([^\n]{3,50})/i)?.[1]?.trim();
    const coverage = text.match(/(?:sum insured|coverage|sum assured)[:\s]+(?:Rs\.?|INR|₹)?\s*([\d,]+)/i)?.[1];
    const validity = text.match(/(?:validity|valid from|policy period)[:\s]+([^\n]{5,50})/i)?.[1]?.trim();

    return { policyNumber: policyNum, insurer, policyHolder: holder, coverageAmount: coverage, validityPeriod: validity };
}

/** Extract vaccination fields */
function parseVaccination(text: string) {
    const vaccinePatterns = [
        "COVID-19", "BCG", "Hepatitis A", "Hepatitis B", "MMR", "Measles", "Mumps", "Rubella",
        "DPT", "DTP", "Polio", "OPV", "IPV", "Typhoid", "Varicella", "Influenza", "Flu",
        "HPV", "Pneumococcal", "Meningococcal", "Cholera", "Rabies", "Yellow Fever",
    ];
    let vaccineName: string | undefined;
    for (const v of vaccinePatterns) {
        if (new RegExp(`\\b${v}\\b`, "i").test(text)) { vaccineName = v; break; }
    }
    if (!vaccineName) {
        vaccineName = text.match(/(?:vaccine|vaccination)[:\s]+([A-Za-z0-9\- ]{3,40})/i)?.[1]?.trim();
    }

    const doseNum = text.match(/(?:dose|shot)\s*(?:no\.?|number|#)?\s*(\d|first|second|third|booster)/i)?.[1];
    const nextDue = text.match(/(?:next dose|due date|next vaccination)[:\s]+([^\n]{3,40})/i)?.[1]?.trim();
    const adminBy = text.match(/(?:administered by|given by|vaccinator)[:\s]+([^\n]{3,40})/i)?.[1]?.trim();
    const batch = text.match(/(?:batch|lot)\s*(?:no\.?|number|#)[:\s]+([A-Z0-9]{3,20})/i)?.[1];

    return { vaccineName, doseNumber: doseNum, nextDueDate: nextDue, administeredBy: adminBy, batchNumber: batch };
}

// ── Named entity extraction (doctors, institutions, dates) ───────────

function extractNamedEntities(text: string) {
    const drPattern = /Dr\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g;
    const doctors: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = drPattern.exec(text)) !== null) doctors.push(m[1]);

    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const institutions = lines.filter(l =>
        /hospital|clinic|diagnostic|labs?|centre|center|medical|pharmacy/i.test(l) && l.length < 80
    );

    const datePattern = /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-]\d{2}[\/\-]\d{2})\b/g;
    const dates: string[] = [];
    while ((m = datePattern.exec(text)) !== null) dates.push(m[0]);

    return {
        doctors: [...new Set(doctors)].slice(0, 4),
        institutions: [...new Set(institutions)].slice(0, 3),
        dates: [...new Set(dates)].slice(0, 6),
    };
}

// ── Smart title generator ────────────────────────────────────────────

/**
 * Derive a plain-English finding hint from impression/findings text.
 * Used as fallback when Bedrock vision is unavailable.
 * e.g. "no fracture" → "No Fracture", "pleural effusion" → "Pleural Effusion (Fluid Around Lungs)"
 */
function imagingFindingHint(text: string): string | undefined {
    const t = text.toLowerCase();
    const KNOWN: [RegExp, string][] = [
        [/pleural effusion/i,            "Pleural Effusion (Fluid Around Lungs)"],
        [/bilateral pleural/i,           "Bilateral Pleural Effusion (Fluid Around Both Lungs)"],
        [/pneumonia|consolidat/i,        "Consolidation (Possible Pneumonia)"],
        [/pneumothorax/i,                "Pneumothorax (Collapsed Lung)"],
        [/cardiomegaly/i,                "Cardiomegaly (Enlarged Heart)"],
        [/fracture/i,                    "Fracture"],
        [/no fracture|no acute fracture/i, "No Fracture"],
        [/acl tear|anterior cruciate/i,  "ACL Tear (Ligament Damage)"],
        [/meniscus/i,                    "Meniscus Injury"],
        [/herniat/i,                     "Disc Herniation"],
        [/calcul|cholelithiasis|gallston/i, "Cholelithiasis (Gallstones)"],
        [/hydronephrosis/i,              "Hydronephrosis (Fluid in Kidney)"],
        [/mass|tumor|tumour|neoplasm/i,  "Mass / Tumour Noted"],
        [/lesion/i,                      "Lesion Noted"],
        [/oedema|edema/i,                "Oedema (Swelling)"],
        [/no (acute|significant|abnormal|cardio)/i, "No Significant Abnormality"],
        [/normal study|within normal/i,  "Normal Study"],
        [/clear lung|clear chest/i,      "Clear Lung Fields (Healthy Lungs)"],
    ];
    for (const [pattern, label] of KNOWN) {
        if (pattern.test(t)) return label;
    }
    // Generic: take first 60 chars of impression if it's concise
    const trimmed = text.replace(/\s+/g, " ").trim();
    return trimmed.length <= 70 ? trimmed : undefined;
}

function buildTitle(
    docType: DocumentTypeTag,
    namedEntities: ReturnType<typeof extractNamedEntities>,
    docSpecific: Partial<EntryMetadata>
): string {
    const doctor = namedEntities.doctors[0];
    const institution = namedEntities.institutions[0]?.split(/\s+/).slice(0, 3).join(" ");
    const date = namedEntities.dates[0];

    const template: Record<DocumentTypeTag, () => string> = {
        RX: () => doctor ? `Dr. ${doctor} – Prescription` : institution ? `${institution} – Prescription` : "Prescription",
        Lab: () => (docSpecific.labName || institution || "Lab") + " Report",
        H: () => institution ? `${institution} – Admission` : "Hospital Record",
        Consult: () => doctor ? `Dr. ${doctor} – Consultation` : "Consultation Note",
        Imaging: () => {
            const modality = docSpecific.modality;
            const bodyPart = docSpecific.bodyPart;
            const base = [modality, bodyPart].filter(Boolean).join(" ") || "Imaging";
            // Try to append a meaningful finding from impression or findings text
            const sourceText = (docSpecific.impression ?? "") || (docSpecific.findings ?? "");
            const hint = sourceText ? imagingFindingHint(sourceText) : undefined;
            return hint ? `${base} – ${hint}` : `${base} Report`;
        },
        Insurance: () => docSpecific.insurer ? `${docSpecific.insurer} – Insurance` : "Insurance Document",
        Vacc: () => docSpecific.vaccineName ? `${docSpecific.vaccineName} Vaccination` : "Vaccination Record",
        Other: () => institution || "Health Document",
    };

    const base = template[docType]?.() ?? "Health Document";
    return date ? `${base} (${date})` : base;
}

// ── RAG summary generator ────────────────────────────────────────────

function buildSummary(
    docType: DocumentTypeTag,
    namedEntities: ReturnType<typeof extractNamedEntities>,
    cm: ComprehendResult,
    meta: Partial<EntryMetadata>
): string {
    const parts: string[] = [];
    const doc = namedEntities.institutions[0] || "";
    const dr = namedEntities.doctors[0] || "";
    const date = namedEntities.dates[0] || "";

    if (docType === "RX") {
        if (dr) parts.push(`Prescribed by Dr. ${dr}${doc ? " at " + doc : ""}${date ? " on " + date : ""}.`);
        if (cm.diagnoses.length) parts.push(`Diagnosis: ${cm.diagnoses.join(", ")}.`);
        if (cm.medications.length) {
            const medSummary = cm.medications.map(m =>
                [m.name, m.dosage, m.frequency, m.duration].filter(Boolean).join(" ")
            ).join("; ");
            parts.push(`Medications: ${medSummary}.`);
        }
    } else if (docType === "Lab") {
        if (doc) parts.push(`Lab report from ${doc}${date ? " dated " + date : ""}.`);
        if (dr) parts.push(`Referred by Dr. ${dr}.`);
        const abnormal = (meta.labTests ?? []).filter(t => t.status === "High" || t.status === "Low" || t.status === "Critical");
        if (abnormal.length) parts.push(`Abnormal results: ${abnormal.map(t => `${t.name} ${t.value}${t.unit ?? ""} (${t.status})`).join(", ")}.`);
        const normal = (meta.labTests ?? []).filter(t => t.status === "Normal");
        if (normal.length) parts.push(`Normal: ${normal.map(t => t.name).join(", ")}.`);
    } else if (docType === "Imaging") {
        parts.push(`${meta.modality ?? "Imaging"} of ${meta.bodyPart ?? "body part"}${date ? " on " + date : ""}${doc ? " at " + doc : ""}.`);
        if (meta.impression) parts.push(`Impression: ${meta.impression}`);
        if (meta.findings) parts.push(`Findings: ${meta.findings.slice(0, 200)}`);
    } else if (docType === "H") {
        parts.push(`Hospital record${doc ? " at " + doc : ""}${meta.admissionDate ? ", admitted " + meta.admissionDate : ""}${meta.dischargeDate ? ", discharged " + meta.dischargeDate : ""}.`);
        if (cm.diagnoses.length) parts.push(`Diagnosis: ${cm.diagnoses.join(", ")}.`);
        if (meta.procedures?.length) parts.push(`Procedures: ${meta.procedures.join(", ")}.`);
    } else if (docType === "Consult") {
        if (dr) parts.push(`Consultation with Dr. ${dr}${doc ? " at " + doc : ""}${date ? " on " + date : ""}.`);
        if (meta.chiefComplaint) parts.push(`Chief complaint: ${meta.chiefComplaint}.`);
        if (cm.diagnoses.length) parts.push(`Diagnosis: ${cm.diagnoses.join(", ")}.`);
        if (meta.followUpDate) parts.push(`Follow-up: ${meta.followUpDate}.`);
    } else if (docType === "Insurance") {
        parts.push(`Insurance document from ${meta.insurer ?? "insurer"}. Policy: ${meta.policyNumber ?? "N/A"}. Coverage: ₹${meta.coverageAmount ?? "N/A"}.`);
    } else if (docType === "Vacc") {
        parts.push(`Vaccination record: ${meta.vaccineName ?? "vaccine"}${meta.doseNumber ? " dose " + meta.doseNumber : ""}${date ? " on " + date : ""}.`);
        if (meta.nextDueDate) parts.push(`Next due: ${meta.nextDueDate}.`);
    }

    // Always include diagnoses and allergies for RAG
    if (cm.allergies.length) parts.push(`Allergies: ${cm.allergies.join(", ")}.`);

    return parts.join(" ");
}

// ── Main entry point ─────────────────────────────────────────────────

export async function analyzeDocument(imageBytes: Buffer, filename = ""): Promise<ExtractionResult> {
    // 0. Run Bedrock vision analysis FIRST for ALL images before OCR.
    //    This lets us detect medical scans early, produce descriptive clinical titles,
    //    and avoid mis-classifying scans that have little extractable text.
    const jpegBytesForVision = await toJpegBuffer(imageBytes);
    const visionEarly = await analyzeImageWithBedrock(jpegBytesForVision);
    const visionDetectedScan = visionEarly?.documentCategory === "scan" && !!visionEarly.modality;

    // 1. OCR (still run for all types — needed for text-based documents)
    const rawText = await extractTextFromImage(imageBytes);

    // 2. Comprehend Medical — skip if OCR is blank (raw scan image)
    const looksLikeRawScan = rawText.trim().length < 80;
    const cm = looksLikeRawScan
        ? { medications: [], diagnoses: [], labEntities: [], allergies: [], entities: [] }
        : await runComprehend(rawText);

    // 3. Classify — pass filename for hint-based boosting
    const { documentType, confidence } = classify(rawText, cm, filename);

    // 3b. If OCR returned almost nothing, default to Imaging.
    //     Also upgrade to Imaging if vision explicitly detected a scan modality.
    const resolvedType: DocumentTypeTag =
        visionDetectedScan
            ? "Imaging"
            : looksLikeRawScan && documentType === "Other"
                ? "Imaging"
                : documentType;
    const resolvedConf =
        visionDetectedScan
            ? Math.max(confidence, 75)
            : looksLikeRawScan && documentType === "Other"
                ? 55
                : confidence;

    // 4. Named entity extraction
    const namedEntities = extractNamedEntities(rawText);

    // 5. Document-type-specific deep parsing
    let docSpecific: Partial<EntryMetadata> = {};
    switch (resolvedType) {
        case "Lab": {
            const results = parseLabResults(rawText);
            const labName = namedEntities.institutions[0];
            docSpecific = {
                labTests: results.length ? results : cm.labEntities.map(l => ({ name: l })),
                labName,
                referredBy: namedEntities.doctors[0],
            };
            break;
        }
        case "Imaging": {
            // Parse any existing text-based fields
            const textParsed = parseImaging(rawText);
            // Reuse the vision result already obtained at step 0 — no second Bedrock call needed.
            const vision = visionEarly;
            docSpecific = {
                ...textParsed,
                // Vision result overrides text-parsed fields wherever it has data
                ...(vision?.modality ? { modality: vision.modality } : {}),
                ...(vision?.bodyPart ? { bodyPart: vision.bodyPart } : {}),
                ...(vision?.findings ? { findings: vision.findings } : {}),
                ...(vision?.impression ? { impression: vision.impression } : {}),
                // Store the AI-generated descriptive clinical title
                ...(vision?.title ? { _visionTitle: vision.title } : {}),
            };
            break;
        }

        case "H":
            docSpecific = parseHospital(rawText);
            break;
        case "Consult":
            docSpecific = parseConsultation(rawText);
            break;
        case "Insurance":
            docSpecific = parseInsurance(rawText);
            break;
        case "Vacc":
            docSpecific = parseVaccination(rawText);
            break;
        case "RX":
        default:
            break;
    }

    // 6. Assemble full metadata
    const { _visionTitle, ...cleanDocSpecific } = docSpecific as Partial<EntryMetadata> & { _visionTitle?: string };
    const metadata: EntryMetadata = {
        rawText,
        doctors: namedEntities.doctors,
        institutions: namedEntities.institutions,
        dates: namedEntities.dates,
        medications: cm.medications.length ? cm.medications : undefined,
        diagnoses: cm.diagnoses.length ? cm.diagnoses : undefined,
        allergies: cm.allergies.length ? cm.allergies : undefined,
        ...cleanDocSpecific,
    };

    // 7. Smart title — prefer AI vision title whenever available (any doc type),
    //    otherwise fall back to rule-based title from OCR/entity data.
    const title = _visionTitle || buildTitle(resolvedType, namedEntities, metadata);

    // 8. RAG summary
    metadata.summary = buildSummary(resolvedType, namedEntities, cm, metadata);

    return { rawText, documentType: resolvedType, confidence: resolvedConf, title, metadata };
}
