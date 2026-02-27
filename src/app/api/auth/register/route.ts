// ============================================================
// Public Registration API — Self-service Patient & Doctor signup
// POST /api/auth/register
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import {
    CognitoIdentityProviderClient,
    AdminCreateUserCommand,
    AdminSetUserPasswordCommand,
    MessageActionType,
} from "@aws-sdk/client-cognito-identity-provider";

const cognito = new CognitoIdentityProviderClient({
    region: process.env.NEXT_PUBLIC_AWS_REGION || "ap-south-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
});

/** Generate a random ArogyaSutra Card ID like AS-7291-4038 */
function generateCardId(): string {
    const block1 = String(Math.floor(1000 + Math.random() * 9000));
    const block2 = String(Math.floor(1000 + Math.random() * 9000));
    return `AS-${block1}-${block2}`;
}

export async function POST(req: NextRequest) {
    try {
        const { userType, ...userData } = await req.json();

        if (userType === "patient") {
            return await registerPatient(userData);
        } else if (userType === "doctor") {
            return await registerDoctor(userData);
        } else {
            return NextResponse.json(
                { error: "Invalid userType — must be 'patient' or 'doctor'" },
                { status: 400 }
            );
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("Registration API error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

async function registerPatient(data: {
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

    // Basic validation
    if (!/^\+?\d{10,15}$/.test(phone.replace(/[\s-]/g, ""))) {
        return NextResponse.json(
            { error: "Invalid phone number format. Use +919876543210" },
            { status: 400 }
        );
    }

    const cardId = generateCardId();
    const internalPassword = `P@${crypto.randomUUID().slice(0, 16)}1A`;
    const poolId = process.env.NEXT_PUBLIC_COGNITO_PATIENT_POOL_ID;

    if (!poolId) {
        return NextResponse.json(
            { error: "Patient pool not configured" },
            { status: 500 }
        );
    }

    const createCmd = new AdminCreateUserCommand({
        UserPoolId: poolId,
        Username: cardId,
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
        name,
        phone,
        dob,
    });
}

async function registerDoctor(data: {
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
            { error: "Missing required fields: name, email, phone, mciNumber, password" },
            { status: 400 }
        );
    }

    // Password strength validation
    if (password.length < 12) {
        return NextResponse.json(
            { error: "Password must be at least 12 characters" },
            { status: 400 }
        );
    }

    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
        return NextResponse.json(
            { error: "Password must contain at least one uppercase letter, one number, and one symbol" },
            { status: 400 }
        );
    }

    const poolId = process.env.NEXT_PUBLIC_COGNITO_DOCTOR_POOL_ID;

    if (!poolId) {
        return NextResponse.json(
            { error: "Doctor pool not configured" },
            { status: 500 }
        );
    }

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
            ...(institution ? [{ Name: "custom:institution", Value: institution }] : []),
            ...(designation ? [{ Name: "custom:designation", Value: designation }] : []),
        ],
        TemporaryPassword: password,
        MessageAction: MessageActionType.SUPPRESS,
    });

    await cognito.send(createCmd);

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
