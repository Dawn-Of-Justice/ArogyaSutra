// ============================================================
// Notification Read State API
// GET  /api/notifications/read-state?userId=<id>  → fetch read IDs
// POST /api/notifications/read-state              → persist read IDs
// Backed by DynamoDB (arogyasutra-user-prefs table)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getNotifReadIds, putNotifReadIds } from "../../../../lib/aws/dynamodb";

export async function GET(req: NextRequest) {
    const userId = req.nextUrl.searchParams.get("userId");

    if (!userId) {
        return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    try {
        const readIds = await getNotifReadIds(userId);
        return NextResponse.json({ readIds });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("Failed to fetch notification read state:", message);
        // Return empty rather than crashing — client falls back to localStorage
        return NextResponse.json({ readIds: [], error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { userId, readIds } = await req.json();

        if (!userId || !Array.isArray(readIds)) {
            return NextResponse.json(
                { error: "userId and readIds[] are required" },
                { status: 400 }
            );
        }

        await putNotifReadIds(userId, readIds as number[]);
        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("Failed to persist notification read state:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
