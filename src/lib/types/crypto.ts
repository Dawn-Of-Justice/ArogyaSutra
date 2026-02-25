// ============================================================
// Cryptography Type Definitions
// ============================================================

/** Algorithm identifiers */
export type EncryptionAlgorithm = "AES-GCM";
export type KeyDerivationAlgorithm = "PBKDF2";
export type AsymmetricAlgorithm = "RSA-OAEP";

/** Encrypted data blob stored in S3 */
export interface EncryptedBlob {
    ciphertext: ArrayBuffer;
    iv: Uint8Array; // 12 bytes for AES-GCM
    algorithm: EncryptionAlgorithm;
    keyId: string; // Reference to KMS key used for root
}

/** Serializable version of EncryptedBlob for JSON transport */
export interface SerializedEncryptedBlob {
    ciphertext: string; // Base64
    iv: string; // Base64
    algorithm: EncryptionAlgorithm;
    keyId: string;
}

/** RSA-encrypted access key for doctor grants */
export interface EncryptedAccessKey {
    encryptedKey: ArrayBuffer;
    publicKeyFingerprint: string;
    algorithm: AsymmetricAlgorithm;
    grantedAt: string; // ISO 8601
    expiresAt?: string;
}

/** Serializable version for DynamoDB storage */
export interface SerializedAccessKey {
    encryptedKey: string; // Base64
    publicKeyFingerprint: string;
    algorithm: AsymmetricAlgorithm;
    grantedAt: string;
    expiresAt?: string;
}

/** Emergency-specific encrypted blob */
export interface EncryptedEmergencyBlob {
    ciphertext: ArrayBuffer;
    iv: Uint8Array;
    algorithm: EncryptionAlgorithm;
    derivedFrom: "HKDF-emergency";
}

/** Key derivation parameters */
export interface KeyDerivationParams {
    algorithm: KeyDerivationAlgorithm;
    iterations: 100000;
    hash: "SHA-256";
    salt: Uint8Array;
    keyLength: 256;
}

/** RSA Key pair references (CryptoKey objects, not exportable) */
export interface KeyPairRef {
    publicKey: CryptoKey;
    privateKey: CryptoKey;
    fingerprint: string;
    createdAt: string;
}
