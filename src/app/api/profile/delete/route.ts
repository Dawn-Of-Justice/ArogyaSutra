// ============================================================
// DELETE /api/profile/delete
// Permanently deletes a patient account from Cognito.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { deletePatientUser } from "../../../../lib/aws/cognito";

export async function DELETE(req: NextRequest) {
    try {
        const { userId } = await req.json();
        if (!userId) {
            return NextResponse.json({ error: "Missing userId" }, { status: 400 });
        }
        await deletePatientUser(userId);
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("[profile/delete]", err);
        return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
    }
}
