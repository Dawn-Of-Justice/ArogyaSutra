// ============================================================
// DELETE /api/timeline/delete
// Deletes a health record entry from DynamoDB
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const region = process.env.NEXT_PUBLIC_AWS_REGION || process.env.APP_AWS_REGION || "ap-south-1";
const creds =
    process.env.APP_AWS_ACCESS_KEY_ID && process.env.APP_AWS_SECRET_ACCESS_KEY
        ? { credentials: { accessKeyId: process.env.APP_AWS_ACCESS_KEY_ID, secretAccessKey: process.env.APP_AWS_SECRET_ACCESS_KEY } }
        : {};

const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region, ...creds }));
const TABLE = process.env.DYNAMODB_HEALTH_RECORDS_TABLE || "arogyasutra-health-records";

export async function DELETE(req: NextRequest) {
    try {
        const { patientId, entryId } = await req.json();
        if (!patientId || !entryId) {
            return NextResponse.json({ error: "Missing patientId or entryId" }, { status: 400 });
        }
        await db.send(new DeleteCommand({ TableName: TABLE, Key: { patientId, entryId } }));
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("[/api/timeline/delete]", err);
        return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }
}
