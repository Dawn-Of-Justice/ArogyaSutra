// ============================================================
// GeminiIcon — Gemini-style 4-pointed star SVG icon
// ============================================================

import React from "react";

interface GeminiIconProps {
    size?: number;
    className?: string;
    style?: React.CSSProperties;
}

export function GeminiIcon({ size = 18, className, style }: GeminiIconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 28 28"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            style={style}
        >
            <path d="M14 1 C14 8.5 8.5 14 1 14 C8.5 14 14 19.5 14 27 C14 19.5 19.5 14 27 14 C19.5 14 14 8.5 14 1Z" />
        </svg>
    );
}
