// ============================================================
// Med-Vision (OCR + Entity Extraction) Type Definitions
// ============================================================

/** Source of OCR processing */
export type OCRSource = "TEXTRACT" | "PADDLEOCR";

/** A detected text region from OCR */
export interface TextRegion {
    text: string;
    confidence: number; // 0-100
    boundingBox: BoundingBox;
    pageNumber: number;
}

/** Bounding box coordinates (normalized 0-1) */
export interface BoundingBox {
    left: number;
    top: number;
    width: number;
    height: number;
}

/** Raw OCR result from Textract or PaddleOCR */
export interface OCRResult {
    source: OCRSource;
    fullText: string;
    regions: TextRegion[];
    overallConfidence: number; // 0-100
    pageCount: number;
    processedAt: string;
    languageDetected?: string;
}

/** Clinical entities extracted by Comprehend Medical */
export interface ClinicalEntities {
    medications: Medication[];
    diagnoses: Diagnosis[];
    labResults: LabResult[];
    vitals: VitalSign[];
    procedures: Procedure[];
    anatomyMentions: AnatomyMention[];
    doctorName?: string;
    institutionName?: string;
    date?: string;
    overallConfidence: number;
}

/** Extracted medication */
export interface Medication {
    name: string;
    dosage?: string;
    frequency?: string;
    route?: string; // oral, IV, topical, etc.
    duration?: string;
    confidence: number;
}

/** Extracted diagnosis */
export interface Diagnosis {
    name: string;
    icdCode?: string; // ICD-10 code if detectable
    status: "active" | "resolved" | "unknown";
    confidence: number;
}

/** Extracted lab result */
export interface LabResult {
    testName: string;
    value: string;
    unit: string;
    referenceRange?: string;
    isAbnormal?: boolean;
    confidence: number;
}

/** Extracted vital sign */
export interface VitalSign {
    type: string; // blood_pressure, heart_rate, etc.
    value: string;
    unit: string;
    confidence: number;
}

/** Extracted procedure */
export interface Procedure {
    name: string;
    date?: string;
    outcome?: string;
    confidence: number;
}

/** Anatomy mention */
export interface AnatomyMention {
    name: string;
    system: string; // cardiovascular, respiratory, etc.
    confidence: number;
}

/** Full extraction result combining OCR + entity extraction */
export interface ExtractionResult {
    ocrResult: OCRResult;
    clinicalEntities: ClinicalEntities;
    overallConfidence: number; // 0-100
    requiresReview: boolean; // true if confidence < 70%
    suggestedDocumentType: import("./timeline").DocumentTypeTag;
    suggestedTitle: string;
    extractedAt: string;
}

/** Extraction preview shown to user for confirmation */
export interface ExtractionPreview {
    extractionResult: ExtractionResult;
    originalImageKeys: string[]; // S3 keys for uploaded photos
    editableFields: EditableField[];
}

/** A single editable field in the extraction preview */
export interface EditableField {
    fieldName: string;
    extractedValue: string;
    correctedValue?: string;
    confidence: number;
    category: "medication" | "diagnosis" | "lab" | "vital" | "metadata";
}
