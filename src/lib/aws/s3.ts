// ============================================================
// Amazon S3 Integration
// Encrypted blob upload/download for patient documents
// ============================================================

import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    HeadObjectCommand,
    ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import type { SerializedEncryptedBlob } from "../types/crypto";

// Amplify blocks "AWS_" prefix env vars — use APP_AWS_* workaround.
// Falls back to default credential chain (IAM role / local ~/.aws).
const _appCreds =
    process.env.APP_AWS_ACCESS_KEY_ID && process.env.APP_AWS_SECRET_ACCESS_KEY
        ? { credentials: { accessKeyId: process.env.APP_AWS_ACCESS_KEY_ID, secretAccessKey: process.env.APP_AWS_SECRET_ACCESS_KEY } }
        : {};


const region = process.env.NEXT_PUBLIC_AWS_REGION || "ap-south-1";
const s3Client = new S3Client({ region, ..._appCreds });
const BUCKET = process.env.NEXT_PUBLIC_S3_BUCKET!;

/**
 * Uploads an encrypted blob to S3.
 * The data is already encrypted client-side — S3 stores ciphertext only.
 *
 * @param key     S3 object key (e.g., "patients/{patientId}/docs/{entryId}")
 * @param blob    Serialized encrypted blob (Base64 ciphertext + IV)
 * @returns       S3 ETag for the uploaded object
 */
export async function uploadEncryptedBlob(
    key: string,
    blob: SerializedEncryptedBlob,
    contentType: string = "application/octet-stream"
): Promise<string> {
    const body = JSON.stringify(blob);

    const result = await s3Client.send(
        new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: body,
            ContentType: contentType,
            ServerSideEncryption: "aws:kms", // Additional server-side encryption
            Metadata: {
                algorithm: blob.algorithm,
                "key-id": blob.keyId,
            },
        })
    );

    return result.ETag || "";
}

/**
 * Downloads an encrypted blob from S3.
 *
 * @param key  S3 object key
 * @returns    Serialized encrypted blob ready for client-side decryption
 */
export async function downloadEncryptedBlob(
    key: string
): Promise<SerializedEncryptedBlob> {
    const result = await s3Client.send(
        new GetObjectCommand({
            Bucket: BUCKET,
            Key: key,
        })
    );

    const bodyString = await result.Body?.transformToString();
    if (!bodyString) {
        throw new Error(`S3_EMPTY_OBJECT: No data found at key ${key}`);
    }

    return JSON.parse(bodyString) as SerializedEncryptedBlob;
}

/**
 * Deletes an encrypted blob from S3.
 */
export async function deleteBlob(key: string): Promise<void> {
    await s3Client.send(
        new DeleteObjectCommand({
            Bucket: BUCKET,
            Key: key,
        })
    );
}

/**
 * Checks if an encrypted blob exists in S3.
 */
export async function blobExists(key: string): Promise<boolean> {
    try {
        await s3Client.send(
            new HeadObjectCommand({
                Bucket: BUCKET,
                Key: key,
            })
        );
        return true;
    } catch {
        return false;
    }
}

/**
 * Lists all blob keys for a patient.
 *
 * @param patientPrefix  Prefix like "patients/{patientId}/docs/"
 * @returns              List of S3 keys
 */
export async function listPatientBlobs(
    patientPrefix: string
): Promise<string[]> {
    const result = await s3Client.send(
        new ListObjectsV2Command({
            Bucket: BUCKET,
            Prefix: patientPrefix,
        })
    );

    return (result.Contents || []).map((obj) => obj.Key!).filter(Boolean);
}

/**
 * Generates the S3 key path for a patient document.
 */
export function getDocumentKey(
    patientId: string,
    entryId: string,
    suffix: string = "doc"
): string {
    return `patients/${patientId}/docs/${entryId}/${suffix}`;
}

/**
 * Generates the S3 key path for an original document photo.
 */
export function getOriginalPhotoKey(
    patientId: string,
    entryId: string,
    photoIndex: number = 0
): string {
    return `patients/${patientId}/docs/${entryId}/original-${photoIndex}`;
}

/**
 * Generates the S3 key path for emergency data.
 */
export function getEmergencyDataKey(patientId: string): string {
    return `patients/${patientId}/emergency/data`;
}
