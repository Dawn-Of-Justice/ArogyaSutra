// ============================================================
// POST /api/timeline/note
// Doctor adds a consultation note to the patient timeline.
// Saved as a "Consult" type HealthEntry in DynamoDB.
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
            chiefComplaint,
            examinationFindings,
            diagnosis,
            treatmentPlan,
            followUpDate,
            advice,
        } = body;

        if (!patientId || !doctorName) {
            return NextResponse.json(
                { error: "patientId and doctorName are required" },
                { status: 400 }
            );
        }

        const entryId = randomUUID();
        const now = new Date().toISOString();
        const today = now.split("T")[0];

        const title = chiefComplaint
            ? `Consultation – ${chiefComplaint}`
            : `Consultation Note`;

        const entry = {
            patientId,
            entryId,
            title,
            documentType: "Consult",
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
                chiefComplaint:       chiefComplaint || undefined,
                examinationFindings:  examinationFindings || undefined,
                diagnoses:            diagnosis ? [diagnosis] : undefined,
                treatmentPlan:        treatmentPlan || undefined,
                followUpDate:         followUpDate || undefined,
                advice:               advice ? [advice] : undefined,
                doctors:              [doctorName],
                institutions:         institution ? [institution] : undefined,
                summary:              `${chiefComplaint ? `CC: ${chiefComplaint}. ` : ""}${diagnosis ? `Dx: ${diagnosis}. ` : ""}${treatmentPlan ? `Plan: ${treatmentPlan}.` : ""}`.trim() || undefined,
            },
        };

        await db.send(new PutCommand({ TableName: TABLE, Item: entry }));

        return NextResponse.json({ success: true, entryId, entry }, { status: 201 });
    } catch (err) {
        const msg = (err as Error).message ?? "Unknown error";
        console.error("[/api/timeline/note]", msg);
        return NextResponse.json({ error: "Failed to save note." }, { status: 500 });
    }
}
