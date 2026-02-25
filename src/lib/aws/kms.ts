// ============================================================
// AWS KMS Integration
// Root key management for server-side encryption
// ============================================================

import {
    KMSClient,
    GenerateDataKeyCommand,
    EncryptCommand,
    DecryptCommand,
} from "@aws-sdk/client-kms";

const region = process.env.NEXT_PUBLIC_AWS_REGION || "ap-south-1";
const kmsClient = new KMSClient({ region });
const KMS_KEY_ID = process.env.KMS_KEY_ID!;

/**
 * Generates a data key for server-side envelope encryption.
 * Returns both plaintext key (for immediate use) and encrypted key (for storage).
 */
export async function generateDataKey(): Promise<{
    plaintext: Uint8Array;
    encrypted: Uint8Array;
}> {
    const result = await kmsClient.send(
        new GenerateDataKeyCommand({
            KeyId: KMS_KEY_ID,
            KeySpec: "AES_256",
        })
    );

    return {
        plaintext: result.Plaintext!,
        encrypted: result.CiphertextBlob!,
    };
}

/**
 * Encrypts data with KMS key (for small payloads like key material).
 */
export async function encryptWithKms(
    data: Uint8Array
): Promise<Uint8Array> {
    const result = await kmsClient.send(
        new EncryptCommand({
            KeyId: KMS_KEY_ID,
            Plaintext: data,
        })
    );

    return result.CiphertextBlob!;
}

/**
 * Decrypts KMS-encrypted data.
 */
export async function decryptWithKms(
    ciphertext: Uint8Array
): Promise<Uint8Array> {
    const result = await kmsClient.send(
        new DecryptCommand({
            CiphertextBlob: ciphertext,
        })
    );

    return result.Plaintext!;
}
