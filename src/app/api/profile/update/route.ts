// ============================================================
// POST /api/profile/update
// Updates patient or doctor profile attributes in Cognito.
// Runs server-side so AdminUpdateUserAttributes credentials work.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import * as cognito from "../../../../lib/aws/cognito";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { userId, role, updates } = body as {
            userId: string;
            role: "patient" | "doctor";
            updates: Record<string, string>;
        };

        if (!userId || !role || !updates) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        if (role === "patient") {
            // Patients are NOT allowed to update BP or temperature (doctor-only fields)
            if (updates.bpSystolic || updates.bpDiastolic || updates.temperature) {
                return NextResponse.json(
                    { error: "BP and Temperature can only be updated by a doctor" },
                    { status: 403 }
                );
            }

            // NOTE: dateOfBirth is NOT sent — birthdate is immutable in Cognito
            await cognito.updatePatientAttributes(userId, {
                fullName: updates.fullName,
                phone: updates.phone,
                gender: updates.gender,
                language: updates.language,
                height: updates.height,
                weight: updates.weight,
                bloodGroup: updates.bloodGroup,
                city: updates.city,
                state: updates.state,
                pincode: updates.pincode,
                line1: updates.line1,
            });
        } else if (role === "doctor") {
            // When a doctor updates a *patient's* vitals (BP/temp)
            if (updates.targetPatientId) {
                await cognito.updatePatientAttributes(updates.targetPatientId, {
                    bpSystolic: updates.bpSystolic,
                    bpDiastolic: updates.bpDiastolic,
                    temperature: updates.temperature,
                });
            } else {
                // Doctor updating their own profile
                const doctorAttrs: { Name: string; Value: string }[] = [];
                if (updates.fullName) doctorAttrs.push({ Name: "name", Value: updates.fullName });
                if (updates.phone) doctorAttrs.push({ Name: "phone_number", Value: updates.phone });
                if (updates.institution) doctorAttrs.push({ Name: "custom:institution", Value: updates.institution });
                if (updates.designation) doctorAttrs.push({ Name: "custom:designation", Value: updates.designation });

                if (doctorAttrs.length > 0) {
                    const { AdminUpdateUserAttributesCommand } = await import("@aws-sdk/client-cognito-identity-provider");
                    const { CognitoIdentityProviderClient } = await import("@aws-sdk/client-cognito-identity-provider");
                    const client = new CognitoIdentityProviderClient({ region: process.env.NEXT_PUBLIC_AWS_REGION || "ap-south-1" });
                    await client.send(new AdminUpdateUserAttributesCommand({
                        UserPoolId: process.env.NEXT_PUBLIC_COGNITO_DOCTOR_POOL_ID!,
                        Username: userId,
                        UserAttributes: doctorAttrs,
                    }));
                }
            }
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("[/api/profile/update]", err);
        return NextResponse.json(
            { error: (err as Error).message || "Failed to update profile" },
            { status: 500 }
        );
    }
}
