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
    TimelineFilters,
} from "../lib/types/timeline";
import { useAuth } from "./useAuth";

export function useTimeline() {
    const { patient } = useAuth();
    const [entries, setEntries] = useState<HealthEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [page, setPage] = useState(1);

    const loadTimeline = useCallback(
        async (filters?: TimelineFilters) => {
            if (!patient) return;
            setIsLoading(true);
            setError(null);

            try {
                const request: TimelineRequest = {
                    patientId: patient.patientId,
                    filters: filters || {},
                    options: { page: 1, pageSize: 20, sortOrder: "newest", groupBy: "date" },
                };
                const response = await timelineService.getTimeline(request, null as unknown as CryptoKey);
                setEntries(response.entries);
                setHasMore(response.hasMore);
                setPage(1);
            } catch (e) {
                setError((e as Error).message);
            } finally {
                setIsLoading(false);
            }
        },
        [patient]
    );

    const loadMore = useCallback(async () => {
        if (!patient || !hasMore) return;
        setIsLoading(true);

        try {
            const request: TimelineRequest = {
                patientId: patient.patientId,
                filters: {},
                options: { page: page + 1, pageSize: 20, sortOrder: "newest", groupBy: "date" },
            };
            const response = await timelineService.getTimeline(request, null as unknown as CryptoKey);
            setEntries((prev) => [...prev, ...response.entries]);
            setHasMore(response.hasMore);
            setPage((p) => p + 1);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setIsLoading(false);
        }
    }, [patient, hasMore, page]);

    return {
        entries,
        isLoading,
        error,
        hasMore,
        loadTimeline,
        loadMore,
    };
}
