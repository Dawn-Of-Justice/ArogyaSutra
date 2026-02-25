// ============================================================
// CryptographyEngine — Unified crypto interface
// Composes all crypto modules into a single service class.
// This is the ONLY crypto surface that services should use.
// ============================================================

import { deriveMasterKey, verifyKeyConsistency } from "./keyDerivation";
import {
    encrypt,
    decrypt,
    encryptString,
    decryptToString,
    serializeBlob,
    deserializeBlob,
} from "./aesGcm";
import {
    generateKeyPair,
    wrapKeyWithPublic,
    unwrapKeyWithPrivate,
    exportPublicKey,
    importPublicKey,
} from "./rsaOaep";
import {
    deriveEmergencyKey,
    encryptEmergencyData,
    decryptEmergencyData,
} from "./emergency";
import type {
    EncryptedBlob,
    SerializedEncryptedBlob,
    EncryptedEmergencyBlob,
    KeyPairRef,
} from "../types/crypto";

/**
 * CryptographyEngine provides the complete client-side
 * encryption surface for ArogyaSutra.
 *
 * Usage:
 *   const engine = new CryptographyEngine();
 *   const masterKey = await engine.deriveKey(cardId, otp);
 *   const encrypted = await engine.encrypt(data, masterKey);
 *   const decrypted = await engine.decrypt(encrypted, masterKey);
 *
 * SECURITY INVARIANTS:
 * 1. masterKey is CryptoKey — non-extractable, memory-only
 * 2. All encrypt/decrypt happens in the browser
 * 3. No key material is ever persisted, serialized, or transmitted
 */
export class CryptographyEngine {
    // ---- Key Derivation ----

    /** Derive ephemeral Master Key from Card ID + OTP */
    async deriveKey(cardId: string, otp: string): Promise<CryptoKey> {
        return deriveMasterKey(cardId, otp);
    }

    /** Verify two keys are functionally equivalent (for testing) */
    async verifyKeys(key1: CryptoKey, key2: CryptoKey): Promise<boolean> {
        return verifyKeyConsistency(key1, key2);
    }

    // ---- AES-GCM Encryption ----

    /** Encrypt raw data */
    async encrypt(
        data: ArrayBuffer,
        masterKey: CryptoKey,
        keyId?: string
    ): Promise<EncryptedBlob> {
        return encrypt(data, masterKey, keyId);
    }

    /** Decrypt an encrypted blob */
    async decrypt(
        blob: EncryptedBlob,
        masterKey: CryptoKey
    ): Promise<ArrayBuffer> {
        return decrypt(blob, masterKey);
    }

    /** Encrypt a string */
    async encryptString(
        text: string,
        masterKey: CryptoKey,
        keyId?: string
    ): Promise<EncryptedBlob> {
        return encryptString(text, masterKey, keyId);
    }

    /** Decrypt to a string */
    async decryptToString(
        blob: EncryptedBlob,
        masterKey: CryptoKey
    ): Promise<string> {
        return decryptToString(blob, masterKey);
    }

    /** Serialize blob for JSON transport */
    serializeBlob(blob: EncryptedBlob): SerializedEncryptedBlob {
        return serializeBlob(blob);
    }

    /** Deserialize blob from JSON */
    deserializeBlob(serialized: SerializedEncryptedBlob): EncryptedBlob {
        return deserializeBlob(serialized);
    }

    // ---- RSA-OAEP (Doctor Access) ----

    /** Generate RSA key pair for doctor access */
    async generateAccessKeyPair(): Promise<KeyPairRef> {
        return generateKeyPair();
    }

    /** Wrap Master Key with doctor's public key */
    async wrapKeyForDoctor(
        masterKey: CryptoKey,
        doctorPublicKey: CryptoKey
    ): Promise<ArrayBuffer> {
        return wrapKeyWithPublic(masterKey, doctorPublicKey);
    }

    /** Unwrap Master Key with doctor's private key */
    async unwrapDoctorKey(
        wrappedKey: ArrayBuffer,
        doctorPrivateKey: CryptoKey
    ): Promise<CryptoKey> {
        return unwrapKeyWithPrivate(wrappedKey, doctorPrivateKey);
    }

    /** Export public key to Base64 for storage */
    async exportPublicKey(publicKey: CryptoKey): Promise<string> {
        return exportPublicKey(publicKey);
    }

    /** Import public key from Base64 */
    async importPublicKey(base64Key: string): Promise<CryptoKey> {
        return importPublicKey(base64Key);
    }

    // ---- Emergency Key ----

    /** Derive emergency key from Master Key using HKDF */
    async deriveEmergencyKey(masterKey: CryptoKey): Promise<CryptoKey> {
        return deriveEmergencyKey(masterKey);
    }

    /** Encrypt emergency data */
    async encryptEmergency(
        data: ArrayBuffer,
        emergencyKey: CryptoKey
    ): Promise<EncryptedEmergencyBlob> {
        return encryptEmergencyData(data, emergencyKey);
    }

    /** Decrypt emergency data */
    async decryptEmergency(
        blob: EncryptedEmergencyBlob,
        emergencyKey: CryptoKey
    ): Promise<ArrayBuffer> {
        return decryptEmergencyData(blob, emergencyKey);
    }

    // ---- Re-encryption ----

    /**
     * Re-encrypts all blobs with a new key (for credential changes).
     * This happens entirely client-side: decrypt with old, encrypt with new.
     */
    async reEncryptAll(
        oldKey: CryptoKey,
        newKey: CryptoKey,
        blobs: EncryptedBlob[]
    ): Promise<EncryptedBlob[]> {
        const results: EncryptedBlob[] = [];

        for (const blob of blobs) {
            const plaintext = await this.decrypt(blob, oldKey);
            const reEncrypted = await this.encrypt(plaintext, newKey, blob.keyId);
            results.push(reEncrypted);
        }

        return results;
    }
}

/** Singleton instance */
export const cryptoEngine = new CryptographyEngine();
