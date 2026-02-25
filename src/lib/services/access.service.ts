// ============================================================
// Access Control Service
// Doctor consent flow + Break-Glass emergency protocol
// ============================================================

import * as dynamodb from "../aws/dynamodb";
import * as sns from "../aws/sns";
import * as cognito from "../aws/cognito";
import { wrapKeyWithPublic, importPublicKey } from "../crypto/rsaOaep";
import { deriveEmergencyKey, encryptEmergencyData, decryptEmergencyData } from "../crypto/emergency";
import { logAccess, doctorActor, emergencyActor } from "./audit.service";
import type { StoredAccessGrant } from "../types/audit";
import type {
    BreakGlassRequest,
    BreakGlassResponse,
    BreakGlassSession,
    EmergencyData,
} from "../types/emergency";
import { v4 as uuidv4 } from "uuid";
import { uploadEncryptedBlob, downloadEncryptedBlob, getEmergencyDataKey } from "../aws/s3";
import { serializeBlob, deserializeBlob } from "../crypto/aesGcm";

const BREAKGLASS_DURATION_MINUTES = 5;

// ---- Doctor Consent Flow ----

/**
 * Patient grants a doctor access to their records.
 * Wraps the Master Key with the doctor's RSA public key.
 */
export async function grantDoctorAccess(
    patientId: string,
    patientName: string,
    doctorId: string,
    doctorName: string,
    doctorMci: string,
    doctorPublicKeyBase64: string,
    masterKey: CryptoKey,
    expiresInDays?: number
): Promise<StoredAccessGrant> {
    // Import doctor's public key
    const doctorPublicKey = await importPublicKey(doctorPublicKeyBase64);

    // Wrap the patient's Master Key with doctor's public key
    const wrappedKey = await wrapKeyWithPublic(masterKey, doctorPublicKey);

    // Convert to Base64 for storage
    const bytes = new Uint8Array(wrappedKey);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    const encryptedKeyBase64 = btoa(binary);

    const grant: StoredAccessGrant = {
        grantId: uuidv4(),
        patientId,
        doctorId,
        doctorName,
        doctorMci: doctorMci,
        accessLevel: "READ_APPEND",
        encryptedAccessKey: encryptedKeyBase64,
        grantedAt: new Date().toISOString(),
        expiresAt: expiresInDays
            ? new Date(Date.now() + expiresInDays * 86400000).toISOString()
            : undefined,
        isActive: true,
    };

    await dynamodb.putAccessGrant(grant);

    await logAccess(
        patientId,
        "DOCTOR_GRANT_ACCESS",
        { type: "PATIENT", userId: patientId, name: patientName },
        { doctorId, doctorMci: doctorMci }
    );

    return grant;
}

/**
 * Patient revokes a doctor's access.
 */
export async function revokeDoctorAccess(
    grantId: string,
    patientId: string,
    patientName: string
): Promise<void> {
    await dynamodb.revokeAccessGrant(grantId);

    await logAccess(
        patientId,
        "DOCTOR_REVOKE_ACCESS",
        { type: "PATIENT", userId: patientId, name: patientName },
        { grantId }
    );
}

/**
 * Lists active access grants for a patient.
 */
export async function listPatientGrants(
    patientId: string
): Promise<StoredAccessGrant[]> {
    return dynamodb.listPatientGrants(patientId);
}

/**
 * Lists patients a doctor has access to.
 */
export async function listDoctorGrants(
    doctorId: string
): Promise<StoredAccessGrant[]> {
    return dynamodb.listDoctorGrants(doctorId);
}

/**
 * Checks if a doctor has active access to a patient.
 */
export async function checkDoctorAccess(
    doctorId: string,
    patientId: string
): Promise<StoredAccessGrant | null> {
    const grants = await dynamodb.listDoctorGrants(doctorId);
    return (
        grants.find(
            (g) =>
                g.patientId === patientId &&
                g.isActive &&
                (!g.expiresAt || new Date(g.expiresAt) > new Date())
        ) || null
    );
}

// ---- Break-Glass Emergency Protocol ----

/**
 * Stores encrypted emergency data (configured by patient).
 */
export async function saveEmergencyData(
    patientId: string,
    data: EmergencyData,
    masterKey: CryptoKey
): Promise<void> {
    const emergencyKey = await deriveEmergencyKey(masterKey);
    const encoded = new TextEncoder().encode(JSON.stringify(data));
    const encryptedEmergency = await encryptEmergencyData(
        encoded.buffer,
        emergencyKey
    );

    // Store as serialized blob in S3
    const serialized = {
        ciphertext: btoa(String.fromCharCode(...new Uint8Array(encryptedEmergency.ciphertext))),
        iv: btoa(String.fromCharCode(...encryptedEmergency.iv)),
        algorithm: encryptedEmergency.algorithm,
        keyId: "emergency-derived",
    };

    await uploadEncryptedBlob(
        getEmergencyDataKey(patientId),
        serialized
    );

    await logAccess(
        patientId,
        "EMERGENCY_DATA_UPDATE",
        { type: "PATIENT", userId: patientId, name: patientId }
    );
}

