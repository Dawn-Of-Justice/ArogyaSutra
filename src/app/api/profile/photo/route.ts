// ============================================================
// Profile Photo API — Upload & Retrieve with KMS encryption
// PUT /api/profile/photo  — Upload photo (multipart or base64)
// GET /api/profile/photo?userId=xxx&role=patient|doctor
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const region = process.env.NEXT_PUBLIC_AWS_REGION || "ap-south-1";
const BUCKET = process.env.NEXT_PUBLIC_S3_BUCKET!;
const KMS_KEY_ID = process.env.KMS_KEY_ID;

const s3 = new S3Client({
    region,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
});

/** S3 key for a user's profile photo */
function photoKey(userId: string, role: string): string {
    return `profiles/${role}/${userId}/photo`;
}

// ---- GET: Retrieve a signed URL for the user's profile photo ----
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get("userId");
        const role = searchParams.get("role") || "patient";

        if (!userId) {
            return NextResponse.json({ error: "userId is required" }, { status: 400 });
        }

        if (!BUCKET) {
            return NextResponse.json({ error: "S3 bucket not configured" }, { status: 500 });
        }

        const key = photoKey(userId, role);

        // Generate a 15-minute presigned URL for the photo
        const url = await getSignedUrl(
            s3,
            new GetObjectCommand({ Bucket: BUCKET, Key: key }),
            { expiresIn: 900 }
        );

        return NextResponse.json({ url });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        // Return null photo URL if not found (user hasn't uploaded yet)
        if (message.includes("NoSuchKey") || message.includes("Not Found")) {
            return NextResponse.json({ url: null });
        }
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// ---- PUT: Upload a profile photo ----
// Expects JSON body: { userId, role, imageBase64, mimeType }
export async function PUT(req: NextRequest) {
    try {
        const { userId, role = "patient", imageBase64, mimeType = "image/jpeg" } = await req.json();

        if (!userId || !imageBase64) {
            return NextResponse.json({ error: "userId and imageBase64 are required" }, { status: 400 });
        }

        if (!BUCKET) {
            return NextResponse.json({ error: "S3 bucket not configured" }, { status: 500 });
        }

        // Decode base64 → Buffer
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");

        const key = photoKey(userId, role);

        await s3.send(
            new PutObjectCommand({
                Bucket: BUCKET,
                Key: key,
                Body: buffer,
                ContentType: mimeType,
                // KMS server-side encryption — all photos encrypted at rest
                ServerSideEncryption: "aws:kms",
                ...(KMS_KEY_ID && { SSEKMSKeyId: KMS_KEY_ID }),
                Metadata: {
                    userId,
                    role,
                    uploadedAt: new Date().toISOString(),
                },
            })
        );

        return NextResponse.json({ success: true, key });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("Profile photo upload error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
