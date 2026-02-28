// ============================================================
// GET /api/profile/me?userId=AS-XXXX-XXXX&role=patient
// Fetches full patient/doctor profile from Cognito (server-side).
// AdminGetUser requires admin credentials — MUST be server-side.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import * as cognito from "../../../../lib/aws/cognito";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const role = searchParams.get("role") as "patient" | "doctor";

    if (!userId || !role) {
        return NextResponse.json({ error: "Missing userId or role" }, { status: 400 });
    }

    try {
        if (role === "patient") {
            const user = await cognito.getPatientUser(userId);
            const attr = (name: string) =>
                user.UserAttributes?.find((a) => a.Name === name)?.Value || "";

            const profile = {
                patientId: userId,
                fullName: attr("name"),
                dateOfBirth: attr("birthdate"),
                phone: attr("phone_number"),
                gender: attr("gender") || "other",
                language: attr("custom:language") || "en",
                address: {
                    line1: attr("custom:address_line1"),
                    city: attr("custom:city"),
                    state: attr("custom:state"),
                    pincode: attr("custom:pincode"),
                    country: "IN",
                },
                height: attr("custom:height") || undefined,
                weight: attr("custom:weight") || undefined,
                bloodGroup: attr("custom:blood_group") || undefined,
                bpSystolic: attr("custom:bp_systolic") || undefined,
                bpDiastolic: attr("custom:bp_diastolic") || undefined,
                temperature: attr("custom:temperature") || undefined,
                emergencyContacts: [],
                createdAt: user.UserCreateDate?.toISOString() || "",
                updatedAt: user.UserLastModifiedDate?.toISOString() || "",
            };

            return NextResponse.json({ profile });
        }

        return NextResponse.json({ profile: null, error: "Doctor profile fetch not implemented" }, { status: 501 });

    } catch (err) {
        console.error("[/api/profile/me]", (err as Error).message);
        return NextResponse.json(
            { error: (err as Error).message || "Failed to fetch profile" },
            { status: 500 }
        );
    }
}
