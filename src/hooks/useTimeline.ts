// ============================================================
// Timeline Hook
// Loads & manages the chronological health timeline
// ============================================================

"use client";

import { useState, useCallback } from "react";
import * as timelineService from "../lib/services/timeline.service";
import type {
    HealthEntry,
    TimelineRequest,
    TimelineResponse,
    TimelineFilters,
} from "../lib/types/timeline";
import type { ExtractionPreview } from "../lib/types/medvision";
import { useAuth } from "./useAuth";

export function useTimeline() {
    const { patient, masterKey } = useAuth();
    const [entries, setEntries] = useState<HealthEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [page, setPage] = useState(1);

    const loadTimeline = useCallback(
        async (filters?: TimelineFilters) => {
            if (!patient || !masterKey) return;
            setIsLoading(true);
            setError(null);

            try {
                const request: TimelineRequest = {
                    patientId: patient.patientId,
                    filters: filters || {},
                    options: { page: 1, pageSize: 20, sortOrder: "newest", groupBy: "date" },
                };
                const response = await timelineService.getTimeline(request, masterKey);
                setEntries(response.entries);
                setHasMore(response.hasMore);
                setPage(1);
            } catch (e) {
                setError((e as Error).message);
            } finally {
                setIsLoading(false);
            }
        },
        [patient, masterKey]
    );

    const loadMore = useCallback(async () => {
        if (!patient || !masterKey || !hasMore) return;
        setIsLoading(true);

        try {
            const request: TimelineRequest = {
                patientId: patient.patientId,
                filters: {},
                options: { page: page + 1, pageSize: 20, sortOrder: "newest", groupBy: "date" },
            };
            const response = await timelineService.getTimeline(request, masterKey);
            setEntries((prev) => [...prev, ...response.entries]);
            setHasMore(response.hasMore);
            setPage((p) => p + 1);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setIsLoading(false);
        }
    }, [patient, masterKey, hasMore, page]);

    const uploadDocument = useCallback(
        async (imageBuffer: ArrayBuffer) => {
            if (!patient || !masterKey) throw new Error("Not authenticated");
            setIsLoading(true);
            setError(null);

            try {
                const result = await timelineService.uploadAndProcess(
                    imageBuffer,
                    patient.patientId,
                    masterKey
                );
                return result;
            } catch (e) {
                setError((e as Error).message);
                throw e;
            } finally {
                setIsLoading(false);
            }
        },
        [patient, masterKey]
    );

    const confirmDocument = useCallback(
        async (
            entryId: string,
            preview: ExtractionPreview,
            edits?: Record<string, string>,
            date?: string
        ) => {
            if (!patient || !masterKey) throw new Error("Not authenticated");
            setIsLoading(true);

            try {
                const entry = await timelineService.confirmAndSave(
                    entryId,
                    patient.patientId,
                    masterKey,
                    preview,
                    edits,
                    date
                );
                setEntries((prev) => [entry, ...prev]);
                return entry;
            } catch (e) {
                setError((e as Error).message);
                throw e;
            } finally {
                setIsLoading(false);
            }
        },
        [patient, masterKey]
    );

    const viewEntry = useCallback(
        async (entryId: string) => {
            if (!patient || !masterKey) throw new Error("Not authenticated");

            try {
                return await timelineService.getEntry(
                    patient.patientId,
                    entryId,
                    masterKey
                );
            } catch (e) {
                setError((e as Error).message);
                throw e;
            }
        },
        [patient, masterKey]
    );

    return {
        entries,
        isLoading,
        error,
        hasMore,
        loadTimeline,
        loadMore,
        uploadDocument,
        confirmDocument,
        viewEntry,
    };
}
