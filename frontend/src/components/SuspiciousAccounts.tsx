"use client";

import { useState, useEffect, useCallback } from "react";
import { formatINR } from "@/lib/formatINR";

const API_BASE = "http://localhost:8000";

interface SandboxTransaction {
    tx_id: string;
    mule_account_number: string;
    mule_bank_name: string;
    mule_ifsc: string;
    receiver_name: string;
    receiver_phone: string;
    amount: number;
    currency: string;
    transfer_method: string;
    city: string;
    lat: number;
    lon: number;
    status: string;
    timestamp: string;
}

interface SandboxSession {
    session_id: string;
    attacker_name: string;
    attacker_phone: string;
    attacker_ip: string;
    risk_factor: number;
    city: string;
    state: string;
    duration_minutes: number;
    status: string;
    entry_time: string;
    tools_detected: string;
    total_attempted_amount: number;
    transaction_count: number;
    transactions: SandboxTransaction[];
}

export default function SuspiciousAccounts() {
    const [sessions, setSessions] = useState<SandboxSession[]>([]);
    const [expandedSession, setExpandedSession] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchSessions = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/v1/sandbox/sessions`);
            if (res.ok) {
                const data = await res.json();
                setSessions(data);
            }
        } catch {
            /* backend may not be running */
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSessions();
        const interval = setInterval(fetchSessions, 20000);
        return () => clearInterval(interval);
    }, [fetchSessions]);

    const totalTrapped = sessions.filter((s) => s.status === "TRAPPED").length;
    const totalAmount = sessions.reduce((sum, s) => sum + s.total_attempted_amount, 0);

    const getStatusStyle = (status: string) => {
        switch (status) {
            case "TRAPPED":
                return "bg-red-900/40 text-red-400 border-red-700/50";
            case "FLAGGED":
                return "bg-amber-900/40 text-amber-400 border-amber-700/50";
            case "RELEASED":
                return "bg-gray-800/40 text-gray-400 border-gray-700/50";
            default:
                return "bg-blue-900/40 text-blue-400 border-blue-700/50";
        }
    };

    const getRiskColor = (risk: number) => {
        if (risk >= 0.95) return "text-red-400";
        if (risk >= 0.92) return "text-amber-400";
        return "text-yellow-400";
    };

    return (
        <div className="h-full flex flex-col bg-gray-900/70 backdrop-blur-sm border border-gray-800 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="px-5 py-3 border-b border-gray-800 flex items-center gap-3">
                <div className="relative">
                    <div
                        className="w-2.5 h-2.5 rounded-full bg-red-500"
                        style={{ animation: "status-blink 1.5s infinite" }}
                    />
                    <div
                        className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-red-500/50"
                        style={{ animation: "ping 2s cubic-bezier(0, 0, 0.2, 1) infinite" }}
                    />
                </div>
                <h2
                    className="text-xs font-bold tracking-widest uppercase"
                    style={{
                        fontFamily: "JetBrains Mono, monospace",
                        background: "linear-gradient(90deg, #ef4444, #f59e0b)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                    }}
                >
                    Mirror Sandbox — Trapped Sessions
                </h2>
                <div className="ml-auto flex items-center gap-3">
                    <span
                        className="text-[10px] px-2 py-0.5 rounded-full border border-red-700/50 bg-red-900/30 text-red-400"
                        style={{ fontFamily: "JetBrains Mono, monospace" }}
                    >
                        {totalTrapped} active traps
                    </span>
                    <span
                        className="text-[10px] px-2 py-0.5 rounded-full border border-amber-700/50 bg-amber-900/30 text-amber-400"
                        style={{ fontFamily: "JetBrains Mono, monospace" }}
                    >
                        {formatINR(totalAmount)} intercepted
                    </span>
                </div>
            </div>

            {/* Sandbox Concept Banner */}
            <div
                className="mx-4 mt-3 px-4 py-2.5 rounded-lg border"
                style={{
                    background: "linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(245, 158, 11, 0.08))",
                    borderColor: "rgba(239, 68, 68, 0.2)",
                }}
            >
                <div className="flex items-center gap-2">
                    <span className="text-sm">🪞</span>
                    <span
                        className="text-[10px] text-gray-300 leading-relaxed"
                        style={{ fontFamily: "JetBrains Mono, monospace" }}
                    >
                        <strong className="text-red-400">MIRROR SANDBOX ACTIVE</strong> — When Gemini Risk Factor ≥ 0.90,
                        attackers are silently redirected to a fake banking environment. All mule accounts &amp; transactions
                        are logged for law enforcement.
                    </span>
                </div>
            </div>

            {/* Sessions Table */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
                {loading ? (
                    <div className="flex items-center justify-center h-40">
                        <div className="text-gray-400 text-sm animate-pulse">Loading sandbox sessions...</div>
                    </div>
                ) : sessions.length === 0 ? (
                    <div className="flex items-center justify-center h-40">
                        <div className="text-center">
                            <p className="text-gray-400 text-sm font-medium">No sandbox sessions</p>
                            <p className="text-gray-500 text-xs mt-1">Ensure the backend is running and database is seeded</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {sessions.map((session, idx) => (
                            <div
                                key={session.session_id}
                                className="border border-gray-800 rounded-lg overflow-hidden transition-all duration-200"
                                style={{
                                    animation: `slide-in-up 0.3s ease-out ${idx * 0.05}s both`,
                                    background: expandedSession === session.session_id
                                        ? "rgba(239, 68, 68, 0.05)"
                                        : "rgba(17, 24, 39, 0.5)",
                                }}
                            >
                                {/* Session Row */}
                                <button
                                    onClick={() =>
                                        setExpandedSession(
                                            expandedSession === session.session_id ? null : session.session_id
                                        )
                                    }
                                    className="w-full text-left px-4 py-3 cursor-pointer hover:bg-gray-800/40 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        {/* Expand Arrow */}
                                        <span
                                            className="text-gray-500 text-[10px] transition-transform duration-200 flex-shrink-0"
                                            style={{
                                                transform: expandedSession === session.session_id ? "rotate(90deg)" : "rotate(0deg)",
                                            }}
                                        >
                                            ▶
                                        </span>

                                        {/* Attacker Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-semibold text-gray-100">
                                                    {session.attacker_name}
                                                </span>
                                                <span
                                                    className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${getStatusStyle(session.status)}`}
                                                    style={{ fontFamily: "JetBrains Mono, monospace" }}
                                                >
                                                    {session.status}
                                                </span>
                                            </div>
                                            <div
                                                className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-3"
                                                style={{ fontFamily: "JetBrains Mono, monospace" }}
                                            >
                                                <span>📞 {session.attacker_phone}</span>
                                                <span>🌐 {session.attacker_ip}</span>
                                                <span>📍 {session.city}, {session.state}</span>
                                            </div>
                                        </div>

                                        {/* Stats */}
                                        <div className="flex items-center gap-4 flex-shrink-0">
                                            <div className="text-right">
                                                <div
                                                    className={`text-xs font-bold ${getRiskColor(session.risk_factor)}`}
                                                    style={{ fontFamily: "JetBrains Mono, monospace" }}
                                                >
                                                    {(session.risk_factor * 100).toFixed(0)}%
                                                </div>
                                                <div className="text-[8px] text-gray-500 uppercase tracking-wider">Risk</div>
                                            </div>
                                            <div className="text-right">
                                                <div
                                                    className="text-xs font-bold text-amber-400"
                                                    style={{ fontFamily: "JetBrains Mono, monospace" }}
                                                >
                                                    {session.duration_minutes}m
                                                </div>
                                                <div className="text-[8px] text-gray-500 uppercase tracking-wider">Duration</div>
                                            </div>
                                            <div className="text-right">
                                                <div
                                                    className="text-xs font-bold text-red-400"
                                                    style={{ fontFamily: "JetBrains Mono, monospace" }}
                                                >
                                                    {formatINR(session.total_attempted_amount)}
                                                </div>
                                                <div className="text-[8px] text-gray-500 uppercase tracking-wider">Attempted</div>
                                            </div>
                                            <div className="text-right">
                                                <div
                                                    className="text-xs font-bold text-blue-400"
                                                    style={{ fontFamily: "JetBrains Mono, monospace" }}
                                                >
                                                    {session.transaction_count}
                                                </div>
                                                <div className="text-[8px] text-gray-500 uppercase tracking-wider">TXNs</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Tools row */}
                                    {session.tools_detected && (
                                        <div className="mt-2 flex items-center gap-1.5 ml-5">
                                            <span className="text-[9px] text-gray-500" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                                                TOOLS:
                                            </span>
                                            {JSON.parse(session.tools_detected).map((tool: string) => (
                                                <span
                                                    key={tool}
                                                    className="text-[8px] px-1.5 py-0.5 rounded bg-purple-900/30 text-purple-400 border border-purple-700/30"
                                                    style={{ fontFamily: "JetBrains Mono, monospace" }}
                                                >
                                                    {tool}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </button>

                                {/* Expanded Transaction Details */}
                                {expandedSession === session.session_id && (
                                    <div
                                        className="border-t border-gray-800 bg-gray-950/50 px-4 py-3"
                                        style={{ animation: "fade-in 0.2s ease-out" }}
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-[9px] text-gray-400 uppercase tracking-widest font-bold" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                                                Attempted Mule Transfers
                                            </span>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-[10px]" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                                                <thead>
                                                    <tr className="text-gray-500 uppercase tracking-wider border-b border-gray-800">
                                                        <th className="text-left py-1.5 pr-3">TX ID</th>
                                                        <th className="text-left py-1.5 pr-3">Mule Account</th>
                                                        <th className="text-left py-1.5 pr-3">Bank</th>
                                                        <th className="text-left py-1.5 pr-3">Receiver</th>
                                                        <th className="text-left py-1.5 pr-3">Phone</th>
                                                        <th className="text-right py-1.5 pr-3">Amount</th>
                                                        <th className="text-left py-1.5 pr-3">Method</th>
                                                        <th className="text-left py-1.5 pr-3">City</th>
                                                        <th className="text-left py-1.5">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-800/50">
                                                    {session.transactions.map((tx) => (
                                                        <tr key={tx.tx_id} className="text-gray-300 hover:bg-gray-800/30">
                                                            <td className="py-1.5 pr-3 text-blue-400">{tx.tx_id}</td>
                                                            <td className="py-1.5 pr-3 text-amber-400 font-medium">{tx.mule_account_number}</td>
                                                            <td className="py-1.5 pr-3">{tx.mule_bank_name}</td>
                                                            <td className="py-1.5 pr-3">{tx.receiver_name}</td>
                                                            <td className="py-1.5 pr-3 text-gray-400">{tx.receiver_phone}</td>
                                                            <td className="py-1.5 pr-3 text-right text-red-400 font-bold">
                                                                {formatINR(tx.amount)}
                                                            </td>
                                                            <td className="py-1.5 pr-3">
                                                                <span className="px-1 py-0.5 rounded bg-gray-800 text-gray-300 text-[9px]">
                                                                    {tx.transfer_method}
                                                                </span>
                                                            </td>
                                                            <td className="py-1.5 pr-3">{tx.city}</td>
                                                            <td className="py-1.5">
                                                                <span className="px-1.5 py-0.5 rounded bg-red-900/30 text-red-400 border border-red-700/30 text-[8px] font-bold">
                                                                    {tx.status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer Stats */}
            <div className="px-5 py-2 border-t border-gray-800 flex items-center justify-between bg-gray-900/50">
                <span className="text-[9px] text-gray-400" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                    MIRROR SANDBOX v1.0 • ENVIRONMENT REDIRECTION ACTIVE
                </span>
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500" style={{ animation: "status-blink 2s infinite" }} />
                    <span className="text-[9px] text-gray-400" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                        {sessions.length} SESSIONS LOGGED
                    </span>
                </div>
            </div>
        </div>
    );
}
