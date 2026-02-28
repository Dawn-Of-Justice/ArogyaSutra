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

    // ---- Env diagnostics (visible in CloudWatch + browser network tab) ----
    const patientPoolId = process.env.NEXT_PUBLIC_COGNITO_PATIENT_POOL_ID;
    const region = process.env.NEXT_PUBLIC_AWS_REGION || "ap-south-1";
    console.log("[/api/profile/me] env check:", {
        patientPoolId: patientPoolId || "MISSING",
        region,
        hasExplicitKey: !!process.env.AWS_ACCESS_KEY_ID,
        userId,
        role,
    });

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
                emergencyContacts: [],
                createdAt: user.UserCreateDate?.toISOString() || "",
                updatedAt: user.UserLastModifiedDate?.toISOString() || "",
            };

            return NextResponse.json({ profile });
        }

        return NextResponse.json({ profile: null, error: "Doctor profile fetch not implemented" }, { status: 501 });

    } catch (err) {
        const msg = (err as Error).message || "Failed to fetch profile";
        console.error("[/api/profile/me] ERROR:", msg, {
            patientPoolId: patientPoolId || "MISSING",
            region,
        });
        // Return debug info in the error so you can see it in the browser network tab
        return NextResponse.json(
            { error: msg, debug: { patientPoolId: patientPoolId || "MISSING", region } },
            { status: 500 }
        );
    }
}
