"use client";

import { useState, useEffect } from "react";

const API_BASE = "http://localhost:8000";

interface ThreatDetail {
    risk_level: string;
    confidence_score: number;
    narrative: string;
    breach_details: {
        alert_id: string;
        alert_type: string;
        severity: string;
        account_id: string;
        account_name: string;
        timestamp: string;
        ip_address: string;
        description: string;
    };
    transaction_details: {
        tx_id: string;
        sender_id: string;
        sender_name: string;
        receiver_id: string;
        receiver_name: string;
        amount: number;
        currency: string;
        timestamp: string;
        status: string;
    };
    linkage_evidence: string[];
    recommended_action: string;
    analysis_timestamp: string;
}

interface ThreatIntelResponse {
    total_threats: number;
    high_confidence_count: number;
    threats: ThreatDetail[];
}

const riskColors: Record<string, string> = {
    CRITICAL: "#ef4444",
    HIGH: "#f97316",
    MEDIUM: "#f59e0b",
    LOW: "#06b6d4",
    INFORMATIONAL: "#6b7280",
};

const riskBg: Record<string, string> = {
    CRITICAL: "bg-red-500/10 border-red-500/30 ring-red-500/20",
    HIGH: "bg-orange-500/10 border-orange-500/30 ring-orange-500/20",
    MEDIUM: "bg-amber-500/10 border-amber-500/30 ring-amber-500/20",
    LOW: "bg-cyan-500/10 border-cyan-500/30 ring-cyan-500/20",
    INFORMATIONAL: "bg-gray-500/10 border-gray-500/30 ring-gray-500/20",
};

