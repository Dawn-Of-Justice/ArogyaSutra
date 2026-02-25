// ============================================================
// Timeline Type Definitions
// ============================================================

/** Document type tags displayed on timeline entries */
export type DocumentTypeTag =
    | "RX"         // Prescription
    | "Lab"        // Lab Report
    | "H"          // Hospital / Discharge Summary
    | "Consult"    // Consultation Note
    | "Vacc"       // Vaccination Record
    | "Imaging"    // X-Ray, MRI, CT, etc.
    | "Insurance"  // Insurance Document
    | "Other";

/** Status flags for timeline entries */
export type StatusFlag =
    | "VERIFIED"   // Manually verified by patient or doctor
    | "AI-READ"    // AI-extracted, not yet verified
    | "CRITICAL";  // Flagged as critical (allergies, emergencies)

/** A single health timeline entry */
export interface HealthEntry {
    entryId: string;
    patientId: string;
    title: string;
    description?: string;
    documentType: DocumentTypeTag;
    statusFlags: StatusFlag[];
    sourceInstitution?: string; // e.g., "Apollo Hospitals"
    doctorName?: string;
    date: string; // ISO 8601 date of the medical event
    createdAt: string; // ISO 8601 when entry was added
    updatedAt: string;
    encryptedBlobKey: string; // S3 key for encrypted document
    thumbnailBlobKey?: string; // S3 key for encrypted thumbnail
    fhirResourceIds: string[]; // HealthLake resource references
    confidenceScore?: number; // 0-100, from AI extraction
    addedBy: EntrySource;
    metadata: EntryMetadata;
}

/** Who created this entry */
export interface EntrySource {
    type: "PATIENT" | "DOCTOR" | "AI";
    userId: string;
    name: string;
    mciNumber?: string; // Present if doctor
}

/** Extracted metadata for search/filter */
export interface EntryMetadata {
    medications?: string[];
    diagnoses?: string[];
    labTests?: string[];
    vitals?: VitalReading[];
    allergies?: string[];
}

/** A single vital reading */
export interface VitalReading {
    type: "blood_pressure" | "heart_rate" | "temperature" | "spo2" | "weight" | "height" | "bmi" | "blood_sugar";
    value: string;
    unit: string;
    date: string;
}

/** Timeline view options */
export interface TimelineOptions {
    sortOrder: "newest" | "oldest";
    groupBy: "date" | "type" | "institution";
    pageSize: number;
    page: number;
}

/** Search query for timeline */
export interface TimelineSearchQuery {
    text?: string;
    medication?: string;
    diagnosis?: string;
    doctor?: string;
    institution?: string;
}

/** Filter parameters for timeline */
export interface TimelineFilters {
    documentTypes?: DocumentTypeTag[];
    statusFlags?: StatusFlag[];
    dateFrom?: string;
    dateTo?: string;
    institutions?: string[];
    addedByType?: ("PATIENT" | "DOCTOR" | "AI")[];
}

/** Combined timeline request (search + filter + pagination) */
export interface TimelineRequest {
    patientId: string;
    search?: TimelineSearchQuery;
    filters?: TimelineFilters;
    options: TimelineOptions;
}

/** Timeline response with pagination metadata */
export interface TimelineResponse {
    entries: HealthEntry[];
    totalCount: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}
