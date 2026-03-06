// ============================================================
// POST /api/timeline/prescription
// Doctor adds a prescription to the patient timeline.
// Saved as an "RX" type HealthEntry in DynamoDB.
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
            doctorName,
            mciNumber,
            institution,
            diagnosis,
            medications,   // string — free text, one med per line
            instructions,
            refillsAllowed,
        } = body;

        if (!patientId || !doctorName) {
            return NextResponse.json(
                { error: "patientId and doctorName are required" },
                { status: 400 }
            );
        }

        if (!medications || !medications.trim()) {
            return NextResponse.json(
                { error: "At least one medication is required" },
                { status: 400 }
            );
        }

        const entryId = randomUUID();
        const now = new Date().toISOString();
        const today = now.split("T")[0];

        // Parse medication lines into structured array
        const medicationList = (medications as string)
            .split("\n")
            .map((line: string) => line.trim())
            .filter(Boolean)
            .map((line: string) => ({ name: line }));

        const title = diagnosis
            ? `Prescription – ${diagnosis}`
            : `Prescription`;

        const entry = {
            patientId,
            entryId,
            title,
            documentType: "RX",
            date: today,
            createdAt: now,
            updatedAt: now,
            encryptedBlobKey: "",
            confidenceScore: 100,
            statusFlags: ["VERIFIED"],
            sourceInstitution: institution || undefined,
            doctorName: doctorName,
            addedBy: { type: "DOCTOR", userId: mciNumber || doctorName, name: doctorName },
            fhirResourceIds: [],
            metadata: {
                diagnoses:     diagnosis ? [diagnosis] : undefined,
                medications:   medicationList,
                advice:        instructions ? [instructions] : undefined,
                doctors:       [doctorName],
                institutions:  institution ? [institution] : undefined,
                summary:       `${diagnosis ? `Dx: ${diagnosis}. ` : ""}Medications: ${medicationList.map((m: { name: string }) => m.name).join(", ")}.`,
                refillsAllowed: refillsAllowed ?? 0,
            },
        };

        await db.send(new PutCommand({ TableName: TABLE, Item: entry }));

        return NextResponse.json({ success: true, entryId, entry }, { status: 201 });
    } catch (err) {
        const msg = (err as Error).message ?? "Unknown error";
        console.error("[/api/timeline/prescription]", msg);
        return NextResponse.json({ error: "Failed to save prescription." }, { status: 500 });
    }
}
