// ============================================================
// Admin API — Create Users in Cognito
// POST /api/admin/users
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import {
    CognitoIdentityProviderClient,
    AdminCreateUserCommand,
    AdminSetUserPasswordCommand,
    MessageActionType,
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

/** Generate a random ArogyaSutra Card ID like AS-7291-4038 */
function generateCardId(): string {
    const block1 = String(Math.floor(1000 + Math.random() * 9000));
    const block2 = String(Math.floor(1000 + Math.random() * 9000));
    return `AS-${block1}-${block2}`;
}

export async function POST(req: NextRequest) {
    try {
        // Validate admin secret
        const { adminSecret, userType, ...userData } = await req.json();

        if (adminSecret !== process.env.ADMIN_SECRET) {
            return NextResponse.json(
                { error: "Unauthorized — invalid admin secret" },
                { status: 401 }
            );
        }

        if (userType === "patient") {
            return await createPatient(userData);
        } else if (userType === "doctor") {
            return await createDoctor(userData);
        } else {
            return NextResponse.json(
                { error: "Invalid userType — must be 'patient' or 'doctor'" },
                { status: 400 }
            );
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("Admin API error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

async function createPatient(data: {
    name: string;
    phone: string;
    dob: string;
}) {
    const { name, phone, dob } = data;

    if (!name || !phone || !dob) {
        return NextResponse.json(
            { error: "Missing required fields: name, phone, dob" },
            { status: 400 }
        );
    }

    const cardId = generateCardId();
    // Auto-generate internal password (patients auth via Card ID + DOB + OTP, not password)
    const internalPassword = `P@${crypto.randomUUID().slice(0, 16)}1A`;
    const poolId = process.env.NEXT_PUBLIC_COGNITO_PATIENT_POOL_ID;

    if (!poolId) {
        return NextResponse.json(
            { error: "Patient pool ID not configured" },
            { status: 500 }
        );
    }

    // Create user in Cognito
    const createCmd = new AdminCreateUserCommand({
        UserPoolId: poolId,
        Username: cardId, // Must match what the client sends during login
        UserAttributes: [
            { Name: "name", Value: name },
            { Name: "phone_number", Value: phone },
            { Name: "birthdate", Value: dob },
            { Name: "custom:card_id", Value: cardId },
            { Name: "custom:dob", Value: dob },
        ],
        TemporaryPassword: internalPassword,
        MessageAction: MessageActionType.SUPPRESS,
    });

    await cognito.send(createCmd);

    // Set permanent password (skip the temp password change)
    const setPwdCmd = new AdminSetUserPasswordCommand({
        UserPoolId: poolId,
        Username: cardId,
        Password: internalPassword,
        Permanent: true,
    });

    await cognito.send(setPwdCmd);

    return NextResponse.json({
        success: true,
        userType: "patient",
        cardId,
        username: cardId,
        name,
        phone,
        dob,
    });
}

async function createDoctor(data: {
    name: string;
    email: string;
    phone: string;
    mciNumber: string;
    institution?: string;
    designation?: string;
    password: string;
}) {
    const { name, email, phone, mciNumber, institution, designation, password } = data;

    if (!name || !email || !phone || !mciNumber || !password) {
        return NextResponse.json(
            {
                error: "Missing required fields: name, email, phone, mciNumber, password",
            },
            { status: 400 }
        );
    }

    const poolId = process.env.NEXT_PUBLIC_COGNITO_DOCTOR_POOL_ID;

    if (!poolId) {
        return NextResponse.json(
            { error: "Doctor pool ID not configured" },
            { status: 500 }
        );
    }

    // Use MCI number as username (not email) because the doctor pool
    // has signInAliases: { email: true } which rejects email-format usernames.
    const username = mciNumber.toUpperCase().replace(/\s+/g, "-");

    const createCmd = new AdminCreateUserCommand({
        UserPoolId: poolId,
        Username: username,
        UserAttributes: [
            { Name: "name", Value: name },
            { Name: "email", Value: email },
            { Name: "email_verified", Value: "true" },
            { Name: "phone_number", Value: phone },
            { Name: "custom:mci_number", Value: mciNumber },
            ...(institution
                ? [{ Name: "custom:institution", Value: institution }]
                : []),
            ...(designation
                ? [{ Name: "custom:designation", Value: designation }]
                : []),
        ],
        TemporaryPassword: password,
        MessageAction: MessageActionType.SUPPRESS,
    });

    await cognito.send(createCmd);

    // Set permanent password
    const setPwdCmd = new AdminSetUserPasswordCommand({
        UserPoolId: poolId,
        Username: username,
        Password: password,
        Permanent: true,
    });

    await cognito.send(setPwdCmd);

    return NextResponse.json({
        success: true,
        userType: "doctor",
        username,
        name,
        email,
        phone,
        mciNumber,
    });
}
