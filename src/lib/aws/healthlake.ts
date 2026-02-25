// ============================================================
// AWS HealthLake Integration
// FHIR R4 datastore for structured health data
// ============================================================

const region = process.env.NEXT_PUBLIC_AWS_REGION || "ap-south-1";
const DATASTORE_ID = process.env.NEXT_PUBLIC_HEALTHLAKE_DATASTORE_ID!;
const HEALTHLAKE_ENDPOINT = `https://healthlake.${region}.amazonaws.com/datastore/${DATASTORE_ID}/r4/`;

// HealthLake uses REST-based FHIR API, not a specific SDK client

/**
 * Creates a FHIR resource in HealthLake.
 *
 * @param resourceType  FHIR resource type (e.g., "Patient", "Observation")
 * @param resource      FHIR resource JSON
 * @returns             Created resource with server-assigned ID
 */
export async function createFhirResource(
    resourceType: string,
    resource: Record<string, unknown>
): Promise<Record<string, unknown>> {
    const response = await fetch(`${HEALTHLAKE_ENDPOINT}${resourceType}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/fhir+json",
        },
        body: JSON.stringify(resource),
    });

    if (!response.ok) {
        throw new Error(
            `HEALTHLAKE_CREATE_ERROR: Failed to create ${resourceType}: ${response.status}`
        );
    }

    return response.json();
}

/**
 * Retrieves a FHIR resource by ID.
 */
export async function getFhirResource(
    resourceType: string,
    resourceId: string
): Promise<Record<string, unknown>> {
    const response = await fetch(
        `${HEALTHLAKE_ENDPOINT}${resourceType}/${resourceId}`,
        {
            headers: { Accept: "application/fhir+json" },
        }
    );

    if (!response.ok) {
        throw new Error(
            `HEALTHLAKE_GET_ERROR: ${resourceType}/${resourceId}: ${response.status}`
        );
    }

    return response.json();
}

/**
 * Searches FHIR resources with query parameters.
 *
 * @param resourceType  FHIR resource type
 * @param params        FHIR search parameters
 * @returns             FHIR Bundle with matching resources
 */
export async function searchFhir(
    resourceType: string,
    params: Record<string, string>
): Promise<Record<string, unknown>> {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(
        `${HEALTHLAKE_ENDPOINT}${resourceType}?${queryString}`,
        {
            headers: { Accept: "application/fhir+json" },
        }
    );

    if (!response.ok) {
        throw new Error(
            `HEALTHLAKE_SEARCH_ERROR: ${resourceType}?${queryString}: ${response.status}`
        );
    }

    return response.json();
}

/**
 * Updates a FHIR resource.
 */
export async function updateFhirResource(
    resourceType: string,
    resourceId: string,
    resource: Record<string, unknown>
): Promise<Record<string, unknown>> {
    const response = await fetch(
        `${HEALTHLAKE_ENDPOINT}${resourceType}/${resourceId}`,
        {
            method: "PUT",
            headers: { "Content-Type": "application/fhir+json" },
            body: JSON.stringify(resource),
        }
    );

    if (!response.ok) {
        throw new Error(
            `HEALTHLAKE_UPDATE_ERROR: ${resourceType}/${resourceId}: ${response.status}`
        );
    }

    return response.json();
}

/**
 * Searches for patient timeline entries via HealthLake FHIR queries.
 * Combines DocumentReference, Observation, MedicationStatement, and Condition.
 *
 * @param patientFhirId  FHIR Patient resource ID
 * @returns              Array of FHIR resources across types
 */
export async function getPatientTimeline(
    patientFhirId: string
): Promise<Record<string, unknown>[]> {
    const resourceTypes = [
        "DocumentReference",
        "Observation",
        "MedicationStatement",
        "Condition",
        "Procedure",
    ];

    const results = await Promise.all(
        resourceTypes.map((type) =>
            searchFhir(type, { patient: patientFhirId, _sort: "-date" })
        )
    );

    // Flatten all entries from all bundles
    const allEntries: Record<string, unknown>[] = [];
    for (const bundle of results) {
        const entries = (bundle as { entry?: { resource: Record<string, unknown> }[] }).entry || [];
        allEntries.push(...entries.map((e) => e.resource));
    }

    return allEntries;
}
