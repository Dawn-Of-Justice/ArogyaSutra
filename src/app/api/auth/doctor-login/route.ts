// ============================================================
// Doctor Login API — Server-side auth using Cognito
// POST /api/auth/doctor-login
// Uses USER_PASSWORD_AUTH flow (no admin IAM creds needed)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import {
    CognitoIdentityProviderClient,
    InitiateAuthCommand,
    AdminGetUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const cognito = new CognitoIdentityProviderClient({
    region: process.env.NEXT_PUBLIC_AWS_REGION || "ap-south-1",
});

const DOCTOR_POOL_ID = process.env.NEXT_PUBLIC_COGNITO_DOCTOR_POOL_ID!;
const DOCTOR_CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_DOCTOR_CLIENT_ID!;

export async function POST(req: NextRequest) {
    try {
        const { username, password } = await req.json();

        if (!username || !password) {
            return NextResponse.json(
                { error: "Username and password are required" },
                { status: 400 }
            );
        }

        if (!DOCTOR_POOL_ID || !DOCTOR_CLIENT_ID) {
            return NextResponse.json(
                { error: "Doctor pool not configured" },
                { status: 500 }
            );
        }

        // Authenticate via USER_PASSWORD_AUTH
        const authResult = await cognito.send(
            new InitiateAuthCommand({
                ClientId: DOCTOR_CLIENT_ID,
                AuthFlow: "USER_PASSWORD_AUTH",
                AuthParameters: {
                    USERNAME: username,
                    PASSWORD: password,
                },
            })
        );

        if (!authResult.AuthenticationResult) {
            return NextResponse.json(
                { error: "Authentication failed — unexpected challenge" },
                { status: 401 }
            );
        }

        // Fetch doctor profile from Cognito
        const userResult = await cognito.send(
            new AdminGetUserCommand({
                UserPoolId: DOCTOR_POOL_ID,
                Username: username,
            })
        );

        const attrs: Record<string, string> = {};
        userResult.UserAttributes?.forEach((a) => {
            if (a.Name && a.Value) attrs[a.Name] = a.Value;
        });

        return NextResponse.json({
            success: true,
            tokens: {
                idToken: authResult.AuthenticationResult.IdToken,
                accessToken: authResult.AuthenticationResult.AccessToken,
                refreshToken: authResult.AuthenticationResult.RefreshToken,
                expiresIn: authResult.AuthenticationResult.ExpiresIn,
            },
            doctor: {
                doctorId: username,
                fullName: attrs["name"] || username,
                email: attrs["email"] || "",
                phone: attrs["phone_number"] || "",
                mciNumber: attrs["custom:mci_number"] || "",
                institution: attrs["custom:institution"] || "",
                designation: attrs["custom:designation"] || "",
            },
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("Doctor login error:", message);

        // Return user-friendly error messages
        if (message.includes("Incorrect username or password")) {
            return NextResponse.json(
                { error: "Invalid credentials. Check your MCI number and password." },
                { status: 401 }
            );
        }
        if (message.includes("User does not exist")) {
            return NextResponse.json(
                { error: "No doctor account found with this identifier." },
                { status: 404 }
            );
        }
        if (message.includes("Auth flow not enabled")) {
            return NextResponse.json(
                { error: "USER_PASSWORD_AUTH is not enabled on the Cognito User Pool Client. Enable ALLOW_USER_PASSWORD_AUTH in your Cognito Doctor Pool App Client settings." },
                { status: 500 }
            );
        }

        return NextResponse.json({ error: message }, { status: 500 });
    }
}
