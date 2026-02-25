// ============================================================
// FHIR Converter
// Transforms ClinicalEntities (from Comprehend) → FHIR Resources
// ============================================================

import type { ClinicalEntities, Medication, Diagnosis, LabResult, VitalSign, Procedure } from "../types/medvision";
import type {
    FHIRBundle,
    FHIRMedicationStatement,
    FHIRCondition,
    FHIRObservation,
    FHIRProcedure,
    FHIRDocumentReference,
    FHIRReference,
} from "./types";
import { v4 as uuidv4 } from "uuid";

const PATIENT_REF = (patientId: string): FHIRReference => ({
    reference: `Patient/${patientId}`,
});

/**
 * Converts ClinicalEntities into a FHIR Bundle.
 *
 * @param entities      Extracted clinical entities from Comprehend Medical
 * @param patientId     Patient FHIR resource ID
 * @param documentDate  Date of the original document
 * @param s3Key         S3 key of the encrypted original
 * @returns             FHIR Bundle with all resources
 */
export function convertToFhirBundle(
    entities: ClinicalEntities,
    patientId: string,
    documentDate: string,
    s3Key?: string
): FHIRBundle {
    const resources: (FHIRMedicationStatement | FHIRCondition | FHIRObservation | FHIRProcedure | FHIRDocumentReference)[] = [
        ...entities.medications.map((m) => toMedicationStatement(m, patientId, documentDate)),
        ...entities.diagnoses.map((d) => toCondition(d, patientId, documentDate)),
        ...entities.labResults.map((l) => toLabObservation(l, patientId, documentDate)),
        ...entities.vitals.map((v) => toVitalObservation(v, patientId, documentDate)),
        ...entities.procedures.map((p) => toProcedure(p, patientId, documentDate)),
    ];

    if (s3Key) {
        resources.push(toDocumentReference(patientId, documentDate, s3Key));
    }

    return {
        resourceType: "Bundle",
        type: "collection",
        total: resources.length,
        entry: resources.map((resource) => ({
            resource,
            fullUrl: `urn:uuid:${resource.id}`,
        })),
    };
}

function toMedicationStatement(
    med: Medication,
    patientId: string,
    date: string
): FHIRMedicationStatement {
    return {
        resourceType: "MedicationStatement",
        id: uuidv4(),
        status: "active",
        medicationCodeableConcept: {
            text: med.name,
        },
        subject: PATIENT_REF(patientId),
        effectivePeriod: { start: date },
        dosage: [
            {
                text: [med.dosage, med.frequency, med.route, med.duration]
                    .filter(Boolean)
                    .join(", "),
                ...(med.route && {
                    route: { text: med.route },
                }),
            },
        ],
    };
}

function toCondition(
    diag: Diagnosis,
    patientId: string,
    date: string
): FHIRCondition {
    return {
        resourceType: "Condition",
        id: uuidv4(),
        clinicalStatus: {
            coding: [
                {
                    system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
                    code: diag.status === "active" ? "active" : diag.status === "resolved" ? "resolved" : "unknown",
                    display: diag.status,
                },
            ],
        },
        code: {
            text: diag.name,
            ...(diag.icdCode && {
                coding: [
                    {
                        system: "http://hl7.org/fhir/sid/icd-10",
                        code: diag.icdCode,
                        display: diag.name,
                    },
                ],
            }),
        },
        subject: PATIENT_REF(patientId),
        recordedDate: date,
    };
}

function toLabObservation(
    lab: LabResult,
    patientId: string,
    date: string
): FHIRObservation {
    const value = parseFloat(lab.value);

    return {
        resourceType: "Observation",
        id: uuidv4(),
        status: "final",
        category: [
            {
                coding: [
                    {
                        system: "http://terminology.hl7.org/CodeSystem/observation-category",
                        code: "laboratory",
                        display: "Laboratory",
                    },
                ],
            },
        ],
        code: { text: lab.testName },
        subject: PATIENT_REF(patientId),
        effectiveDateTime: date,
        ...(isNaN(value)
            ? { valueString: lab.value }
            : { valueQuantity: { value, unit: lab.unit } }),
        ...(lab.referenceRange && {
            referenceRange: [{ text: lab.referenceRange }],
        }),
        ...(lab.isAbnormal && {
            interpretation: [
                {
                    coding: [
                        {
                            system: "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
                            code: "A",
                            display: "Abnormal",
                        },
                    ],
                },
            ],
        }),
    };
}

function toVitalObservation(
    vital: VitalSign,
    patientId: string,
    date: string
): FHIRObservation {
    const value = parseFloat(vital.value);

    return {
        resourceType: "Observation",
        id: uuidv4(),
        status: "final",
        category: [
            {
                coding: [
                    {
                        system: "http://terminology.hl7.org/CodeSystem/observation-category",
                        code: "vital-signs",
                        display: "Vital Signs",
                    },
                ],
            },
        ],
        code: { text: vital.type },
        subject: PATIENT_REF(patientId),
        effectiveDateTime: date,
        ...(isNaN(value)
            ? { valueString: vital.value }
            : { valueQuantity: { value, unit: vital.unit } }),
    };
}

function toProcedure(
    proc: Procedure,
    patientId: string,
    date: string
): FHIRProcedure {
    return {
        resourceType: "Procedure",
        id: uuidv4(),
        status: "completed",
        code: { text: proc.name },
        subject: PATIENT_REF(patientId),
        performedDateTime: proc.date || date,
        ...(proc.outcome && { outcome: { text: proc.outcome } }),
    };
}

function toDocumentReference(
    patientId: string,
    date: string,
    s3Key: string
): FHIRDocumentReference {
    return {
        resourceType: "DocumentReference",
        id: uuidv4(),
        status: "current",
        subject: PATIENT_REF(patientId),
        date,
        description: "Encrypted original document",
        content: [
            {
                attachment: {
                    contentType: "application/octet-stream",
                    url: `s3://${s3Key}`,
                    title: "Original encrypted scan",
                },
            },
        ],
    };
}
