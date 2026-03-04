// ============================================================
// Emergency Break-Glass Access API Route
// POST /api/emergency/access
// For first responders — logs access, returns emergency data
// ============================================================

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { putAuditLog } from "../../../../lib/aws/dynamodb";

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
            return NextResponse.json({ error: "Invalid Patient Card ID format. Expected AS-XXXX-XXXX" }, { status: 400 });
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
                lat: String(geolocation.latitude),
                lng: String(geolocation.longitude),
            },
            geoLocation: {
                latitude: geolocation.latitude,
                longitude: geolocation.longitude,
                accuracy: geolocation.accuracy,
            },
        }).catch((dbErr) => console.error("DynamoDB audit log failed (non-blocking):", dbErr));

        // Also log BREAKGLASS_VIEW — personnel immediately sees the data
        putAuditLog({
            logId: randomUUID(),
            patientId: patientId.toUpperCase(),
            action: "BREAKGLASS_VIEW",
            performedBy: {
                type: "EMERGENCY_PERSONNEL",
                userId: mciNumber,
                name: personnelName,
                mciNumber,
            },
            timestamp: new Date().toISOString(),
            details: { sessionId, institution, accessedData: "blood_group,allergies,critical_medications,active_conditions" },
            geoLocation: {
                latitude: geolocation.latitude,
                longitude: geolocation.longitude,
                accuracy: geolocation.accuracy,
            },
        }).catch((dbErr) => console.error("DynamoDB BREAKGLASS_VIEW log failed (non-blocking):", dbErr));

        // TODO: Send SMS notification to patient (Req 6.8) — non-blocking
        // This would use SNS/Twilio. Skipped here as patient phone is encrypted client-side.

        // Return critical emergency data
        // In production this would decrypt the patient's emergency_data custom attribute using
        // a secondary emergency key (not the master key, which is ephemeral).
        // For now returning mock data that would be replaced with real attribute lookup.
        const emergencyData = {
            bloodGroup: "B+",           // Fetched from Cognito custom:bloodGroup
            allergies: ["Penicillin", "Sulfonamides"],
            criticalMedications: ["Metformin 500mg", "Amlodipine 5mg"],
            activeConditions: ["Type 2 Diabetes", "Hypertension"],
            updatedAt: new Date().toISOString(), // In production: from patient's custom:emergency_updated_at
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
