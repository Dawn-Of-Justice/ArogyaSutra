// ============================================================
// ArogyaSutra Animated Logo
// Self-drawing effect: cross reveal → ECG stroke → text fade
// ============================================================

"use client";

import React from "react";

interface Props {
    /** Width of the logo. Height is derived automatically (aspect ratio). */
    width?: number;
    /** Delay before animation starts, in seconds */
    delay?: number;
    /** Background fill. Pass "none" for transparent. */
    background?: string;
    /** Static ID suffix to prevent hydration mismatch — use different values if rendering multiple logos */
    idSuffix?: string;
}

export default function LogoAnimated({
    width = 440,
    delay = 0,
    background = "#0d1f3c",
    idSuffix = "a",
}: Props) {
    const height = Math.round(width * 0.82);
    const id = `logo-${idSuffix}`;

    // ECG path — left to right, horizontal midline through the cross
    // Viewbox is 440 x 360. Cross center ~ (218, 190)
    const ecgD = [
        "M 85,190",
        "L 148,190",
        "L 158,190",
        "L 163,174",   // small P-wave
        "L 168,190",
        "L 178,190",
        "L 186,118",   // QRS up
        "L 194,250",   // QRS down
        "L 200,190",   // back to baseline
        "L 215,190",
        "L 225,205",   // T-wave up
        "L 238,205",
        "L 248,190",   // T-wave down
        "L 270,190",
        "L 275,182",   // small tail blip
        "L 280,190",
        "L 355,190",
    ].join(" ");

    return (
        <svg
            viewBox="0 0 440 360"
            width={width}
            height={height}
            xmlns="http://www.w3.org/2000/svg"
            style={{ display: "block" }}
        >
            <defs>
                {/* Clip that sweeps left → right to reveal the cross */}
                <clipPath id={`${id}-sweep`}>
                    <rect x="-440" y="0" width="440" height="360">
                        <animate
                            attributeName="x"
                            from="-440" to="0"
                            dur="1.2s"
                            begin={`${delay}s`}
                            fill="freeze"
                            calcMode="spline"
                            keySplines="0.4 0 0.2 1"
                        />
                    </rect>
                </clipPath>

                {/* Clip that sweeps left → right for the ECG line (starts later) */}
                <clipPath id={`${id}-ecg`}>
                    <rect x="-440" y="0" width="440" height="360">
                        <animate
                            attributeName="x"
                            from="-440" to="0"
                            dur="1.4s"
                            begin={`${delay + 0.8}s`}
                            fill="freeze"
                            calcMode="spline"
                            keySplines="0.25 0 0.75 1"
                        />
                    </rect>
                </clipPath>

                {/* Drop shadow for the cross — makes the white arm visible on light backgrounds */}
                <filter id={`${id}-shadow`} x="-15%" y="-15%" width="130%" height="130%">
                    <feDropShadow dx="0" dy="2" stdDeviation="8" floodColor="#0d1f3c" floodOpacity="0.18" />
                </filter>
            </defs>

            {/* Background */}
            {background !== "none" && (
                <rect width="440" height="360" fill={background} />
            )}

            {/* ---- Medical Cross (two overlapping rounded rects) ---- */}
            {/* These are revealed by the sweep clip path */}
            <g clipPath={`url(#${id}-sweep)`} filter={`url(#${id}-shadow)`}>
                {/* White rounded rect (upper-left) */}
                <rect
                    x="132" y="108"
                    width="118" height="118"
                    rx="22" ry="22"
                    fill="#ffffff"
                    stroke="#e2e8f0"
                    strokeWidth="1"
                />
                {/* Coral rounded rect (lower-right) */}
                <rect
                    x="190" y="166"
                    width="118" height="118"
                    rx="22" ry="22"
                    fill="#f06b6b"
                />
            </g>

            {/* ---- ECG Waveform (drawn stroke) ---- */}
            <g clipPath={`url(#${id}-ecg)`}>
                <path
                    d={ecgD}
                    fill="none"
                    stroke="#0d1f3c"
                    strokeWidth="5.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </g>

            {/* ---- Text: AROGYASUTRA ---- */}
            <text
                x="220" y="316"
                textAnchor="middle"
                fontFamily="'Inter', 'Helvetica Neue', Arial, sans-serif"
                fontWeight="900"
                fontSize="46"
                letterSpacing="3"
                fill="#f06b6b"
                opacity="0"
            >
                AROGYASUTRA
                <animate
                    attributeName="opacity"
                    from="0" to="1"
                    dur="0.7s"
                    begin={`${delay + 2.0}s`}
                    fill="freeze"
                />
            </text>

            {/* ---- Tagline ---- */}
            <text
                x="220" y="344"
                textAnchor="middle"
                fontFamily="'Inter', 'Helvetica Neue', Arial, sans-serif"
                fontWeight="500"
                fontSize="13"
                letterSpacing="4"
                fill="#94a3b8"
                opacity="0"
            >
                YOUR HEALTH, YOUR SOVEREIGNTY
                <animate
                    attributeName="opacity"
                    from="0" to="1"
                    dur="0.7s"
                    begin={`${delay + 2.3}s`}
                    fill="freeze"
                />
            </text>
        </svg>
    );
}
