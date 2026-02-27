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
            await cognito.updatePatientAttributes(userId, {
                fullName: updates.fullName,
                phone: updates.phone,
                dateOfBirth: updates.dateOfBirth,
                gender: updates.gender,
                language: updates.language,
                city: updates.city,
                state: updates.state,
                pincode: updates.pincode,
                line1: updates.line1,
            });
        } else {
            // Doctor — update standard attrs
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

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("[/api/profile/update]", err);
        return NextResponse.json(
            { error: (err as Error).message || "Failed to update profile" },
            { status: 500 }
        );
    }
}
