// ============================================================
// Countdown Timer Hook
// Used for Break-Glass countdown and OTP expiry
// ============================================================

"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UseCountdownOptions {
    /** Duration in seconds */
    duration: number;
    /** Callback when countdown reaches zero */
    onExpire?: () => void;
    /** Auto-start on mount */
    autoStart?: boolean;
}

interface UseCountdownReturn {
    /** Remaining seconds */
    remaining: number;
    /** Progress percentage (1 → 0) */
    progress: number;
    /** Whether the countdown is active */
    isActive: boolean;
    /** Whether the countdown has expired */
    isExpired: boolean;
    /** Start the countdown */
    start: () => void;
    /** Pause the countdown */
    pause: () => void;
    /** Reset to initial duration */
    reset: () => void;
    /** Formatted time string (MM:SS) */
    formatted: string;
}

export function useCountdown({
    duration,
    onExpire,
    autoStart = false,
}: UseCountdownOptions): UseCountdownReturn {
    const [remaining, setRemaining] = useState(duration);
    const [isActive, setIsActive] = useState(autoStart);
    const [isExpired, setIsExpired] = useState(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const onExpireRef = useRef(onExpire);
    onExpireRef.current = onExpire;

    useEffect(() => {
        if (!isActive || isExpired) return;

        intervalRef.current = setInterval(() => {
            setRemaining((prev) => {
                if (prev <= 1) {
                    setIsActive(false);
                    setIsExpired(true);
                    onExpireRef.current?.();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isActive, isExpired]);

    const start = useCallback(() => {
        setIsActive(true);
        setIsExpired(false);
    }, []);

    const pause = useCallback(() => {
        setIsActive(false);
    }, []);

    const reset = useCallback(() => {
        setRemaining(duration);
        setIsActive(false);
        setIsExpired(false);
    }, [duration]);

    const progress = duration > 0 ? remaining / duration : 0;

    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    const formatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

    return { remaining, progress, isActive, isExpired, start, pause, reset, formatted };
}
