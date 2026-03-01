// ============================================================
// POST /api/timeline/save
// Saves a confirmed health record entry to DynamoDB
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

const region = process.env.NEXT_PUBLIC_AWS_REGION || process.env.APP_AWS_REGION || "ap-south-1";

const creds =
    process.env.APP_AWS_ACCESS_KEY_ID && process.env.APP_AWS_SECRET_ACCESS_KEY
        ? {
            credentials: {
                accessKeyId: process.env.APP_AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.APP_AWS_SECRET_ACCESS_KEY,
            },
        }
        : {};

const client = new DynamoDBClient({ region, ...creds });
const db = DynamoDBDocumentClient.from(client);

const TABLE = process.env.DYNAMODB_HEALTH_RECORDS_TABLE || "arogyasutra-health-records";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            patientId,
            title,
            documentType,
            date,
            s3Key,
            confidence,
            metadata,
        } = body;

        if (!patientId || !title || !documentType) {
            return NextResponse.json(
                { error: "Missing required fields: patientId, title, documentType" },
                { status: 400 }
            );
        }

        const entryId = randomUUID();
        const now = new Date().toISOString();

        const entry = {
            patientId,
            entryId,
            title,
            documentType,
            date: date || now.split("T")[0],
            createdAt: now,
            updatedAt: now,
            encryptedBlobKey: s3Key || "",
            confidenceScore: confidence || 0,
            statusFlags: confidence >= 70 ? ["AI-READ"] : [],
            addedBy: { type: "PATIENT", userId: patientId, name: patientId },
            fhirResourceIds: [],
            metadata: metadata || {},
            // Extract top-level fields for easy display
            sourceInstitution: metadata?.institutions?.[0] || undefined,
            doctorName: metadata?.doctors?.[0] || undefined,
        };

        await db.send(
            new PutCommand({
                TableName: TABLE,
                Item: entry,
            })
        );

        return NextResponse.json({ success: true, entryId, entry });
    } catch (err) {
        const msg = (err as Error).message ?? "Unknown error";
        console.error("[/api/timeline/save]", msg);
        const isDev = process.env.NODE_ENV === "development";
        return NextResponse.json(
            { error: isDev ? msg : "Failed to save record." },
            { status: 500 }
        );
    }
}