export default function ThreatNarrative() {
    const [data, setData] = useState<ThreatIntelResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<number | null>(null);
    const [freezeState, setFreezeState] = useState<Record<string, "idle" | "confirming" | "frozen">>({});

    useEffect(() => {
        fetchThreats();
    }, []);

    async function fetchThreats() {
        try {
            const res = await fetch(`${API_BASE}/api/v1/threat-intel`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            setData(json);
            setLoading(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch");
            setLoading(false);
        }
    }

    function handleFreeze(txId: string) {
        const current = freezeState[txId] || "idle";
        if (current === "idle") {
            setFreezeState({ ...freezeState, [txId]: "confirming" });
        } else if (current === "confirming") {
            setFreezeState({ ...freezeState, [txId]: "frozen" });
        }
    }

    function cancelFreeze(txId: string) {
        setFreezeState({ ...freezeState, [txId]: "idle" });
    }

    // Only show significant threats (top 15)
    const threats = data?.threats.slice(0, 15) || [];

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-4 py-3 border-b border-[#1e2d42]">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                    <h2
                        className="text-sm font-semibold tracking-wider uppercase"
                        style={{ color: "#ef4444", fontFamily: "JetBrains Mono, monospace" }}
                    >
                        Threat Narratives
                    </h2>
                </div>
                {data && (
                    <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                                Total:
                            </span>
                            <span className="text-sm font-bold text-white">
                                {data.total_threats}
                            </span>
                        </div>
                        <div className="w-px h-4 bg-[#2a3f5f]" />
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                                High Conf:
                            </span>
                            <span className="text-sm font-bold text-red-400">
                                {data.high_confidence_count}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Threats list */}
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
                {loading && (
                    <div className="flex items-center justify-center h-32 text-gray-500">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-[var(--color-neon-orange)] border-t-transparent rounded-full animate-spin" />
                            <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "12px" }}>
                                Analysing threats…
                            </span>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                        <span className="font-mono">ERROR:</span> {error}
                    </div>
                )}

                {!loading &&
                    !error &&
                    threats.map((threat, idx) => {
                        const isExpanded = expanded === idx;
                        const txId = threat.transaction_details.tx_id;
                        const fs = freezeState[txId] || "idle";

                        return (
                            <div
                                key={idx}
                                className={`rounded-lg border transition-all duration-300 overflow-hidden ${riskBg[threat.risk_level]} ring-1`}
                                style={{
                                    animation: `slide-in-right 0.3s ease-out ${idx * 0.08}s both`,
                                }}
                            >
                                {/* Compact header */}
                                <button
                                    onClick={() => setExpanded(isExpanded ? null : idx)}
                                    className="w-full px-3 py-2.5 text-left flex items-start gap-2.5"
                                >
                                    <div
                                        className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold mt-0.5"
                                        style={{
                                            backgroundColor: riskColors[threat.risk_level] + "22",
                                            color: riskColors[threat.risk_level],
                                            fontFamily: "JetBrains Mono, monospace",
                                        }}
                                    >
                                        {Math.round(threat.confidence_score * 100)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                            <span
                                                className="text-[10px] font-bold uppercase tracking-widest"
                                                style={{ color: riskColors[threat.risk_level] }}
                                            >
                                                {threat.risk_level}
                                            </span>
                                            <span className="text-[10px] text-gray-600">•</span>
                                            <span
                                                className="text-[10px] text-gray-500 truncate"
                                                style={{ fontFamily: "JetBrains Mono, monospace" }}
                                            >
                                                {threat.breach_details.alert_type?.replace(/_/g, " ")}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-300 truncate">
                                            {threat.breach_details.account_name} →{" "}
                                            {threat.transaction_details.receiver_name}
                                        </p>
                                        <p className="text-xs text-amber-400 font-semibold mt-0.5">
                                            {threat.transaction_details.currency}{" "}
                                            {threat.transaction_details.amount?.toLocaleString("en-US", {
                                                minimumFractionDigits: 2,
                                            })}
                                        </p>
                                    </div>
                                    <span className="text-gray-600 text-sm mt-1">
                                        {isExpanded ? "▲" : "▼"}
                                    </span>
                                </button>

                                {/* Expanded details */}
                                {isExpanded && (
                                    <div
                                        className="px-3 pb-3 space-y-3 border-t border-white/5"
                                        style={{ animation: "fade-in 0.2s ease-out" }}
                                    >
                                        {/* Evidence */}
                                        <div className="pt-2">
                                            <h4
                                                className="text-[10px] uppercase tracking-widest text-gray-500 mb-1.5"
                                                style={{ fontFamily: "JetBrains Mono, monospace" }}
                                            >
                                                Linkage Evidence
                                            </h4>
                                            <ul className="space-y-1">
                                                {threat.linkage_evidence.map((e, i) => (
                                                    <li
                                                        key={i}
                                                        className="flex items-start gap-1.5 text-xs text-gray-300"
                                                    >
                                                        <span className="text-[var(--color-neon-orange)] flex-shrink-0 mt-0.5">▸</span>
                                                        {e}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        {/* Breach & Transaction details */}
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="p-2 rounded-md bg-[#0a0e17]/50">
                                                <h5
                                                    className="text-[9px] uppercase tracking-widest text-gray-600 mb-1"
                                                    style={{ fontFamily: "JetBrains Mono, monospace" }}
                                                >
                                                    Breach
                                                </h5>
                                                <p className="text-[10px] text-gray-400">
                                                    <span className="text-gray-600">ID: </span>
                                                    <span className="text-white">{threat.breach_details.alert_id}</span>
                                                </p>
                                                <p className="text-[10px] text-gray-400">
                                                    <span className="text-gray-600">IP: </span>
                                                    <span className="text-red-400">{threat.breach_details.ip_address}</span>
                                                </p>
                                                <p className="text-[10px] text-gray-400 truncate">
                                                    {threat.breach_details.description}
                                                </p>
                                            </div>
                                            <div className="p-2 rounded-md bg-[#0a0e17]/50">
                                                <h5
                                                    className="text-[9px] uppercase tracking-widest text-gray-600 mb-1"
                                                    style={{ fontFamily: "JetBrains Mono, monospace" }}
                                                >
                                                    Transaction
                                                </h5>
                                                <p className="text-[10px] text-gray-400">
                                                    <span className="text-gray-600">ID: </span>
                                                    <span className="text-white">{threat.transaction_details.tx_id}</span>
                                                </p>
                                                <p className="text-[10px] text-gray-400">
                                                    <span className="text-gray-600">Status: </span>
                                                    <span
                                                        className={
                                                            threat.transaction_details.status === "pending"
                                                                ? "text-amber-400"
                                                                : "text-green-400"
                                                        }
                                                    >
                                                        {threat.transaction_details.status}
                                                    </span>
                                                </p>
                                                <p className="text-[10px] text-gray-400">
                                                    <span className="text-gray-600">Channel: </span>
                                                    {threat.transaction_details.tx_id}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Recommended action */}
                                        <div className="p-2 rounded-md bg-[#0a0e17]/60 border border-[#1e2d42]/50">
                                            <h5
                                                className="text-[9px] uppercase tracking-widest text-gray-600 mb-1"
                                                style={{ fontFamily: "JetBrains Mono, monospace" }}
                                            >
                                                Recommended Action
                                            </h5>
                                            <p className="text-xs text-gray-300">
                                                {threat.recommended_action}
                                            </p>
                                        </div>

                                        {/* FREEZE BUTTON */}
                                        {(threat.risk_level === "CRITICAL" ||
                                            threat.risk_level === "HIGH") && (
                                                <div className="pt-1">
                                                    {fs === "idle" && (
                                                        <button
                                                            onClick={() => handleFreeze(txId)}
                                                            className="w-full py-2.5 rounded-lg bg-red-900/80 hover:bg-red-900 text-red-100 text-sm font-bold uppercase tracking-wider transition-all duration-200 hover:shadow-lg hover:shadow-red-900/50"
                                                            style={{
                                                                fontFamily: "JetBrains Mono, monospace",
                                                                animation: "freeze-pulse 2s infinite",
                                                            }}
                                                        >
                                                            ⚠ Pre-emptive Account Freeze
                                                        </button>
                                                    )}
                                                    {fs === "confirming" && (
                                                        <div className="space-y-2">
                                                            <p className="text-xs text-red-400 text-center font-semibold">
                                                                Confirm freeze on accounts{" "}
                                                                <span className="text-white">
                                                                    {threat.transaction_details.sender_id}
                                                                </span>{" "}
                                                                &{" "}
                                                                <span className="text-white">
                                                                    {threat.transaction_details.receiver_id}
                                                                </span>
                                                                ?
                                                            </p>
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => handleFreeze(txId)}
                                                                    className="flex-1 py-2 rounded-lg bg-red-900 hover:bg-red-800 text-red-100 text-xs font-bold uppercase tracking-wider transition-all"
                                                                    style={{ fontFamily: "JetBrains Mono, monospace" }}
                                                                >
                                                                    Yes — Freeze Now
                                                                </button>
                                                                <button
                                                                    onClick={() => cancelFreeze(txId)}
                                                                    className="flex-1 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold uppercase tracking-wider transition-all"
                                                                    style={{ fontFamily: "JetBrains Mono, monospace" }}
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {fs === "frozen" && (
                                                        <div
                                                            className="w-full py-2.5 rounded-lg bg-emerald-900/20 border border-emerald-500/40 text-emerald-400 text-sm font-bold uppercase tracking-wider text-center"
                                                            style={{
                                                                fontFamily: "JetBrains Mono, monospace",
                                                                animation: "fade-in 0.3s ease-out",
                                                            }}
                                                        >
                                                            ✓ Accounts Frozen — SAR Filed
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
            </div>
        </div>
    );
}
