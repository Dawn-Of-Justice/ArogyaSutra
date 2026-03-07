// ============================================================
// Emergency Break-Glass Access API Route
// POST /api/emergency/access
// For first responders — logs access, returns emergency data
// ============================================================

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { putAuditLog, getEmergencyContacts, getEmergencyInfo } from "../../../../lib/aws/dynamodb";
import { getPatientUser } from "../../../../lib/aws/cognito";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

// ── DynamoDB client for health records queries ──
const _region = process.env.NEXT_PUBLIC_AWS_REGION || process.env.APP_AWS_REGION || "ap-south-1";
const _creds =
    process.env.APP_AWS_ACCESS_KEY_ID && process.env.APP_AWS_SECRET_ACCESS_KEY
        ? {
            credentials: {
                accessKeyId: process.env.APP_AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.APP_AWS_SECRET_ACCESS_KEY,
            },
        }
        : {};
const _ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: _region, ..._creds }));
const HEALTH_TABLE = process.env.DYNAMODB_HEALTH_RECORDS_TABLE || "arogyasutra-health-records";

function attr(attrs: { Name?: string; Value?: string }[], name: string): string {
    return attrs.find((a) => a.Name === name)?.Value ?? "";
}

function splitList(raw: string): string[] {
    return raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
}

