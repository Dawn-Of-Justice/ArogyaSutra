// ============================================================
// GET /api/timeline/document-url?s3Key=patients/...
// Returns a short-lived presigned S3 GET URL for a document
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const region = process.env.NEXT_PUBLIC_AWS_REGION || process.env.APP_AWS_REGION || "ap-south-1";
const S3_BUCKET = process.env.NEXT_PUBLIC_S3_BUCKET || "";

const creds =
    process.env.APP_AWS_ACCESS_KEY_ID && process.env.APP_AWS_SECRET_ACCESS_KEY
        ? {
            credentials: {
                accessKeyId: process.env.APP_AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.APP_AWS_SECRET_ACCESS_KEY,
            },
        }
        : {};

const s3 = new S3Client({ region, ...creds });

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const s3Key = searchParams.get("s3Key");

    if (!s3Key) {
        return NextResponse.json({ error: "Missing s3Key" }, { status: 400 });
    }

    if (!S3_BUCKET) {
        return NextResponse.json({ error: "S3 bucket not configured" }, { status: 500 });
    }

    try {
        const url = await getSignedUrl(
            s3,
            new GetObjectCommand({ Bucket: S3_BUCKET, Key: s3Key }),
            { expiresIn: 3600 } // 1 hour
        );
        return NextResponse.json({ url });
    } catch (err) {
        console.error("[/api/timeline/document-url]", err);
        return NextResponse.json({ error: "Failed to generate URL" }, { status: 500 });
    }
}
