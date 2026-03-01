// ============================================================
// Patient-Aware RAG Chat API
// Used by patients (querying own records) and doctors
// (querying a verified patient's records)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import * as ragService from "../../../../lib/services/rag.service";

export async function POST(req: NextRequest) {
    try {
        const {
            query,
            patientId,
            queryBy,      // "PATIENT" | "DOCTOR"
            queryByUserId,
            conversationId,
        } = await req.json();

        if (!query?.trim() || !patientId) {
            return NextResponse.json(
                { error: "query and patientId are required" },
                { status: 400 }
            );
        }

        const response = await ragService.query({
            queryText: query,
            patientId,
            queryBy: queryBy || "PATIENT",
            queryByUserId: queryByUserId || patientId,
            conversationId,
        });

        return NextResponse.json(response);
    } catch (err) {
        console.error("[assistant/rag]", err);
        return NextResponse.json({ error: "Failed to process query" }, { status: 500 });
    }
}
