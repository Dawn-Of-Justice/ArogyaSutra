// ============================================================
// FHIR R4 Type Definitions
// Subset of FHIR types used in ArogyaSutra
// ============================================================

/** FHIR Resource base */
export interface FHIRResource {
    resourceType: string;
    id?: string;
    meta?: {
        lastUpdated?: string;
        profile?: string[];
    };
}

/** FHIR Bundle */
export interface FHIRBundle extends FHIRResource {
    resourceType: "Bundle";
    type: "collection" | "searchset" | "transaction";
    total?: number;
    entry?: FHIRBundleEntry[];
}

export interface FHIRBundleEntry {
    resource: FHIRResource;
    fullUrl?: string;
}

/** FHIR Patient */
export interface FHIRPatient extends FHIRResource {
    resourceType: "Patient";
    identifier?: { system: string; value: string }[];
    name?: { given?: string[]; family?: string; text?: string }[];
    birthDate?: string;
    gender?: "male" | "female" | "other" | "unknown";
    telecom?: { system: string; value: string }[];
    address?: { line?: string[]; city?: string; state?: string; postalCode?: string }[];
}

/** FHIR MedicationStatement */
export interface FHIRMedicationStatement extends FHIRResource {
    resourceType: "MedicationStatement";
    status: "active" | "completed" | "stopped" | "unknown";
    medicationCodeableConcept?: FHIRCodeableConcept;
    subject: FHIRReference;
    effectivePeriod?: { start?: string; end?: string };
    dosage?: {
        text?: string;
        timing?: { code?: FHIRCodeableConcept };
        route?: FHIRCodeableConcept;
        doseAndRate?: { doseQuantity?: { value: number; unit: string } }[];
    }[];
}

/** FHIR Condition (Diagnosis) */
export interface FHIRCondition extends FHIRResource {
    resourceType: "Condition";
    clinicalStatus?: FHIRCodeableConcept;
    code?: FHIRCodeableConcept;
    subject: FHIRReference;
    onsetDateTime?: string;
    recordedDate?: string;
}

/** FHIR Observation (Lab Result / Vital) */
export interface FHIRObservation extends FHIRResource {
    resourceType: "Observation";
    status: "final" | "preliminary" | "registered";
    category?: FHIRCodeableConcept[];
    code: FHIRCodeableConcept;
    subject: FHIRReference;
    effectiveDateTime?: string;
    valueQuantity?: { value: number; unit: string; system?: string; code?: string };
    valueString?: string;
    referenceRange?: { low?: { value: number; unit: string }; high?: { value: number; unit: string }; text?: string }[];
    interpretation?: FHIRCodeableConcept[];
}

/** FHIR Procedure */
export interface FHIRProcedure extends FHIRResource {
    resourceType: "Procedure";
    status: "completed" | "preparation" | "in-progress";
    code?: FHIRCodeableConcept;
    subject: FHIRReference;
    performedDateTime?: string;
    outcome?: FHIRCodeableConcept;
}

/** FHIR DocumentReference */
export interface FHIRDocumentReference extends FHIRResource {
    resourceType: "DocumentReference";
    status: "current" | "superseded";
    type?: FHIRCodeableConcept;
    subject?: FHIRReference;
    date?: string;
    description?: string;
    content: { attachment: { contentType?: string; url?: string; title?: string } }[];
}

/** FHIR shared types */
export interface FHIRCodeableConcept {
    coding?: { system?: string; code?: string; display?: string }[];
    text?: string;
}

export interface FHIRReference {
    reference?: string;
    display?: string;
}
