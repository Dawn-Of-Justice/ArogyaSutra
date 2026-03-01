// ============================================================
// PUT /api/timeline/update
// Updates title, documentType, and date of a health record
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const region = process.env.NEXT_PUBLIC_AWS_REGION || process.env.APP_AWS_REGION || "ap-south-1";
const creds =
    process.env.APP_AWS_ACCESS_KEY_ID && process.env.APP_AWS_SECRET_ACCESS_KEY
        ? { credentials: { accessKeyId: process.env.APP_AWS_ACCESS_KEY_ID, secretAccessKey: process.env.APP_AWS_SECRET_ACCESS_KEY } }
        : {};

const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region, ...creds }));
const TABLE = process.env.DYNAMODB_HEALTH_RECORDS_TABLE || "arogyasutra-health-records";

export async function PUT(req: NextRequest) {
    try {
        const { patientId, entryId, title, documentType, date } = await req.json();
        if (!patientId || !entryId) {
            return NextResponse.json({ error: "Missing patientId or entryId" }, { status: 400 });
        }

        await db.send(new UpdateCommand({
            TableName: TABLE,
            Key: { patientId, entryId },
            UpdateExpression: "SET #t = :title, documentType = :type, #d = :date, updatedAt = :now",
            ExpressionAttributeNames: { "#t": "title", "#d": "date" },
            ExpressionAttributeValues: {
                ":title": title,
                ":type": documentType,
                ":date": date,
                ":now": new Date().toISOString(),
            },
        }));

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("[/api/timeline/update]", err);
        return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }
}