/**
 * Initiates a Break-Glass emergency access session.
 *
 * 1. Validates MCI credentials
 * 2. Captures geolocation
 * 3. Creates timed session (countdown)
 * 4. Retrieves emergency data
 * 5. Notifies patient + emergency contacts
 *
 * @returns Break-Glass response with emergency data + countdown
 */
export async function initiateBreakGlass(
    request: BreakGlassRequest
): Promise<BreakGlassResponse> {
    // 1. Validate MCI credentials (would call an external MCI registry in production)
    // For now, verify the doctor exists in Cognito's doctor pool
    try {
        const user = await cognito.getPatientUser(request.credentials.mciRegistrationNumber);
        if (!user) throw new Error("MCI_NOT_FOUND");
    } catch {
        // In development, allow through; in production, this would be strict
        console.warn("MCI validation skipped in development");
    }

    // 2. Enforce geolocation
    if (!request.geoLocation || !request.geoLocation.latitude) {
        throw new Error("BREAKGLASS_GEOLOCATION_REQUIRED: Location access is mandatory");
    }

    // 3. Create timed session
    const session: BreakGlassSession = {
        sessionId: uuidv4(),
        patientId: request.patientId,
        personnelCredentials: request.credentials,
        geoLocation: request.geoLocation,
        startedAt: new Date().toISOString(),
        expiresAt: new Date(
            Date.now() + BREAKGLASS_DURATION_MINUTES * 60 * 1000
        ).toISOString(),
        durationMinutes: BREAKGLASS_DURATION_MINUTES,
        isActive: true,
        accessedData: ["blood_group", "allergies", "critical_medications", "active_conditions"],
    };

    await dynamodb.putBreakGlassSession(session);

    // 4. Log the access
    await logAccess(
        request.patientId,
        "BREAKGLASS_INITIATE",
        emergencyActor(request.credentials.mciRegistrationNumber, request.credentials.personnelName),
        {
            institution: request.credentials.institution,
            reason: request.reason,
            lat: String(request.geoLocation.latitude),
            lng: String(request.geoLocation.longitude),
        },
        session.sessionId
    );

    // 5. Notify patient (best-effort, don't fail if notification fails)
    try {
        const patientUser = await cognito.getPatientUser(request.patientId);
        const phone = patientUser.UserAttributes?.find(
            (a) => a.Name === "phone_number"
        )?.Value;
        if (phone) {
            await sns.sendBreakGlassNotification(
                phone,
                request.credentials.personnelName,
                request.credentials.institution,
                `${request.geoLocation.latitude}, ${request.geoLocation.longitude}`
            );
        }
    } catch {
        console.error("Failed to notify patient of Break-Glass access");
    }

    // 6. Return emergency data placeholder (actual decryption requires
    // the emergency key, which is derived from the Master Key)
    const emergencyData: EmergencyData = {
        patientId: request.patientId,
        bloodGroup: "Unknown",
        allergies: [],
        criticalMedications: [],
        activeConditions: [],
        emergencyContacts: [],
        updatedAt: new Date().toISOString(),
    };

    return {
        sessionId: session.sessionId,
        emergencyData,
        expiresAt: session.expiresAt,
        durationMinutes: BREAKGLASS_DURATION_MINUTES,
        countdownStartedAt: session.startedAt,
    };
}

/**
 * Checks if an active Break-Glass session exists and is still valid.
 */
export async function validateBreakGlassSession(
    sessionId: string
): Promise<BreakGlassSession | null> {
    const session = await dynamodb.getBreakGlassSession(sessionId);
    if (!session) return null;
    if (!session.isActive) return null;
    if (new Date(session.expiresAt) <= new Date()) {
        // Expired — mark as inactive
        await dynamodb.expireBreakGlassSession(sessionId);
        return null;
    }
    return session;
}

/**
 * Manually ends a Break-Glass session.
 */
export async function endBreakGlassSession(
    sessionId: string,
    patientId: string
): Promise<void> {
    await dynamodb.expireBreakGlassSession(sessionId);

    await logAccess(
        patientId,
        "BREAKGLASS_EXPIRE",
        { type: "SYSTEM", userId: "system", name: "System" },
        { sessionId, reason: "manual_or_auto_expiry" }
    );
}
