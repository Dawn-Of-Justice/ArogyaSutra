// ============================================================
// Amazon Cognito Integration
// Manages patient + doctor user pools, authentication flows
// ============================================================

import {
    CognitoIdentityProviderClient,
    InitiateAuthCommand,
    RespondToAuthChallengeCommand,
    SignUpCommand,
    AdminGetUserCommand,
    AdminCreateUserCommand,
    AdminSetUserPasswordCommand,
    AdminUpdateUserAttributesCommand,
    type InitiateAuthCommandOutput,
} from "@aws-sdk/client-cognito-identity-provider";

const region = process.env.NEXT_PUBLIC_AWS_REGION || "ap-south-1";

const cognitoClient = new CognitoIdentityProviderClient({ region });

const PATIENT_POOL_ID = process.env.NEXT_PUBLIC_COGNITO_PATIENT_POOL_ID!;
const PATIENT_CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_PATIENT_CLIENT_ID!;
const DOCTOR_POOL_ID = process.env.NEXT_PUBLIC_COGNITO_DOCTOR_POOL_ID!;
const DOCTOR_CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_DOCTOR_CLIENT_ID!;

// ---- Patient Auth ----

/** Initiate SRP login for a patient by Card ID */
export async function initiatePatientAuth(
    cardId: string
): Promise<InitiateAuthCommandOutput> {
    return cognitoClient.send(
        new InitiateAuthCommand({
            AuthFlow: "CUSTOM_AUTH",
            ClientId: PATIENT_CLIENT_ID,
            AuthParameters: {
                USERNAME: cardId,
            },
        })
    );
}

/** Respond to Cognito auth challenge (DOB or OTP step) */
export async function respondToChallenge(
    session: string,
    challengeName: string,
    responses: Record<string, string>,
    pool: "patient" | "doctor" = "patient"
): Promise<InitiateAuthCommandOutput> {
    return cognitoClient.send(
        new RespondToAuthChallengeCommand({
            ClientId: pool === "patient" ? PATIENT_CLIENT_ID : DOCTOR_CLIENT_ID,
            ChallengeName: challengeName as "CUSTOM_CHALLENGE",
            Session: session,
            ChallengeResponses: responses,
        })
    );
}

/** Register a new patient in Cognito */
export async function registerPatient(
    cardId: string,
    phone: string,
    dob: string,
    name: string
): Promise<void> {
    await cognitoClient.send(
        new SignUpCommand({
            ClientId: PATIENT_CLIENT_ID,
            Username: cardId,
            Password: crypto.randomUUID(), // Placeholder — auth uses custom challenge
            UserAttributes: [
                { Name: "phone_number", Value: phone },
                { Name: "birthdate", Value: dob },
                { Name: "name", Value: name },
                { Name: "custom:card_id", Value: cardId },
            ],
        })
    );
}

/** Look up a patient by Card ID */
export async function getPatientUser(cardId: string) {
    return cognitoClient.send(
        new AdminGetUserCommand({
            UserPoolId: PATIENT_POOL_ID,
            Username: cardId,
        })
    );
}

/** Update patient profile attributes in Cognito (server-side only).
 *  birthdate is immutable after registration; phone changes require
 *  a separate Cognito verify-attribute flow — both are omitted here. */
export async function updatePatientAttributes(
    cardId: string,
    updates: {
        fullName?: string;
        gender?: string;
        language?: string;
        city?: string;
        state?: string;
        pincode?: string;
        line1?: string;
    }
): Promise<void> {
    const attrs: { Name: string; Value: string }[] = [];
    if (updates.fullName !== undefined) attrs.push({ Name: "name", Value: updates.fullName });
    if (updates.gender !== undefined) attrs.push({ Name: "gender", Value: updates.gender });
    if (updates.language !== undefined) attrs.push({ Name: "custom:language", Value: updates.language });
    if (updates.city !== undefined) attrs.push({ Name: "custom:city", Value: updates.city });
    if (updates.state !== undefined) attrs.push({ Name: "custom:state", Value: updates.state });
    if (updates.pincode !== undefined) attrs.push({ Name: "custom:pincode", Value: updates.pincode });
    if (updates.line1 !== undefined) attrs.push({ Name: "custom:address_line1", Value: updates.line1 });

    if (attrs.length === 0) return;

    await cognitoClient.send(
        new AdminUpdateUserAttributesCommand({
            UserPoolId: PATIENT_POOL_ID,
            Username: cardId,
            UserAttributes: attrs,
        })
    );
}

// ---- Doctor Auth ----

/** Register a doctor in the Doctor user pool */
export async function registerDoctor(
    doctorId: string,
    phone: string,
    name: string,
    mciNumber: string,
    institution: string
): Promise<void> {
    await cognitoClient.send(
        new AdminCreateUserCommand({
            UserPoolId: DOCTOR_POOL_ID,
            Username: doctorId,
            UserAttributes: [
                { Name: "phone_number", Value: phone },
                { Name: "name", Value: name },
                { Name: "custom:mci_number", Value: mciNumber },
                { Name: "custom:institution", Value: institution },
                { Name: "custom:verified", Value: "false" },
            ],
        })
    );
}

/** Verify a doctor's MCI credentials */
export async function verifyDoctorMci(
    doctorId: string,
    verified: boolean
): Promise<void> {
    await cognitoClient.send(
        new AdminUpdateUserAttributesCommand({
            UserPoolId: DOCTOR_POOL_ID,
            Username: doctorId,
            UserAttributes: [
                {
                    Name: "custom:verified",
                    Value: verified ? "true" : "false",
                },
            ],
        })
    );
}

/** Initiate doctor login */
export async function initiateDoctorAuth(
    doctorId: string
): Promise<InitiateAuthCommandOutput> {
    return cognitoClient.send(
        new InitiateAuthCommand({
            AuthFlow: "CUSTOM_AUTH",
            ClientId: DOCTOR_CLIENT_ID,
            AuthParameters: {
                USERNAME: doctorId,
            },
        })
    );
}
