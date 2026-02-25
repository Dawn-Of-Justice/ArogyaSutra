// ============================================================
// RSA-OAEP Key Management
// Used for doctor access: the patient's Master Key is wrapped
// with the doctor's public key so the doctor can decrypt
// patient data during an authorized session.
// ============================================================

import type { KeyPairRef } from "../types/crypto";

const RSA_ALGORITHM = "RSA-OAEP";
const RSA_MODULUS_LENGTH = 2048;
const RSA_PUBLIC_EXPONENT = new Uint8Array([1, 0, 1]); // 65537
const RSA_HASH = "SHA-256";

/**
 * Generates an RSA-OAEP key pair for doctor access grants.
 * The private key is non-extractable and stays on the doctor's device.
 *
 * @returns KeyPairRef with public/private CryptoKeys + fingerprint
 */
export async function generateKeyPair(): Promise<KeyPairRef> {
    const keyPair = await crypto.subtle.generateKey(
        {
            name: RSA_ALGORITHM,
            modulusLength: RSA_MODULUS_LENGTH,
            publicExponent: RSA_PUBLIC_EXPONENT,
            hash: RSA_HASH,
        },
        false, // private key not extractable
        ["wrapKey", "unwrapKey"]
    );

    // Export public key to compute fingerprint
    const publicKeyBuffer = await crypto.subtle.exportKey(
        "spki",
        keyPair.publicKey
    );
    const fingerprint = await computeFingerprint(publicKeyBuffer);

    return {
        publicKey: keyPair.publicKey,
        privateKey: keyPair.privateKey,
        fingerprint,
        createdAt: new Date().toISOString(),
    };
}

/**
 * Wraps (encrypts) an AES Master Key with a doctor's RSA public key.
 * This allows the doctor to later unwrap the key on their device.
 *
 * @param masterKey   Patient's AES-GCM CryptoKey
 * @param publicKey   Doctor's RSA-OAEP public key
 * @returns           Encrypted key as ArrayBuffer
 */
export async function wrapKeyWithPublic(
    masterKey: CryptoKey,
    publicKey: CryptoKey
): Promise<ArrayBuffer> {
    return crypto.subtle.wrapKey("raw", masterKey, publicKey, {
        name: RSA_ALGORITHM,
    });
}

/**
 * Unwraps (decrypts) an AES Master Key using the doctor's RSA private key.
 * The returned CryptoKey can be used for AES-GCM decryption.
 *
 * @param wrappedKey  Encrypted key from wrapKeyWithPublic()
 * @param privateKey  Doctor's RSA-OAEP private key
 * @returns           Unwrapped AES-GCM CryptoKey
 */
export async function unwrapKeyWithPrivate(
    wrappedKey: ArrayBuffer,
    privateKey: CryptoKey
): Promise<CryptoKey> {
    return crypto.subtle.unwrapKey(
        "raw",
        wrappedKey,
        privateKey,
        { name: RSA_ALGORITHM },
        { name: "AES-GCM", length: 256 },
        false, // unwrapped key is not extractable
        ["encrypt", "decrypt"]
    );
}

/**
 * Exports an RSA public key to Base64 SPKI format for storage/transmission.
 */
export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
    const exported = await crypto.subtle.exportKey("spki", publicKey);
    return arrayBufferToBase64(exported);
}

/**
 * Imports an RSA public key from Base64 SPKI format.
 */
export async function importPublicKey(base64Key: string): Promise<CryptoKey> {
    const keyBuffer = base64ToArrayBuffer(base64Key);
    return crypto.subtle.importKey(
        "spki",
        keyBuffer,
        { name: RSA_ALGORITHM, hash: RSA_HASH },
        true,
        ["wrapKey"]
    );
}

// ---- Internal Helpers ----

async function computeFingerprint(keyBuffer: ArrayBuffer): Promise<string> {
    const hash = await crypto.subtle.digest("SHA-256", keyBuffer);
    const hashArray = new Uint8Array(hash);
    return Array.from(hashArray)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(":");
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}
