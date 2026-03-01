// ============================================================
// POST /api/upload
// Receives image, runs Textract + Comprehend Medical,
// uploads to S3, returns structured extraction for review.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { analyzeDocument } from "../../../lib/aws/extraction";
import { randomUUID } from "crypto";

const region = process.env.NEXT_PUBLIC_AWS_REGION || "ap-south-1";
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

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const patientId = formData.get("patientId") as string | null;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }
        if (!patientId) {
            return NextResponse.json({ error: "Missing patientId" }, { status: 400 });
        }

        const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json(
                { error: "Unsupported file type. Please use JPEG or PNG." },
                { status: 400 }
            );
        }

        const arrayBuffer = await file.arrayBuffer();
        if (arrayBuffer.byteLength > MAX_BYTES) {
            return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 413 });
        }

        const imageBytes = Buffer.from(arrayBuffer);

        // ---- Run Textract + Comprehend ----
        const extractionResult = await analyzeDocument(imageBytes);

        // ---- Upload original to S3 ----
        const ext = file.name.split(".").pop() ?? "jpg";
        const s3Key = `patients/${patientId}/documents/${randomUUID()}.${ext}`;

        if (S3_BUCKET) {
            await s3.send(
                new PutObjectCommand({
                    Bucket: S3_BUCKET,
                    Key: s3Key,
                    Body: imageBytes,
                    ContentType: file.type,
                    Metadata: {
                        patientId,
                        documentType: extractionResult.documentType,
                        uploadedAt: new Date().toISOString(),
                    },
                })
            );
        }

        return NextResponse.json({
            success: true,
            s3Key,
            extraction: {
                rawText: extractionResult.rawText.slice(0, 2000),
                documentType: extractionResult.documentType,
                confidence: extractionResult.confidence,
                title: extractionResult.title,
                metadata: extractionResult.metadata,
            },
        });
    } catch (err) {
        const msg = (err as Error).message ?? "Unknown error";
        console.error("[/api/upload]", msg, err);
        const isDev = process.env.NODE_ENV === "development";
        return NextResponse.json(
            { error: isDev ? msg : "Extraction failed. Please try again." },
            { status: 500 }
        );
    }
}
