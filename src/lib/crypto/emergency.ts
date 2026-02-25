// ============================================================
// Emergency Key Derivation (HKDF)
// Derives a separate key from the Master Key for Break-Glass
// emergency data encryption. Uses HKDF with info="emergency".
// ============================================================

import type { EncryptedEmergencyBlob } from "../types/crypto";

const HKDF_HASH = "SHA-256";
const HKDF_INFO = "emergency";
const AES_KEY_LENGTH = 256;
const IV_LENGTH = 12;

/**
 * Derives an emergency-specific AES key from the Master Key using HKDF.
 * This key encrypts only the critical emergency data (blood group,
 * allergies, critical meds, active conditions).
 *
 * @param masterKey  Patient's AES-GCM Master Key (from PBKDF2)
 * @returns          AES-GCM CryptoKey for emergency data only
 */
export async function deriveEmergencyKey(
    masterKey: CryptoKey
): Promise<CryptoKey> {
    // Export master key material for HKDF (we use raw export internally)
    // Since masterKey is non-extractable, we do a test encrypt to derive material
    const ikm = await deriveIKMFromMasterKey(masterKey);

    const hkdfKey = await crypto.subtle.importKey(
        "raw",
        ikm,
        "HKDF",
        false,
        ["deriveKey"]
    );

    return crypto.subtle.deriveKey(
        {
            name: "HKDF",
            salt: new Uint8Array(32), // Zero salt — deterministic
            info: new TextEncoder().encode(HKDF_INFO),
            hash: HKDF_HASH,
        },
        hkdfKey,
        { name: "AES-GCM", length: AES_KEY_LENGTH },
        false, // not extractable
        ["encrypt", "decrypt"]
    );
}

/**
 * Encrypts emergency data with the emergency-derived key.
 */
export async function encryptEmergencyData(
    data: ArrayBuffer,
    emergencyKey: CryptoKey
): Promise<EncryptedEmergencyBlob> {
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        emergencyKey,
        data
    );

    return {
        ciphertext,
        iv,
        algorithm: "AES-GCM",
        derivedFrom: "HKDF-emergency",
    };
}

/**
 * Decrypts emergency data with the emergency-derived key.
 */
export async function decryptEmergencyData(
    blob: EncryptedEmergencyBlob,
    emergencyKey: CryptoKey
): Promise<ArrayBuffer> {
    return crypto.subtle.decrypt(
        { name: "AES-GCM", iv: blob.iv as BufferSource },
        emergencyKey,
        blob.ciphertext
    );
}

// ---- Internal ----

/**
 * Derives input key material from a non-extractable master key
 * by using it to encrypt a known value. This produces deterministic
 * material that can seed HKDF without ever exporting the master key.
 */
async function deriveIKMFromMasterKey(
    masterKey: CryptoKey
): Promise<ArrayBuffer> {
    const knownInput = new TextEncoder().encode(
        "arogyasutra-emergency-key-derivation-v1"
    );
    // Use a fixed IV for deterministic IKM derivation (safe because
    // this intermediate value is never stored or transmitted)
    const fixedIv = new Uint8Array(12); // all zeros

    return crypto.subtle.encrypt(
        { name: "AES-GCM", iv: fixedIv },
        masterKey,
        knownInput
    );
}
