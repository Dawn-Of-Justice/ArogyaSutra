// ============================================================
// Checkup API — POST: save a reading | GET: fetch history
// POST /api/checkup
// GET  /api/checkup?patientId=AS-XXXX-XXXX&limit=12
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { putCheckup, getCheckupHistory } from "../../../lib/aws/dynamodb";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { patientId, bpSystolic, bpDiastolic, temperature, height, weight, recordedBy } = body;

        if (!patientId || !recordedBy) {
            return NextResponse.json({ error: "patientId and recordedBy are required" }, { status: 400 });
        }

        const now = new Date().toISOString();
        await putCheckup({
            patientId,
            checkupId: now,
            bpSystolic: Number(bpSystolic) || 0,
            bpDiastolic: Number(bpDiastolic) || 0,
            temperature: Number(temperature) || 0,
            height: height || undefined,
            weight: weight || undefined,
            recordedBy,
            recordedAt: now,
        });

        return NextResponse.json({ success: true, checkupId: now });
    } catch (err) {
        console.error("[POST /api/checkup]", err);
        return NextResponse.json({ error: (err as Error).message || "Failed to save checkup" }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const patientId = searchParams.get("patientId");
        const limit = Number(searchParams.get("limit") || "12");

        if (!patientId) {
            return NextResponse.json({ error: "patientId is required" }, { status: 400 });
        }

        const history = await getCheckupHistory(patientId, limit);
        return NextResponse.json({ success: true, history });
    } catch (err) {
        // Table may not exist yet — return empty rather than crashing
        console.warn("[GET /api/checkup] table error (returning empty):", (err as Error).message);
        return NextResponse.json({ success: true, history: [] });
    }
}
