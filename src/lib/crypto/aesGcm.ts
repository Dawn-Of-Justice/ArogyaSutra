// ============================================================
// AES-256-GCM Encryption / Decryption
// All patient data is encrypted client-side with this module
// before upload to S3. IV is random 12-byte per operation.
// ============================================================

import type { EncryptedBlob, SerializedEncryptedBlob } from "../types/crypto";

const IV_LENGTH = 12; // 96 bits, recommended for AES-GCM
const ALGORITHM = "AES-GCM" as const;

/**
 * Encrypts arbitrary data with AES-256-GCM.
 *
 * @param data      Plaintext data as ArrayBuffer
 * @param masterKey CryptoKey from deriveMasterKey()
 * @param keyId     Reference to the KMS root key (for metadata)
 * @returns         EncryptedBlob with ciphertext + random IV
 */
export async function encrypt(
    data: ArrayBuffer,
    masterKey: CryptoKey,
    keyId: string = "client-derived"
): Promise<EncryptedBlob> {
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    const ciphertext = await crypto.subtle.encrypt(
        { name: ALGORITHM, iv },
        masterKey,
        data
    );

    return {
        ciphertext,
        iv,
        algorithm: ALGORITHM,
        keyId,
    };
}

/**
 * Decrypts an EncryptedBlob with AES-256-GCM.
 *
 * @param blob      EncryptedBlob from encrypt()
 * @param masterKey CryptoKey from deriveMasterKey()
 * @returns         Decrypted plaintext as ArrayBuffer
 */
export async function decrypt(
    blob: EncryptedBlob,
    masterKey: CryptoKey
): Promise<ArrayBuffer> {
    return crypto.subtle.decrypt(
        { name: ALGORITHM, iv: blob.iv as BufferSource },
        masterKey,
        blob.ciphertext
    );
}

/**
 * Convenience: encrypt a UTF-8 string.
 */
export async function encryptString(
    text: string,
    masterKey: CryptoKey,
    keyId?: string
): Promise<EncryptedBlob> {
    const data = new TextEncoder().encode(text).buffer;
    return encrypt(data, masterKey, keyId);
}

/**
 * Convenience: decrypt to a UTF-8 string.
 */
export async function decryptToString(
    blob: EncryptedBlob,
    masterKey: CryptoKey
): Promise<string> {
    const plaintext = await decrypt(blob, masterKey);
    return new TextDecoder().decode(plaintext);
}

/**
 * Converts EncryptedBlob to a JSON-serializable format (Base64).
 * Used for transmitting to S3 / DynamoDB.
 */
export function serializeBlob(blob: EncryptedBlob): SerializedEncryptedBlob {
    return {
        ciphertext: arrayBufferToBase64(blob.ciphertext),
        iv: arrayBufferToBase64(blob.iv.buffer as ArrayBuffer),
        algorithm: blob.algorithm,
        keyId: blob.keyId,
    };
}

/**
 * Converts a serialized blob back to EncryptedBlob.
 */
export function deserializeBlob(
    serialized: SerializedEncryptedBlob
): EncryptedBlob {
    return {
        ciphertext: base64ToArrayBuffer(serialized.ciphertext),
        iv: new Uint8Array(base64ToArrayBuffer(serialized.iv)),
        algorithm: serialized.algorithm,
        keyId: serialized.keyId,
    };
}

// ---- Base64 Helpers ----

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
