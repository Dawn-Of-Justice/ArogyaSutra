// ============================================================
// DefineAuthChallenge Lambda
// Routes the Cognito CUSTOM_AUTH flow through 3 steps:
//   Step 1: Card ID verification
//   Step 2: DOB verification
//   Step 3: OTP verification
// ============================================================

import type { DefineAuthChallengeTriggerEvent } from "aws-lambda";

export const handler = async (
    event: DefineAuthChallengeTriggerEvent
): Promise<DefineAuthChallengeTriggerEvent> => {
    const sessions = event.request.session;

    if (sessions.length === 0) {
        // Step 1: Start with Card ID challenge
        event.response.challengeName = "CUSTOM_CHALLENGE";
        event.response.issueTokens = false;
        event.response.failAuthentication = false;
    } else if (
        sessions.length === 1 &&
        sessions[0].challengeName === "CUSTOM_CHALLENGE" &&
        sessions[0].challengeResult === true
    ) {
        // Step 2: Card ID passed → DOB challenge
        event.response.challengeName = "CUSTOM_CHALLENGE";
        event.response.issueTokens = false;
        event.response.failAuthentication = false;
    } else if (
        sessions.length === 2 &&
        sessions[1].challengeName === "CUSTOM_CHALLENGE" &&
        sessions[1].challengeResult === true
    ) {
        // Step 3: DOB passed → OTP challenge
        event.response.challengeName = "CUSTOM_CHALLENGE";
        event.response.issueTokens = false;
        event.response.failAuthentication = false;
    } else if (
        sessions.length === 3 &&
        sessions[2].challengeName === "CUSTOM_CHALLENGE" &&
        sessions[2].challengeResult === true
    ) {
        // All 3 steps passed → issue tokens
        event.response.issueTokens = true;
        event.response.failAuthentication = false;
    } else {
        // Challenge failed
        event.response.issueTokens = false;
        event.response.failAuthentication = true;
    }

    return event;
};
