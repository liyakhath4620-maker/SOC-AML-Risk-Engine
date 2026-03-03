"use client";

import { useMemo } from "react";

interface CVSSRiskScoreProps {
    threats: { threat_data?: { confidence_score?: number } }[];
}

function getScoreColor(score: number): string {
    if (score >= 9.0) return "var(--color-accent-red)";
    if (score >= 7.0) return "var(--color-neon-orange)";
    if (score >= 4.0) return "var(--color-accent-amber)";
    return "var(--color-text-muted)";
}

function getLabel(score: number): string {
    if (score >= 9.0) return "CRITICAL";
    if (score >= 7.0) return "HIGH";
    if (score >= 4.0) return "MEDIUM";
    return "LOW";
}

export default function CVSSRiskScore({ threats }: CVSSRiskScoreProps) {
    const score = useMemo(() => {
        if (threats.length === 0) return 0;
        const total = threats.reduce((acc, t) => {
            return acc + (t.threat_data?.confidence_score || 0);
        }, 0);
        return Math.min(Number(((total / threats.length) * 10).toFixed(1)), 10);
    }, [threats]);

    const color = getScoreColor(score);
    const label = getLabel(score);
    const circumference = 2 * Math.PI * 52;
    const progress = (score / 10) * circumference;
    const offset = circumference - progress;

    return (
        <div
            className="flex flex-col items-center justify-center p-4"
            style={{ animation: "float-in 0.5s ease-out 0.2s both" }}
        >
            <div className="flex items-center gap-2 self-start mb-3">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color, animation: "status-blink 1.5s infinite" }} />
                <h3
                    className="text-xs font-bold tracking-widest uppercase"
                    style={{ color, fontFamily: "JetBrains Mono, monospace" }}
                >
                    CVSS Risk Score
                </h3>
            </div>

            <div className="relative flex items-center justify-center" style={{ width: "160px", height: "160px" }}>
                {/* Subtle glow */}
                <div
                    className="absolute inset-0 rounded-full"
                    style={{
                        boxShadow: `0 0 20px ${color}1a, 0 0 40px ${color}0d`,
                    }}
                />
                <svg
                    width="160"
                    height="160"
                    viewBox="0 0 120 120"
                    className="absolute"
                    style={{ transform: "rotate(-90deg)", filter: `drop-shadow(0 0 15px ${color}cc)` }}
                >
                    <circle cx="60" cy="60" r="52" fill="none" stroke="var(--color-bg-tertiary)" strokeWidth="6" />
                    <circle
                        cx="60"
                        cy="60"
                        r="52"
                        fill="none"
                        stroke={color}
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        style={{
                            transition: "stroke-dashoffset 1s ease-out, stroke 0.5s ease",
                        }}
                    />
                </svg>
                <div className="flex flex-col items-center z-10">
                    <span
                        className="text-4xl font-black tabular-nums"
                        style={{
                            color,
                            fontFamily: "JetBrains Mono, monospace",
                            animation: score >= 7.0 ? "number-glow 3s ease-in-out infinite" : undefined,
                        }}
                    >
                        {score.toFixed(1)}
                    </span>
                    <span
                        className="text-[10px] font-bold tracking-[0.2em] mt-0.5"
                        style={{ color, fontFamily: "JetBrains Mono, monospace" }}
                    >
                        {label}
                    </span>
                </div>
            </div>

            <div className="mt-3 flex items-center gap-3 text-[10px]" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                <span className="text-gray-500">0</span>
                <div className="flex-1 h-1.5 rounded-full bg-gray-800 relative overflow-hidden">
                    <div
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{
                            width: `${(score / 10) * 100}%`,
                            background: `linear-gradient(90deg, var(--color-text-muted), var(--color-accent-amber), var(--color-neon-orange), var(--color-accent-red))`,
                            transition: "width 1s ease-out",
                        }}
                    />
                </div>
                <span className="text-gray-500">10</span>
            </div>
        </div>
    );
}
