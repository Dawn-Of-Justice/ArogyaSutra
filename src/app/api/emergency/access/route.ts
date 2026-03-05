// ============================================================
// Emergency Break-Glass Access API Route
// POST /api/emergency/access
// For first responders — logs access, returns emergency data
// ============================================================

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { putAuditLog } from "../../../../lib/aws/dynamodb";
import { getPatientUser } from "../../../../lib/aws/cognito";

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

        if (!patientId.match(/^AS-\d{4}-\d{4}$/i)) {
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

        // Fetch live patient data from Cognito
        let patientName = "Unknown";
        let patientAge: number | null = null;
        let bloodGroup = "Unknown";
        let allergies: string[] = [];
        let criticalMedications: string[] = [];
        let emergencyContacts: { name: string; relationship: string; phone: string }[] = [];
        let updatedAt = new Date().toISOString();

        try {
            const user = await getPatientUser(patientId.toUpperCase());
            const attrs = user.UserAttributes ?? [];
            patientName        = attr(attrs, "name") || patientId.toUpperCase();
            patientAge         = calcAge(attr(attrs, "birthdate"));
            bloodGroup         = attr(attrs, "custom:bloodGroup") || "Not recorded";
            allergies          = splitList(attr(attrs, "custom:allergies"));
            criticalMedications = splitList(attr(attrs, "custom:critical_meds"));
            try {
                const raw = attr(attrs, "custom:emergency_contacts");
                if (raw) emergencyContacts = JSON.parse(raw);
            } catch { /* malformed JSON — ignore */ }
            updatedAt = user.UserLastModifiedDate?.toISOString() ?? updatedAt;
        } catch (cognitoErr) {
            console.error("Cognito patient lookup failed:", cognitoErr);
            // Non-fatal — continue with defaults; emergency data is best-effort
        }

        const emergencyData = {
            patientName,
            patientAge,
            bloodGroup,
            allergies,
            criticalMedications,
            emergencyContacts,
            activeConditions: [] as string[], // Requires HealthLake; returned from FHIR Condition resources
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
