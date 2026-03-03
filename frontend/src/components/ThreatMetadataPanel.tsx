"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface ThreatData {
    risk_level?: string;
    status?: string;
    threat_data?: {
        confidence_score?: number;
        breach_details?: { source?: string };
    };
}

interface ThreatMetadataPanelProps {
    threats: ThreatData[];
}

const RISK_COLORS: Record<string, string> = {
    CRITICAL: "var(--color-accent-red)",
    HIGH: "var(--color-neon-orange)",
    MEDIUM: "var(--color-accent-amber)",
    LOW: "var(--color-accent-green)",
    INFORMATIONAL: "var(--color-text-muted)",
};

export default function ThreatMetadataPanel({ threats }: ThreatMetadataPanelProps) {
    const stats = useMemo(() => {
        const riskDistribution: Record<string, number> = {};
        let totalConfidence = 0;
        let confidenceCount = 0;
        const sources = new Set<string>();

        threats.forEach((t) => {
            const level = t.risk_level || "LOW";
            riskDistribution[level] = (riskDistribution[level] || 0) + 1;

            const conf = t.threat_data?.confidence_score || 0;
            if (conf > 0) {
                totalConfidence += conf;
                confidenceCount++;
            }
            sources.add(t.threat_data?.breach_details?.source || "SOC");
        });

        const donutData = Object.entries(riskDistribution).map(([name, value]) => ({
            name,
            value,
            color: RISK_COLORS[name] || "#9ca3af",
        }));

        return {
            total: threats.length,
            active: threats.filter((t) => t.status !== "Dismissed" && t.status !== "False Positive").length,
            avgConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
            sources: sources.size,
            donutData,
        };
    }, [threats]);

    return (
        <div
            className="glass-panel p-3 flex flex-col gap-4"
            style={{ animation: "float-in 0.5s ease-out 0.1s both" }}
        >
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--color-accent-red)", animation: "status-blink 2s infinite 0.5s" }} />
                <h3
                    className="text-xs font-bold tracking-widest uppercase"
                    style={{ color: "var(--color-accent-red)", fontFamily: "JetBrains Mono, monospace" }}
                >
                    Threat Metadata
                </h3>
            </div>

            {/* Action-Oriented Stats Grid */}
            <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="flex flex-col gap-0.5 border-l-2 pl-2 border-emerald-500/50 bg-emerald-900/10 p-2 rounded-r">
                    <p className="text-[9px] uppercase tracking-widest text-gray-400 mb-0.5" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                        Funds Secured
                    </p>
                    <p className="text-base font-bold text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                        ₹24,50,000
                    </p>
                </div>

                <div className="flex flex-col gap-0.5 border-l-2 pl-2 border-red-500/50 bg-red-900/10 p-2 rounded-r relative overflow-hidden group">
                    <div className="absolute inset-0 border border-red-500/30 rounded" style={{ animation: "status-blink 2s infinite" }}></div>
                    <p className="text-[9px] uppercase tracking-widest text-gray-400 mb-0.5 z-10" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                        Accounts Frozen
                    </p>
                    <p className="text-base font-bold text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)] z-10" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                        12
                    </p>
                </div>

                <StatCard label="Active Threats" value={stats.active} color="var(--color-accent-red)" />
                <StatCard label="Mule Rings Traced" value="3" color="var(--color-neon-orange)" />
            </div>

            {/* Donut Chart */}
            <div className="flex items-center gap-3">
                <div style={{ width: "120px", height: "120px" }}>
                    <ResponsiveContainer width="100%" height={120}>
                        <PieChart>
                            <Pie
                                data={stats.donutData}
                                cx="50%"
                                cy="50%"
                                innerRadius={32}
                                outerRadius={50}
                                paddingAngle={3}
                                dataKey="value"
                                stroke="none"
                            >
                                {stats.donutData.map((entry, i) => (
                                    <Cell key={i} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{
                                    background: "rgba(17, 24, 39, 0.9)",
                                    border: "1px solid var(--color-border)",
                                    borderRadius: "8px",
                                    fontFamily: "JetBrains Mono, monospace",
                                    fontSize: "10px",
                                    color: "#f9fafb",
                                    boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                                    backdropFilter: "blur(4px)"
                                }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-1.5">
                    {stats.donutData.map((d) => (
                        <div key={d.name} className="flex items-center gap-2 text-[10px]" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                            <span className="text-gray-400">{d.name}</span>
                            <span className="text-gray-100 font-bold">{d.value}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
    return (
        <div className="flex flex-col gap-0.5 border-l-2 pl-2" style={{ borderColor: "var(--color-border-bright)" }}>
            <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-0.5" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                {label}
            </p>
            <p className="text-lg font-bold" style={{ color: color, fontFamily: "JetBrains Mono, monospace" }}>
                {value}
            </p>
        </div>
    );
}
