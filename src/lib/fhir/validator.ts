// ============================================================
// FHIR Resource Validator
// Validates required fields and structure of FHIR resources
// ============================================================

import type { FHIRResource, FHIRBundle } from "./types";

export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
}

export interface ValidationError {
    path: string;
    message: string;
    severity: "error" | "warning";
}

/**
 * Validates a FHIR resource has required fields.
 */
export function validateResource(resource: FHIRResource): ValidationResult {
    const errors: ValidationError[] = [];

    // All resources must have resourceType
    if (!resource.resourceType) {
        errors.push({
            path: "resourceType",
            message: "Missing required field: resourceType",
            severity: "error",
        });
    }

    // Type-specific validation
    switch (resource.resourceType) {
        case "Observation":
            validateObservation(resource as unknown as Record<string, unknown>, errors);
            break;
        case "MedicationStatement":
            validateMedicationStatement(resource as unknown as Record<string, unknown>, errors);
            break;
        case "Condition":
            validateCondition(resource as unknown as Record<string, unknown>, errors);
            break;
        case "Procedure":
            validateProcedure(resource as unknown as Record<string, unknown>, errors);
            break;
        case "DocumentReference":
            validateDocumentReference(resource as unknown as Record<string, unknown>, errors);
            break;
    }

    return {
        isValid: errors.filter((e) => e.severity === "error").length === 0,
        errors,
    };
}

/**
 * Validates an entire FHIR Bundle.
 */
export function validateBundle(bundle: FHIRBundle): ValidationResult {
    const errors: ValidationError[] = [];

    if (bundle.resourceType !== "Bundle") {
        errors.push({
            path: "resourceType",
            message: 'Bundle resourceType must be "Bundle"',
            severity: "error",
        });
    }

    if (!bundle.type) {
        errors.push({
            path: "type",
            message: "Bundle must have a type",
            severity: "error",
        });
    }

    if (bundle.entry) {
        bundle.entry.forEach((entry, i) => {
            const result = validateResource(entry.resource);
            errors.push(
                ...result.errors.map((e) => ({
                    ...e,
                    path: `entry[${i}].resource.${e.path}`,
                }))
            );
        });
    }

    return {
        isValid: errors.filter((e) => e.severity === "error").length === 0,
        errors,
    };
}

// ---- Type-specific validators ----

function validateObservation(
    res: Record<string, unknown>,
    errors: ValidationError[]
) {
    if (!res.status)
        errors.push({ path: "status", message: "Observation requires status", severity: "error" });
    if (!res.code)
        errors.push({ path: "code", message: "Observation requires code", severity: "error" });
    if (!res.subject)
        errors.push({ path: "subject", message: "Observation requires subject", severity: "error" });
    if (!res.valueQuantity && !res.valueString)
        errors.push({ path: "value", message: "Observation should have a value", severity: "warning" });
}

function validateMedicationStatement(
    res: Record<string, unknown>,
    errors: ValidationError[]
) {
    if (!res.status)
        errors.push({ path: "status", message: "MedicationStatement requires status", severity: "error" });
    if (!res.medicationCodeableConcept)
        errors.push({ path: "medication", message: "MedicationStatement requires medication", severity: "error" });
    if (!res.subject)
        errors.push({ path: "subject", message: "MedicationStatement requires subject", severity: "error" });
}

function validateCondition(
    res: Record<string, unknown>,
    errors: ValidationError[]
) {
    if (!res.code)
        errors.push({ path: "code", message: "Condition requires code", severity: "error" });
    if (!res.subject)
        errors.push({ path: "subject", message: "Condition requires subject", severity: "error" });
}

function validateProcedure(
    res: Record<string, unknown>,
    errors: ValidationError[]
) {
    if (!res.status)
        errors.push({ path: "status", message: "Procedure requires status", severity: "error" });
    if (!res.subject)
        errors.push({ path: "subject", message: "Procedure requires subject", severity: "error" });
}

function validateDocumentReference(
    res: Record<string, unknown>,
    errors: ValidationError[]
) {
    if (!res.status)
        errors.push({ path: "status", message: "DocumentReference requires status", severity: "error" });
    if (!res.content)
        errors.push({ path: "content", message: "DocumentReference requires content", severity: "error" });
}
