// ============================================================
// ArogyaSutra Animated Logo
// Cross: explicit plus-sign shape, split white/coral
// ECG:   continuous looping stroke-dashoffset heartbeat
// ============================================================

"use client";

import React from "react";

interface Props {
    width?: number;
    delay?: number;
    background?: string;
    idSuffix?: string;
    showText?: boolean;
}

export default function LogoAnimated({
    width = 440,
    delay = 0,
    background = "#0d1f3c",
    idSuffix = "a",
    showText = true,
}: Props) {
    const height = Math.round(width * 0.82);
    const id = `logo-${idSuffix}`;

    // ── Cross geometry (explicit plus sign, centered at 220,165) ──
    //
    //   Vertical bar:   x=185 w=70  y=65  h=200   → x:185-255, y:65-265
    //   Horizontal bar: x=115 w=210 y=130 h=70    → x:115-325, y:130-200
    //
    //   Arms (each 70×65px):
    //     Top:    x=185-255, y= 65-130  (vertical only)
    //     Bottom: x=185-255, y=200-265  (vertical only)
    //     Left:   x=115-185, y=130-200  (horizontal only)
    //     Right:  x=255-325, y=130-200  (horizontal only)
    //     Center: x=185-255, y=130-200  (both)
    //
    //   Bounding box: x=115-325 (center=220 ✓), y=65-265 (center=165 ✓)
    //
    // Color split: diagonal through center (220,165)
    //   White/light fills everything ABOVE-LEFT of center
    //   Coral fills everything BELOW-RIGHT of center

    // ECG at y=165, runs x=80 → 360
    // Activity centered at x=220 (cross center):
    //   P-wave: x=162-175, QRS: x=187-210, T-wave: x=222-252  → centroid ≈ 218
    const ecgD = [
        "M 80,165",
        "L 162,165",
        "L 167,150",    // P-wave up
        "L 172,165",    // P-wave down
        "L 187,165",
        "L 194,90",     // QRS spike up  (75px above baseline)
        "L 201,234",    // QRS spike down (69px below baseline)
        "L 210,165",    // return to baseline
        "L 222,165",
        "L 231,183",    // T-wave up
        "L 244,183",    // T-wave plateau
        "L 253,165",    // T-wave down
        "L 272,165",
        "L 277,157",    // tail blip
        "L 282,165",
        "L 360,165",
    ].join(" ");

    const PATH_LEN = 600;

    return (
        <svg
            viewBox="0 0 440 375"
            width={width}
            height={Math.round(width * 0.853)}
            xmlns="http://www.w3.org/2000/svg"
            style={{ display: "block", margin: "0 auto" }}
        >
            <defs>
                {/* ── The plus-sign shape used as clip path ── */}
                <clipPath id={`${id}-cross`}>
                    {/* Vertical bar */}
                    <rect x="185" y="65" width="70" height="200" rx="18" ry="18" />
                    {/* Horizontal bar */}
                    <rect x="115" y="130" width="210" height="70" rx="18" ry="18" />
                </clipPath>

                {/* ── Diagonal "white" / "coral" split mask ── */}
                {/* Everything above-left of diagonal → white arm */}
                <clipPath id={`${id}-white`}>
                    <polygon points="115,65 255,65 255,130 325,130 325,165 115,165" />
                </clipPath>
                {/* Everything below-right of diagonal → coral arm */}
                <clipPath id={`${id}-coral`}>
                    <polygon points="115,165 325,165 325,200 255,200 255,265 185,265 185,200 115,200" />
                </clipPath>

                {/* ── Sweep clip to reveal cross left→right ── */}
                <clipPath id={`${id}-sweep`}>
                    <rect x="-440" y="0" width="440" height="330">
                        <animate
                            attributeName="x"
                            from="-440" to="0"
                            dur="1.4s"
                            begin={`${delay}s`}
                            fill="freeze"
                            calcMode="spline"
                            keySplines="0.4 0 0.2 1"
                        />
                    </rect>
                </clipPath>

                {/* ── Shadow for cross ── */}
                <filter id={`${id}-sh`} x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="4" stdDeviation="10"
                        floodColor="#0d1f3c" floodOpacity="0.25" />
                </filter>
            </defs>

            {/* Background */}
            {background !== "none" && (
                <rect width="440" height="375" fill={background} />
            )}

            {/* ─────────────────────────────────────────────────
                CROSS — clipped to plus shape, split two colours
                Revealed by left→right sweep
            ───────────────────────────────────────────────── */}
            <g clipPath={`url(#${id}-sweep)`}>
                <g filter={`url(#${id}-sh)`}>
                    {/* Full cross background (coral, catches any gaps) */}
                    <g clipPath={`url(#${id}-cross)`}>
                        <rect x="115" y="65" width="210" height="200" fill="#f06b6b" />
                    </g>

                    {/* White / light-blue overlay on top arm + left arm */}
                    <g clipPath={`url(#${id}-cross)`}>
                        {/* Top arm (vertical bar, above center) */}
                        <rect x="185" y="65" width="70" height="100" fill="#ffffff" />
                        {/* Left arm (horizontal bar, left of center) */}
                        <rect x="115" y="130" width="105" height="70" fill="#ffffff" />
                    </g>

                    {/* Subtle border on white sections only */}
                    <g clipPath={`url(#${id}-cross)`}>
                        <rect x="185" y="65" width="70" height="100"
                            fill="none" stroke="#d8e0ee" strokeWidth="1.5" />
                        <rect x="115" y="130" width="105" height="70"
                            fill="none" stroke="#d8e0ee" strokeWidth="1.5" />
                    </g>
                </g>
            </g>

            {/* ─────────────────────────────────────────────────
                ECG HEARTBEAT — continuous loop like cardiac monitor
            ───────────────────────────────────────────────── */}
            <path
                d={ecgD}
                fill="none"
                stroke="#0d1f3c"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={PATH_LEN}
                strokeDashoffset={PATH_LEN}
            >
                {/* Brief pause → draw → hold → reset, repeat */}
                <animate
                    attributeName="stroke-dashoffset"
                    values={`${PATH_LEN};${PATH_LEN};0;0;${PATH_LEN}`}
                    keyTimes="0;0.04;0.65;0.88;1"
                    dur="2.8s"
                    begin={`${delay + 0.9}s`}
                    repeatCount="indefinite"
                    calcMode="linear"
                />
            </path>

            {/* AROGYASUTRA + Tagline — hidden when showText=false */}
            {showText && (
                <>
                    <text
                        x="220" y="316"
                        textAnchor="middle"
                        fontFamily="'Inter', 'Helvetica Neue', Arial, sans-serif"
                        fontWeight="900"
                        fontSize="44"
                        letterSpacing="3"
                        fill="#f06b6b"
                        opacity="0"
                    >
                        AROGYASUTRA
                        <animate attributeName="opacity" from="0" to="1"
                            dur="0.8s" begin={`${delay + 2.2}s`} fill="freeze" />
                    </text>

                    <text
                        x="220" y="350"
                        textAnchor="middle"
                        fontFamily="'Inter', 'Helvetica Neue', Arial, sans-serif"
                        fontWeight="600"
                        fontSize="15"
                        letterSpacing="3"
                        fill="#475569"
                        opacity="0"
                    >
                        YOUR HEALTH, YOUR SOVEREIGNTY
                        <animate attributeName="opacity" from="0" to="1"
                            dur="0.8s" begin={`${delay + 2.6}s`} fill="freeze" />
                    </text>
                </>
            )}
        </svg>
    );
}
