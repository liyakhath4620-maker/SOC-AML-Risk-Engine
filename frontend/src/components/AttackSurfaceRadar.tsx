"use client";

import { useMemo } from "react";
import {
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar,
    ResponsiveContainer,
    Tooltip,
} from "recharts";

interface ThreatData {
    threat_data?: {
        breach_details?: { alert_type?: string };
        confidence_score?: number;
    };
    risk_level?: string;
}

interface AttackSurfaceRadarProps {
    threats: ThreatData[];
}

const VECTOR_MAP: Record<string, string> = {
    account_takeover: "Authentication",
    credential_stuffing: "Authentication",
    phishing: "Social Engineering",
    sim_swap: "Social Engineering",
    malware: "Network Access",
    anomalous_behavior: "Lateral Movement",
    rapid_movement: "Data Exfiltration",
    crypto_offramp: "Data Exfiltration",
};

const VECTORS = [
    "Authentication",
    "Network Access",
    "Data Exfiltration",
    "Lateral Movement",
    "Privilege Escalation",
    "Social Engineering",
];

export default function AttackSurfaceRadar({ threats }: AttackSurfaceRadarProps) {
    const data = useMemo(() => {
        const scores: Record<string, number[]> = {};
        VECTORS.forEach((v) => (scores[v] = []));

        threats.forEach((t) => {
            const alertType = t.threat_data?.breach_details?.alert_type || "";
            const vector = VECTOR_MAP[alertType] || "Lateral Movement";
            const confidence = t.threat_data?.confidence_score || 0.3;
            if (scores[vector]) {
                scores[vector].push(confidence * 100);
            }
        });

        return VECTORS.map((v) => {
            const vals = scores[v];
            const avg =
                vals.length > 0
                    ? vals.reduce((a, b) => a + b, 0) / vals.length
                    : Math.random() * 20 + 15;
            return {
                vector: v,
                score: Math.round(avg),
                fullMark: 100,
            };
        });
    }, [threats]);

    return (
        <div
            className="glass-panel p-4 flex flex-col"
            style={{ animation: "float-in 0.5s ease-out" }}
        >
            <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--color-neon-orange)", animation: "status-blink 2s infinite" }} />
                <h3
                    className="text-xs font-bold tracking-widest uppercase"
                    style={{ color: "var(--color-neon-orange)", fontFamily: "JetBrains Mono, monospace" }}
                >
                    Attack Surface Radar
                </h3>
            </div>
            <div className="flex-1" style={{ minHeight: "300px" }}>
                <ResponsiveContainer width="100%" height={300}>
                    <RadarChart cx="50%" cy="50%" outerRadius="72%" data={data}>
                        <PolarGrid stroke="#333333" />
                        <PolarAngleAxis
                            dataKey="vector"
                            tick={{ fill: "#9ca3af", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
                        />
                        <PolarRadiusAxis
                            angle={30}
                            domain={[0, 100]}
                            tick={{ fill: "#9ca3af", fontSize: 8 }}
                            axisLine={false}
                        />
                        <Radar
                            name="Threat Level"
                            dataKey="score"
                            stroke="var(--color-neon-orange)"
                            fill="var(--color-neon-orange)"
                            fillOpacity={0.4}
                            strokeWidth={2}
                            dot={{ r: 3, fill: "var(--color-neon-orange)", stroke: "#ff8c33", strokeWidth: 1 }}
                            style={{ filter: "drop-shadow(0 0 8px rgba(255,107,0,0.6))" }}
                        />
                        <Tooltip
                            contentStyle={{
                                background: "rgba(17, 24, 39, 0.9)",
                                border: "1px solid var(--color-border)",
                                borderRadius: "8px",
                                fontFamily: "JetBrains Mono, monospace",
                                fontSize: "11px",
                                color: "#f9fafb",
                                boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                                backdropFilter: "blur(4px)",
                            }}
                            formatter={(value: any) => [`${value}%`, "Threat Level"]}
                        />
                    </RadarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
