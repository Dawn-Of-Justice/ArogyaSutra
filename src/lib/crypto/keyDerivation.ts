// ============================================================
// PBKDF2 Key Derivation
// Master_Key = PBKDF2(Card_ID || OTP, salt=Card_ID, 100k, SHA-256, 256-bit)
//
// CRITICAL: The derived CryptoKey must NEVER be:
//   - Exported to raw/JWK
//   - Stored in localStorage, sessionStorage, IndexedDB
//   - Logged, serialized, or transmitted
//   - It exists ONLY in memory for the session duration
// ============================================================

const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH_BITS = 256;
const HASH_ALGORITHM = "SHA-256";

/**
 * Encodes a string to a UTF-8 Uint8Array.
 */
function encode(text: string): Uint8Array {
    return new TextEncoder().encode(text);
}

/**
 * Derives the ephemeral Master Key from Card ID + OTP.
 *
 * The key is created as a non-extractable CryptoKey with
 * usages restricted to encrypt/decrypt only.
 *
 * @param cardId  Patient Card ID (AS-XXXX-XXXX)
 * @param otp     One-time password from SNS
 * @returns       CryptoKey for AES-GCM encryption — NEVER store this
 */
export async function deriveMasterKey(
    cardId: string,
    otp: string
): Promise<CryptoKey> {
    // Combine Card ID and OTP as the base key material
    const keyMaterial = encode(`${cardId}||${otp}`);

    // Import the combined material as a raw key for PBKDF2
    const baseKey = await crypto.subtle.importKey(
        "raw",
        keyMaterial as BufferSource,
        "PBKDF2",
        false, // not extractable
        ["deriveKey"]
    );

    // Salt = Card ID encoded as UTF-8 (deterministic, patient-specific)
    const salt = encode(cardId);

    // Derive the AES-GCM key
    const masterKey = await crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt as BufferSource,
            iterations: PBKDF2_ITERATIONS,
            hash: HASH_ALGORITHM,
        },
        baseKey,
        {
            name: "AES-GCM",
            length: KEY_LENGTH_BITS,
        },
        false, // NOT extractable — this is critical for zero-knowledge
        ["encrypt", "decrypt"]
    );

    return masterKey;
}

/**
 * Verifies that two derivations with the same inputs produce
 * functionally equivalent keys by test-encrypting and cross-decrypting.
 *
 * Used in property tests (Correctness Property 6).
 */
export async function verifyKeyConsistency(
    key1: CryptoKey,
    key2: CryptoKey
): Promise<boolean> {
    const testData = encode("consistency-check");
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key1,
        testData as BufferSource
    );

    try {
        const decrypted = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            key2,
            encrypted
        );
        const decoded = new TextDecoder().decode(decrypted);
        return decoded === "consistency-check";
    } catch {
        return false;
    }
}
