// ============================================================
// GET  /api/appointments?patientId=AS-XXXX  — list all appointments
// POST /api/appointments                    — create appointment
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
    listAppointments,
    putAppointment,
} from "../../../lib/aws/dynamodb";
import type { Appointment } from "../../../lib/types/appointment";

export async function GET(req: NextRequest) {
    const patientId = new URL(req.url).searchParams.get("patientId");
    if (!patientId) {
        return NextResponse.json({ error: "Missing patientId" }, { status: 400 });
    }

    try {
        const appointments = await listAppointments(patientId);
        return NextResponse.json({ appointments });
    } catch (err) {
        console.error("[appointments GET]", err);
        return NextResponse.json({ error: "Failed to fetch appointments" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { patientId, appointmentDate, doctorName, specialty, location, time, notes, sourceEntryId } = body;

        if (!patientId || !appointmentDate || !doctorName) {
            return NextResponse.json(
                { error: "patientId, appointmentDate and doctorName are required" },
                { status: 400 }
            );
        }

        const now = new Date().toISOString();
        const appt: Appointment = {
            patientId,
            appointmentId: randomUUID(),
            appointmentDate,
            doctorName,
            specialty: specialty ?? undefined,
            location: location ?? undefined,
            time: time ?? undefined,
            notes: notes ?? undefined,
            status: "scheduled",
            sourceEntryId: sourceEntryId ?? undefined,
            createdAt: now,
            updatedAt: now,
        };

        await putAppointment(appt);
        return NextResponse.json({ appointment: appt }, { status: 201 });
    } catch (err) {
        console.error("[appointments POST]", err);
        return NextResponse.json({ error: "Failed to create appointment" }, { status: 500 });
    }
}
