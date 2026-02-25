// ============================================================
// CreateAuthChallenge Lambda
// Generates challenges for each step:
//   Step 1: Card ID — just echoes back (client validates format)
//   Step 2: DOB — generates a DOB check challenge
//   Step 3: OTP — generates and sends OTP via SNS
// ============================================================

import type { CreateAuthChallengeTriggerEvent } from "aws-lambda";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const sns = new SNSClient({ region: process.env.AWS_REGION });

export const handler = async (
    event: CreateAuthChallengeTriggerEvent
): Promise<CreateAuthChallengeTriggerEvent> => {
    const step = event.request.session.length;

    if (step === 0) {
        // Step 1: Card ID verification
        // The Card ID is the username — just create a passthrough challenge
        event.response.publicChallengeParameters = {
            type: "CARD_ID",
        };
        event.response.privateChallengeParameters = {
            answer: event.request.userAttributes["custom:card_id"] || event.userName,
        };
    } else if (step === 1) {
        // Step 2: DOB verification
        event.response.publicChallengeParameters = {
            type: "DOB",
        };
        event.response.privateChallengeParameters = {
            answer: event.request.userAttributes["birthdate"] || "",
        };
    } else if (step === 2) {
        // Step 3: OTP generation & delivery via SNS
        const otp = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit
        const phone = event.request.userAttributes["phone_number"];

        console.log(`[OTP] Generated OTP for ${event.userName}: ${otp}`);

        if (phone) {
            try {
                await sns.send(
                    new PublishCommand({
                        Message: `Your ArogyaSutra verification code is: ${otp}. Valid for 5 minutes. Do not share this code.`,
                        PhoneNumber: phone,
                        MessageAttributes: {
                            "AWS.SNS.SMS.SenderID": {
                                DataType: "String",
                                StringValue: "ArogyaOTP",
                            },
                            "AWS.SNS.SMS.SMSType": {
                                DataType: "String",
                                StringValue: "Transactional",
                            },
                        },
                    })
                );
                console.log(`[OTP] SMS sent to ${phone}`);
            } catch (snsErr) {
                // Don't fail the auth flow if SMS fails — log and continue
                console.error(`[OTP] SNS SMS failed:`, snsErr);
            }
        }

        // Mask phone for client display
        const masked = phone
            ? `+${phone.slice(1, 3)}XXXXXX${phone.slice(-4)}`
            : "****";

        event.response.publicChallengeParameters = {
            type: "OTP",
            maskedPhone: masked,
            // DEV ONLY — remove in production
            devOtp: otp,
        };
        event.response.privateChallengeParameters = {
            answer: otp,
        };
    }

    return event;
};