function calcAge(birthdate: string): number | null {
    if (!birthdate) return null;
    const birth = new Date(birthdate);
    if (isNaN(birth.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    if (now.getMonth() < birth.getMonth() ||
        (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
    return age;
}

interface AccessRequest {
    patientId: string;
    mciNumber: string;
    personnelName: string;
    institution: string;
    reason: string;
    geolocation: {
        latitude: number;
        longitude: number;
        accuracy: number;
        timestamp: string;
    };
}

export async function POST(req: Request) {
    try {
        const body: AccessRequest = await req.json();

        // Validate required fields
        const { patientId, mciNumber, personnelName, institution, reason, geolocation } = body;
        if (!patientId || !mciNumber || !personnelName || !institution || !reason) {
            return NextResponse.json({ error: "All fields are required" }, { status: 400 });
        }

        if (!patientId.match(/^AS-\d{4}-\d{4}-\d{4}$/i)) {
            return NextResponse.json({ error: "Invalid Patient Card ID format. Expected AS-XXXX-XXXX-XXXX" }, { status: 400 });
        }

        const sessionId = randomUUID();
        const now = new Date().toISOString();

        // Log the break-glass access to DynamoDB (Req 6.7) — non-blocking
        putAuditLog({
            logId: randomUUID(),
            patientId: patientId.toUpperCase(),
            action: "BREAKGLASS_INITIATE",
            performedBy: {
                type: "EMERGENCY_PERSONNEL",
                userId: mciNumber,
                name: personnelName,
                mciNumber,
            },
            timestamp: now,
            details: {
                sessionId,
                institution,
                reason,
                accessedData: "blood_group,allergies,critical_medications,emergency_contacts",
                lat: String(geolocation.latitude),
                lng: String(geolocation.longitude),
            },
            geoLocation: {
                latitude: geolocation.latitude,
                longitude: geolocation.longitude,
            },
        }).catch((dbErr) => console.error("DynamoDB audit log failed (non-blocking):", dbErr));

        // Fetch live patient data from Cognito + DynamoDB
        let patientName = "Unknown";
        let patientAge: number | null = null;
        let bloodGroup = "Unknown";
        let allergies: string[] = [];
        let criticalMedications: string[] = [];
        let activeConditions: string[] = [];
        let emergencyContacts: { name: string; relationship: string; phone: string }[] = [];
        let updatedAt = new Date().toISOString();

        // Visibility defaults (patient can toggle these off in profile)
        let showBloodGroup = true;
        let showAllergies = true;
        let showMeds = true;
        let showContacts = true;

        const upperId = patientId.toUpperCase();

        // 1. Cognito profile (name, age, blood group)
        try {
            const user = await getPatientUser(upperId);
            const attrs = user.UserAttributes ?? [];
            patientName = attr(attrs, "name") || upperId;
            patientAge  = calcAge(attr(attrs, "birthdate"));
            bloodGroup  = attr(attrs, "custom:blood_group") || "Not recorded";
            updatedAt   = user.UserLastModifiedDate?.toISOString() ?? updatedAt;

            // Cognito may also have allergies/meds — use as initial fallback
            const cognitoAllergies = splitList(attr(attrs, "custom:allergies"));
            const cognitoMeds     = splitList(attr(attrs, "custom:critical_meds"));
            if (cognitoAllergies.length) allergies = cognitoAllergies;
            if (cognitoMeds.length) criticalMedications = cognitoMeds;
        } catch (cognitoErr) {
            console.error("Cognito patient lookup failed:", cognitoErr);
        }

        // 2. DynamoDB prefs — emergency info (allergies, meds, visibility toggles)
        //    This is the PRIMARY source for emergency data set by the patient in their profile.
        try {
            const emInfo = await getEmergencyInfo(upperId);
            if (emInfo) {
                // Override Cognito data with explicit emergency info if available
                if (emInfo.allergies.length > 0) allergies = emInfo.allergies;
                if (emInfo.criticalMeds.length > 0) criticalMedications = emInfo.criticalMeds;
                showBloodGroup = emInfo.showBloodGroup;
                showAllergies  = emInfo.showAllergies;
                showMeds       = emInfo.showMeds;
                showContacts   = emInfo.showContacts;
                if (emInfo.updatedAt) updatedAt = emInfo.updatedAt;
            }
        } catch (prefsErr) {
            console.error("Emergency info prefs fetch failed:", prefsErr);
        }

        // 3. DynamoDB prefs — emergency contacts
        try {
            const contacts = await getEmergencyContacts(upperId);
            if (contacts.length > 0) {
                emergencyContacts = contacts as { name: string; relationship: string; phone: string }[];
            }
        } catch (contactsErr) {
            console.error("Emergency contacts fetch failed:", contactsErr);
        }

        // 4. Health records — supplement with AI-extracted data from uploaded documents
        try {
            const records = await _ddbClient.send(
                new QueryCommand({
                    TableName: HEALTH_TABLE,
                    KeyConditionExpression: "patientId = :pid",
                    ExpressionAttributeValues: { ":pid": upperId },
                    ScanIndexForward: false,
                    Limit: 30,
                })
            );

            const recordAllergies = new Set<string>();
            const recordMeds = new Set<string>();
            const recordConditions = new Set<string>();

            for (const item of records.Items ?? []) {
                const meta = item.metadata as Record<string, unknown> | undefined;
                if (!meta) continue;

                if (Array.isArray(meta.allergies)) {
                    for (const a of meta.allergies) if (typeof a === "string" && a.trim()) recordAllergies.add(a.trim());
                }
                if (Array.isArray(meta.medications)) {
                    for (const m of meta.medications) {
                        if (typeof m === "string" && m.trim()) {
                            recordMeds.add(m.trim());
                        } else if (m && typeof m === "object" && "name" in m) {
                            const name = (m as { name: string }).name?.trim();
                            if (name) recordMeds.add(name);
                        }
                    }
                }
                if (Array.isArray(meta.diagnoses)) {
                    for (const d of meta.diagnoses) if (typeof d === "string" && d.trim()) recordConditions.add(d.trim());
                }
            }

            // Merge: health records supplement profile data (dedup)
            if (recordAllergies.size > 0) {
                const merged = new Set(allergies.map(a => a.toLowerCase()));
                for (const a of recordAllergies) {
                    if (!merged.has(a.toLowerCase())) { allergies.push(a); merged.add(a.toLowerCase()); }
                }
            }
            if (recordMeds.size > 0) {
                const merged = new Set(criticalMedications.map(m => m.toLowerCase()));
                for (const m of recordMeds) {
                    if (!merged.has(m.toLowerCase())) { criticalMedications.push(m); merged.add(m.toLowerCase()); }
                }
            }
            if (recordConditions.size > 0) {
                activeConditions = [...recordConditions];
            }
        } catch (recordsErr) {
            console.error("Health records fetch failed (non-fatal):", recordsErr);
        }

        // 5. Apply patient's visibility preferences
        const emergencyData = {
            patientName,
            patientAge,
            bloodGroup: showBloodGroup ? bloodGroup : "Hidden by patient",
            allergies: showAllergies ? allergies : [],
            criticalMedications: showMeds ? criticalMedications : [],
            emergencyContacts: showContacts ? emergencyContacts : [],
            activeConditions,
            updatedAt,
        };

        return NextResponse.json({
            sessionId,
            expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
            emergencyData,
        });
    } catch (err) {
        console.error("Emergency access error:", err);
        return NextResponse.json({ error: "Emergency access request failed" }, { status: 500 });
    }
}
