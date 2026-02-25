// ============================================================
// VerifyAuthChallenge Lambda
// Verifies the user's response to each challenge step:
//   Step 1: Card ID match
//   Step 2: DOB match
//   Step 3: OTP match
// ============================================================

import type { VerifyAuthChallengeResponseTriggerEvent } from "aws-lambda";

export const handler = async (
    event: VerifyAuthChallengeResponseTriggerEvent
): Promise<VerifyAuthChallengeResponseTriggerEvent> => {
    const expected = event.request.privateChallengeParameters?.answer || "";
    const provided = event.request.challengeAnswer || "";

    // Case-insensitive comparison (for Card ID format variations)
    event.response.answerCorrect =
        provided.trim().toLowerCase() === expected.trim().toLowerCase();

    return event;
};
