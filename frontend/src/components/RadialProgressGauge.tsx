"use client";

interface RadialProgressGaugeProps {
    score: number; // 0–100
    label?: string;
    size?: number;
}

export default function RadialProgressGauge({
    score,
    label = "Mule Ring Probability",
    size = 48,
}: RadialProgressGaugeProps) {
    const radius = (size - 8) / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = (Math.min(score, 100) / 100) * circumference;
    const offset = circumference - progress;

    const color =
        score >= 80 ? "#dc2626" : score >= 50 ? "#d97706" : score >= 25 ? "#2563eb" : "#059669";

    return (
        <div className="flex items-center gap-2" title={`${label}: ${score}%`}>
            <div className="relative" style={{ width: size, height: size }}>
                <svg
                    width={size}
                    height={size}
                    viewBox={`0 0 ${size} ${size}`}
                    style={{ transform: "rotate(-90deg)" }}
                >
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke="#e2e6ea"
                        strokeWidth="3"
                    />
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke={color}
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        style={{
                            transition: "stroke-dashoffset 0.8s ease-out, stroke 0.3s ease",
                            filter: `drop-shadow(0 0 3px ${color}60)`,
                        }}
                    />
                </svg>
                <div
                    className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums"
                    style={{ color, fontFamily: "JetBrains Mono, monospace" }}
                >
                    {Math.round(score)}
                </div>
            </div>
            <div className="hidden md:flex flex-col">
                <span
                    className="text-[8px] uppercase tracking-widest text-gray-400"
                    style={{ fontFamily: "JetBrains Mono, monospace" }}
                >
                    {label}
                </span>
                <span
                    className="text-[10px] font-bold"
                    style={{ color, fontFamily: "JetBrains Mono, monospace" }}
                >
                    {score >= 80 ? "CRITICAL" : score >= 50 ? "HIGH" : score >= 25 ? "MODERATE" : "LOW"}
                </span>
            </div>
        </div>
    );
}
