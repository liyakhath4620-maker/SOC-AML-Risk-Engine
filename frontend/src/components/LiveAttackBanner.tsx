"use client";

import React, { useState, useEffect, useCallback } from "react";
import { formatINR } from "@/lib/formatINR";

const API_BASE = "http://localhost:8000";

interface AttackEvent {
    event_id: string;
    event_type: string;
    attacker_ip: string;
    user_agent: string;
    target_account: string;
    target_holder: string;
    destination_account: string;
    destination_name: string;
    amount: number;
    transfer_method: string;
    risk_score: number;
    status: string;
    details: string;
    timestamp: string;
    attacker_location: string;
}

interface ActiveAttackState {
    is_active: boolean;
    accounts_under_attack: { account_number: string; holder_name: string; city: string }[];
    recent_events: AttackEvent[];
    total_attacks: number;
}

export default function LiveAttackBanner() {
    const [state, setState] = useState<ActiveAttackState | null>(null);
    const [events, setEvents] = useState<AttackEvent[]>([]);
    const [expanded, setExpanded] = useState(false);
    const [flash, setFlash] = useState(false);
    const eventsLenRef = React.useRef(0);

    const poll = useCallback(async () => {
        try {
            const [activeRes, eventsRes] = await Promise.all([
                fetch(`${API_BASE}/api/v1/live-attacks/active`),
                fetch(`${API_BASE}/api/v1/live-attacks?limit=30`),
            ]);
            if (activeRes.ok && eventsRes.ok) {
                const activeData = await activeRes.json();
                const eventsData = await eventsRes.json();
                if (eventsData.length > eventsLenRef.current && eventsLenRef.current > 0) {
                    setFlash(true);
                    setTimeout(() => setFlash(false), 2000);
                }
                eventsLenRef.current = eventsData.length;
                setState(activeData);
                setEvents(eventsData);
            }
        } catch { /* backend down */ }
    }, []);

    useEffect(() => {
        poll();
        const interval = setInterval(poll, 5000);
        return () => clearInterval(interval);
    }, [poll]);

    if (!state || state.total_attacks === 0) return null;

    const transfers = events.filter((e) => e.event_type === "TRANSFER_ATTEMPT");
    const totalStolen = transfers.reduce((sum, t) => sum + (t.amount || 0), 0);

    // Parse mule details from details string
    const parseMuleDetails = (details: string) => {
        const phoneMatch = details.match(/Phone:\s*([^,]+)/);
        const ifscMatch = details.match(/IFSC:\s*([^,]+)/);
        const upiMatch = details.match(/UPI:\s*(.+?)$/);
        return {
            phone: phoneMatch?.[1]?.trim() || "—",
            ifsc: ifscMatch?.[1]?.trim() || "—",
            upi: upiMatch?.[1]?.trim() || "—",
        };
    };

    // Build AI analysis narrative from the attack events
    const buildAIAnalysis = () => {
        if (events.length === 0) return "";
        const ip = events[0].attacker_ip;
        const location = events[0].attacker_location || "Unknown";
        const ua = events[0].user_agent || "Unknown";
        const logins = events.filter(e => e.event_type === "LOGIN_SUCCESS");
        const failedLogins = events.filter(e => e.event_type === "LOGIN_FAILED");
        const balChecks = events.filter(e => e.event_type === "BALANCE_CHECK");
        const victims = [...new Set(logins.map(l => l.target_holder).filter(Boolean))];

        let analysis = `🔴 **THREAT INTELLIGENCE REPORT — LIVE ATTACK**\n\n`;
        analysis += `**━━ ATTACKER FINGERPRINT ━━**\n`;
        analysis += `• **IP Address:** \`${ip}\`\n`;
        analysis += `• **Location:** ${location}\n`;
        analysis += `• **Device:** ${ua.substring(0, 80)}\n`;
        analysis += `• **Risk Score:** ${(events[0].risk_score * 100).toFixed(0)}% — CRITICAL\n\n`;

        analysis += `**━━ ATTACK PATTERN ━━**\n`;
        if (failedLogins.length > 0) {
            analysis += `• **${failedLogins.length} failed login attempt(s)** — possible credential stuffing\n`;
        }
        analysis += `• **${logins.length} successful breach(es)** into account(s): ${victims.join(", ") || "N/A"}\n`;
        if (balChecks.length > 0) {
            analysis += `• **${balChecks.length} balance check(s)** — attacker verifying available funds\n`;
        }
        analysis += `• **${transfers.length} fund transfer(s)** attempted — ALL INTERCEPTED by Mirror Sandbox\n`;
        analysis += `• **Total amount intercepted:** ${formatINR(totalStolen)}\n\n`;

        if (transfers.length > 0) {
            analysis += `**━━ MULE ACCOUNTS EXPOSED ━━**\n`;
            transfers.forEach((t, idx) => {
                const mule = parseMuleDetails(t.details || "");
                analysis += `\n**Mule #${idx + 1}: ${t.destination_name || "Unknown"}**\n`;
                analysis += `• Account: \`${t.destination_account || "N/A"}\`\n`;
                analysis += `• Phone: \`${mule.phone}\`\n`;
                analysis += `• IFSC: \`${mule.ifsc}\`\n`;
                analysis += `• UPI: \`${mule.upi}\`\n`;
                analysis += `• Transfer: ${formatINR(t.amount)} via ${t.transfer_method}\n`;
                analysis += `• Status: 🛑 ${t.status}\n`;
            });

            analysis += `\n**━━ RECOMMENDED ACTIONS ━━**\n`;
            analysis += `1. 🚨 **File FIR** with Cyber Crime Cell with all mule account details\n`;
            analysis += `2. 🏦 **Freeze mule accounts** — send IFSC details to receiving banks\n`;
            analysis += `3. 📱 **Trace phone numbers** via telecom records (${[...new Set(transfers.map(t => parseMuleDetails(t.details || "").phone).filter(p => p !== "—"))].join(", ") || "N/A"})\n`;
            analysis += `4. 🌐 **Block attacker IP** \`${ip}\` at firewall level\n`;
            analysis += `5. 📊 **Preserve evidence** — all ${events.length} events logged with timestamps\n`;
        }

        return analysis;
    };

    // Simple markdown-like rendering
    const renderAnalysis = (text: string) => {
        return text.split("\n").map((line, i) => {
            let processed = line
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/`(.+?)`/g, '<code style="background:#1e293b;padding:1px 4px;border-radius:3px;color:#f472b6;font-size:10px;">$1</code>');
            return (
                <div
                    key={i}
                    className={`text-[11px] leading-[1.6] ${line.startsWith("•") ? "pl-2 text-gray-300" : line.startsWith("1.") || line.startsWith("2.") || line.startsWith("3.") || line.startsWith("4.") || line.startsWith("5.") ? "pl-2 text-cyan-300" : "text-gray-200"}`}
                    style={{ fontFamily: "JetBrains Mono, monospace" }}
                    dangerouslySetInnerHTML={{ __html: processed || "&nbsp;" }}
                />
            );
        });
    };

    const getStatusBadge = (status: string) => {
        const colors: Record<string, string> = {
            SANDBOX_REDIRECT: "bg-red-600 text-white",
            BLOCKED: "bg-amber-600 text-white",
            MONITORING: "bg-blue-600 text-white",
            INTERCEPTED: "bg-purple-600 text-white",
        };
        return colors[status] || "bg-gray-600 text-white";
    };

    return (
        <div className="w-full flex-shrink-0" style={{ animation: flash ? "flash-red 1s ease-out" : undefined }}>
            {/* ── BIG WARNING BANNER ── */}
            <div
                className="cursor-pointer select-none"
                onClick={(e) => { e.stopPropagation(); setExpanded(prev => !prev); }}
                style={{
                    background: state.is_active
                        ? "linear-gradient(90deg, #450a0a, #7f1d1d, #450a0a)"
                        : "rgba(30,41,59,0.6)",
                    borderBottom: state.is_active ? "2px solid #ef4444" : "1px solid #334155",
                    padding: "14px 20px",
                    zIndex: 50,
                    position: "relative",
                }}
            >
                <div className="flex items-center gap-4">
                    {/* Pulsing red dot */}
                    <div className="relative flex-shrink-0">
                        <div
                            className="w-4 h-4 rounded-full"
                            style={{
                                backgroundColor: state.is_active ? "#ef4444" : "#6b7280",
                                animation: state.is_active ? "status-blink 0.6s infinite" : "none",
                                boxShadow: state.is_active ? "0 0 12px rgba(239,68,68,0.6)" : "none",
                            }}
                        />
                        {state.is_active && (
                            <div className="absolute inset-0 w-4 h-4 rounded-full bg-red-500/40" style={{ animation: "ping 1.5s infinite" }} />
                        )}
                    </div>

                    <div className="flex-1">
                        <div
                            className="text-sm font-black uppercase tracking-widest"
                            style={{
                                fontFamily: "JetBrains Mono, monospace",
                                color: state.is_active ? "#ef4444" : "#6b7280",
                                textShadow: state.is_active ? "0 0 10px rgba(239,68,68,0.4)" : "none",
                            }}
                        >
                            {state.is_active ? "⚠️ LIVE ATTACK IN PROGRESS — CLICK TO INVESTIGATE" : "📡 ATTACK MONITOR"}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-1 flex items-center gap-4" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                            {state.accounts_under_attack.map((a) => (
                                <span key={a.account_number} className="flex items-center gap-1.5">
                                    <span className="text-amber-400">
                                        🏦 {a.holder_name} ({a.city})
                                    </span>
                                    <button
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            try {
                                                await fetch(`${API_BASE}/api/v1/send-sus`, {
                                                    method: "POST",
                                                    headers: { "Content-Type": "application/json" },
                                                    body: JSON.stringify({ account_number: a.account_number }),
                                                });
                                                poll();
                                            } catch { /* ignore */ }
                                        }}
                                        className="px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer hover:scale-105"
                                        style={{
                                            background: "rgba(245, 158, 11, 0.2)",
                                            border: "1px solid rgba(245, 158, 11, 0.5)",
                                            color: "#f59e0b",
                                            fontFamily: "JetBrains Mono, monospace",
                                        }}
                                    >
                                        🚨 SEND SUS
                                    </button>
                                </span>
                            ))}
                            {transfers.length > 0 && (
                                <span className="text-red-400">
                                    💸 {formatINR(totalStolen)} intercepted
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-4 flex-shrink-0">
                        <div className="text-right">
                            <div className="text-xs font-bold text-red-400" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                                {state.total_attacks} EVENTS
                            </div>
                            <div className="text-[9px] text-gray-500" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                                {transfers.length} mule transfers
                            </div>
                        </div>
                        <span className="text-gray-400 text-sm transition-transform duration-200" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)" }}>▼</span>
                    </div>
                </div>
            </div>

            {/* ── EXPANDED: AI Analysis + Mule Details ── */}
            {expanded && (
                <div className="bg-gray-950/95 border-b-2 border-red-700/50 max-h-[60vh] overflow-y-auto" style={{ animation: "slide-in-up 0.2s ease-out" }}>
                    <div className="grid grid-cols-2 gap-0 divide-x divide-gray-800">
                        {/* LEFT: AI Analysis */}
                        <div className="p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-2 h-2 rounded-full bg-green-500" style={{ animation: "status-blink 1.5s infinite" }} />
                                <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                                    🤖 AI THREAT ANALYSIS
                                </span>
                            </div>
                            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 max-h-[45vh] overflow-y-auto">
                                {renderAnalysis(buildAIAnalysis())}
                            </div>
                        </div>

                        {/* RIGHT: Mule Account Table */}
                        <div className="p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                                    💰 INTERCEPTED MULE ACCOUNTS ({transfers.length})
                                </span>
                            </div>

                            {transfers.length > 0 ? (
                                <div className="space-y-3">
                                    {transfers.map((t, idx) => {
                                        const mule = parseMuleDetails(t.details || "");
                                        return (
                                            <div key={t.event_id} className="bg-gray-900/50 border border-gray-800 rounded-lg p-3">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs font-bold text-amber-300" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                                                        MULE #{idx + 1}: {t.destination_name || "Unknown"}
                                                    </span>
                                                    <span className={`text-[8px] font-bold px-2 py-0.5 rounded ${getStatusBadge(t.status)}`}>{t.status}</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px]" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                                                    <div>
                                                        <span className="text-gray-500">Account:</span>
                                                        <span className="ml-1 text-red-400 font-bold">{t.destination_account || "—"}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">Amount:</span>
                                                        <span className="ml-1 text-red-400 font-bold">{t.amount ? formatINR(t.amount) : "—"}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">Phone:</span>
                                                        <span className="ml-1 text-cyan-400">{mule.phone}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">Method:</span>
                                                        <span className="ml-1 text-gray-300">{t.transfer_method}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">IFSC:</span>
                                                        <span className="ml-1 text-gray-300">{mule.ifsc}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">UPI:</span>
                                                        <span className="ml-1 text-cyan-400">{mule.upi}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500 text-xs" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                                    No transfer attempts yet — monitoring attacker movements...
                                </div>
                            )}

                            {/* Attacker Fingerprint Summary */}
                            {events.length > 0 && (
                                <div className="mt-4 bg-red-950/30 border border-red-900/50 rounded-lg p-3">
                                    <div className="text-[10px] font-bold text-red-400 mb-2 uppercase tracking-wider" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                                        🎯 Attacker Fingerprint
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-[10px]" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                                        <div>
                                            <span className="text-gray-500">IP:</span>
                                            <span className="ml-1 text-red-400 font-bold">{events[0].attacker_ip}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">Location:</span>
                                            <span className="ml-1 text-amber-400">{events[0].attacker_location || "Detecting..."}</span>
                                        </div>
                                        <div className="col-span-2">
                                            <span className="text-gray-500">Device:</span>
                                            <span className="ml-1 text-gray-300 text-[9px]">{events[0].user_agent?.substring(0, 90)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
