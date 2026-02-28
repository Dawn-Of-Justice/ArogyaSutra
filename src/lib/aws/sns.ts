// ============================================================
// Amazon SNS Integration
// OTP delivery and emergency notifications
// ============================================================

import {
    SNSClient,
    PublishCommand,
} from "@aws-sdk/client-sns";

// Amplify blocks "AWS_" prefix env vars — use APP_AWS_* workaround.
// Falls back to default credential chain (IAM role / local ~/.aws).
const _appCreds =
    process.env.APP_AWS_ACCESS_KEY_ID && process.env.APP_AWS_SECRET_ACCESS_KEY
        ? { credentials: { accessKeyId: process.env.APP_AWS_ACCESS_KEY_ID, secretAccessKey: process.env.APP_AWS_SECRET_ACCESS_KEY } }
        : {};


const region = process.env.NEXT_PUBLIC_AWS_REGION || "ap-south-1";
const snsClient = new SNSClient({ region, ..._appCreds });

/**
 * Sends an OTP to the patient's phone number.
 *
 * @param phoneNumber  Full phone number with country code (+91XXXXXXXXXX)
 * @param otp          6-digit OTP
 */
export async function sendOtp(
    phoneNumber: string,
    otp: string
): Promise<void> {
    await snsClient.send(
        new PublishCommand({
            PhoneNumber: phoneNumber,
            Message: `Your ArogyaSutra verification code is: ${otp}. Valid for 5 minutes. Do not share this code.`,
            MessageAttributes: {
                "AWS.SNS.SMS.SenderID": {
                    DataType: "String",
                    StringValue: "ArogyaSutra",
                },
                "AWS.SNS.SMS.SMSType": {
                    DataType: "String",
                    StringValue: "Transactional",
                },
            },
        })
    );
}

/**
 * Sends a Break-Glass notification to the patient and emergency contacts.
 *
 * @param phoneNumber  Recipient phone number
 * @param personnelName Name of emergency personnel
 * @param institution   Institution name
 * @param location      Access location
 */
export async function sendBreakGlassNotification(
    phoneNumber: string,
    personnelName: string,
    institution: string,
    location: string
): Promise<void> {
    const message =
        `⚠️ ALERT: Your ArogyaSutra health records were accessed via Emergency Protocol ` +
        `by ${personnelName} (${institution}). ` +
        `Location: ${location}. ` +
        `If you did not authorize this, contact support immediately.`;

    await snsClient.send(
        new PublishCommand({
            PhoneNumber: phoneNumber,
            Message: message,
            MessageAttributes: {
                "AWS.SNS.SMS.SMSType": {
                    DataType: "String",
                    StringValue: "Transactional",
                },
            },
        })
    );
}

/**
 * Sends a general notification to a phone number.
 */
export async function sendNotification(
    phoneNumber: string,
    message: string
): Promise<void> {
    await snsClient.send(
        new PublishCommand({
            PhoneNumber: phoneNumber,
            Message: message,
            MessageAttributes: {
                "AWS.SNS.SMS.SenderID": {
                    DataType: "String",
                    StringValue: "ArogyaSutra",
                },
                "AWS.SNS.SMS.SMSType": {
                    DataType: "String",
                    StringValue: "Transactional",
                },
            },
        })
    );
}
