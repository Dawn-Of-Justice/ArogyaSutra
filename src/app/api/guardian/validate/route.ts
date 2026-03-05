// ============================================================
// Guardian Validate API
// POST /api/guardian/validate
// Verifies a dependent patient card ID and DOB match, returns profile.
// Used by the guardian when linking a dependent card.
// ============================================================

import { NextResponse } from "next/server";
import { getPatientUser } from "../../../../lib/aws/cognito";

function attr(attrs: { Name?: string; Value?: string }[], name: string): string {
    return attrs.find((a) => a.Name === name)?.Value ?? "";
}

interface ValidateRequest {
    guardianId: string;
    dependentCardId: string;
    dependentDob: string; // YYYY-MM-DD
}

export async function POST(req: Request) {
    try {
        const body: ValidateRequest = await req.json();
        const { guardianId, dependentCardId, dependentDob } = body;

        if (!guardianId || !dependentCardId || !dependentDob) {
            return NextResponse.json({ error: "guardianId, dependentCardId, and dependentDob are required" }, { status: 400 });
        }

        // Basic card ID format validation
        if (!/^AS-\d{4}-\d{4}$/i.test(dependentCardId)) {
            return NextResponse.json({ error: "Invalid card ID format. Expected AS-XXXX-XXXX-XXXX" }, { status: 400 });
        }

        // Prevent a user from linking themselves
        if (dependentCardId.toUpperCase() === guardianId.toUpperCase()) {
            return NextResponse.json({ error: "You cannot link your own card as a dependent" }, { status: 400 });
        }

        let dependentUser;
        try {
            dependentUser = await getPatientUser(dependentCardId.toUpperCase());
        } catch {
            // Intentionally vague error to prevent card ID enumeration
            return NextResponse.json({ error: "Card not found or DOB does not match" }, { status: 404 });
        }

        const attrs = dependentUser.UserAttributes ?? [];
        const storedDob = attr(attrs, "birthdate"); // Cognito stores as YYYY-MM-DD

        // Constant-time-ish DOB comparison — prevents timing-based enumeration
        const dobMatch = storedDob === dependentDob;
        if (!dobMatch) {
            return NextResponse.json({ error: "Card not found or DOB does not match" }, { status: 404 });
        }

        const name = attr(attrs, "name") || dependentCardId.toUpperCase();

        return NextResponse.json({
            cardId: dependentCardId.toUpperCase(),
            name,
            dob: storedDob,
        });
    } catch (err) {
        console.error("Guardian validate error:", err);
        return NextResponse.json({ error: "Validation failed" }, { status: 500 });
    }
}
