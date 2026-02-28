// ============================================================
// Patient Lookup API — Server-side, doctor-authenticated
// POST /api/patient/lookup
// Looks up patient profile by Card ID from Cognito Patient Pool
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import {
    CognitoIdentityProviderClient,
    AdminGetUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";

// Amplify blocks env vars starting with "AWS_" so we use APP_AWS_* as a workaround.
const explicitCreds =
    process.env.APP_AWS_ACCESS_KEY_ID && process.env.APP_AWS_SECRET_ACCESS_KEY
        ? {
            credentials: {
                accessKeyId: process.env.APP_AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.APP_AWS_SECRET_ACCESS_KEY,
            },
        }
        : {};

const cognito = new CognitoIdentityProviderClient({
    region: process.env.NEXT_PUBLIC_AWS_REGION || process.env.APP_AWS_REGION || "ap-south-1",
    ...explicitCreds,
});

const PATIENT_POOL_ID = process.env.NEXT_PUBLIC_COGNITO_PATIENT_POOL_ID!;

/** Compute age from ISO date string (YYYY-MM-DD) */
function calculateAge(dateOfBirth: string): number {
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
}

export async function POST(req: NextRequest) {
    try {
        const { cardId } = await req.json();

        if (!cardId) {
            return NextResponse.json({ error: "cardId is required" }, { status: 400 });
        }

        if (!PATIENT_POOL_ID) {
            return NextResponse.json({ error: "Patient pool not configured" }, { status: 500 });
        }

        // Fetch patient attributes from Cognito Patient User Pool
        const result = await cognito.send(
            new AdminGetUserCommand({
                UserPoolId: PATIENT_POOL_ID,
                Username: cardId,  // Cognito username IS the card ID
            })
        );

        // Map Cognito attributes to a flat record
        const attrs: Record<string, string> = {};
        result.UserAttributes?.forEach((a) => {
            if (a.Name && a.Value) attrs[a.Name] = a.Value;
        });

        const dateOfBirth = attrs["birthdate"] || attrs["custom:dob"] || "";
        const gender = attrs["gender"] || "unknown";

        const patient = {
            cardId,
            patientId: cardId,
            name: attrs["name"] || cardId,
            fullName: attrs["name"] || cardId,
            dateOfBirth,
            age: dateOfBirth ? calculateAge(dateOfBirth) : 0,
            gender:
                gender === "male" ? "Male"
                    : gender === "female" ? "Female"
                        : "Other",
            phone: attrs["phone_number"] || "",
            // The following fields may be populated via DynamoDB profile updates
            // For now they are blank if not stored in Cognito
            bloodGroup: attrs["custom:blood_group"] || "—",
            weight: attrs["custom:weight"] || "—",
            address: attrs["address"] || "",
        };

        return NextResponse.json({ success: true, patient });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("Patient lookup error:", message);

        if (message.includes("User does not exist") || message.includes("UserNotFoundException")) {
            return NextResponse.json(
                { error: "No patient found with this Card ID." },
                { status: 404 }
            );
        }

        return NextResponse.json({ error: message }, { status: 500 });
    }
}
