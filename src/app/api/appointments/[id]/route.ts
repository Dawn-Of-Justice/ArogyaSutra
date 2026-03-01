// ============================================================
// PUT    /api/appointments/[id]?patientId=AS-XXXX  — update appointment
// DELETE /api/appointments/[id]?patientId=AS-XXXX  — delete appointment
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { updateAppointment, deleteAppointment } from "../../../../lib/aws/dynamodb";

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
    const { id: appointmentId } = await params;
    const patientId = new URL(req.url).searchParams.get("patientId");

    if (!patientId) {
        return NextResponse.json({ error: "Missing patientId" }, { status: 400 });
    }

    try {
        const updates = await req.json();
        await updateAppointment(patientId, appointmentId, updates);
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("[appointments PUT]", err);
        return NextResponse.json({ error: "Failed to update appointment" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
    const { id: appointmentId } = await params;
    const patientId = new URL(req.url).searchParams.get("patientId");

    if (!patientId) {
        return NextResponse.json({ error: "Missing patientId" }, { status: 400 });
    }

    try {
        await deleteAppointment(patientId, appointmentId);
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("[appointments DELETE]", err);
        return NextResponse.json({ error: "Failed to delete appointment" }, { status: 500 });
    }
}
