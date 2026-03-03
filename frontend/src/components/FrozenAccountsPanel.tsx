"use client";

import { useState, useEffect, useCallback } from "react";
import { formatINR } from "@/lib/formatINR";

const API = "http://localhost:8000";

interface FrozenAccount {
    account_number: string;
    holder_name: string;
    phone: string;
    email: string;
    city: string;
    balance: number;
    ifsc: string;
    frozen_by: string;
    reason: string;
    frozen_at: string;
}

export default function FrozenAccountsPanel() {
    const [accounts, setAccounts] = useState<FrozenAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [unfreezing, setUnfreezing] = useState<string | null>(null);

    const fetchFrozen = useCallback(async () => {
        try {
            const res = await fetch(`${API}/api/v1/frozen-accounts`);
            if (res.ok) setAccounts(await res.json());
        } catch { /* silent */ }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchFrozen();
        const interval = setInterval(fetchFrozen, 10000);
        return () => clearInterval(interval);
    }, [fetchFrozen]);

    async function handleUnfreeze(accountNumber: string) {
        setUnfreezing(accountNumber);
        try {
            const res = await fetch(`${API}/api/v1/unfreeze`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ account_number: accountNumber }),
            });
            if (res.ok) {
                setAccounts((prev) => prev.filter((a) => a.account_number !== accountNumber));
            }
        } catch { /* silent */ }
        setUnfreezing(null);
    }

    return (
        <div className="h-full flex flex-col bg-gray-900/70 backdrop-blur-sm border border-gray-800 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="px-5 py-3 border-b border-gray-800 flex items-center gap-3">
                <div className="relative">
                    <div
                        className="w-2.5 h-2.5 rounded-full bg-blue-500"
                        style={{ animation: "status-blink 2s infinite" }}
                    />
                </div>
                <h2
                    className="text-xs font-bold tracking-widest uppercase"
                    style={{
                        fontFamily: "JetBrains Mono, monospace",
                        background: "linear-gradient(90deg, #3b82f6, #a855f7)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                    }}
                >
                    Frozen Accounts
                </h2>
                <div className="ml-auto flex items-center gap-3">
                    <span
                        className="text-[10px] px-2 py-0.5 rounded-full border border-blue-700/50 bg-blue-900/30 text-blue-400"
                        style={{ fontFamily: "JetBrains Mono, monospace" }}
                    >
                        {accounts.length} frozen
                    </span>
                </div>
            </div>

            {/* Info Banner */}
            <div
                className="mx-4 mt-3 px-4 py-2.5 rounded-lg border"
                style={{
                    background: "linear-gradient(135deg, rgba(59,130,246,0.08), rgba(168,85,247,0.08))",
                    borderColor: "rgba(59,130,246,0.2)",
                }}
            >
                <div className="flex items-center gap-2">
                    <span className="text-sm">🧊</span>
                    <span
                        className="text-[10px] text-gray-300 leading-relaxed"
                        style={{ fontFamily: "JetBrains Mono, monospace" }}
                    >
                        <strong className="text-blue-400">FROZEN ACCOUNTS</strong> — These accounts have been frozen by SOC
                        analysts. Login and transfers are blocked. Click <strong className="text-green-400">Unfreeze</strong> to
                        restore access.
                    </span>
                </div>
            </div>

            {/* Accounts List */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
                {loading ? (
                    <div className="flex items-center justify-center h-40">
                        <div className="text-gray-400 text-sm animate-pulse">Loading frozen accounts...</div>
                    </div>
                ) : accounts.length === 0 ? (
                    <div className="flex items-center justify-center h-40">
                        <div className="text-center">
                            <p className="text-3xl mb-2">✅</p>
                            <p className="text-gray-400 text-sm font-medium">No Frozen Accounts</p>
                            <p className="text-gray-500 text-xs mt-1">All accounts are active and operational</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {accounts.map((acct, idx) => (
                            <div
                                key={acct.account_number}
                                className="border border-gray-800 rounded-lg overflow-hidden bg-gray-950/50"
                                style={{ animation: `slide-in-up 0.3s ease-out ${idx * 0.05}s both` }}
                            >
                                <div className="px-4 py-3">
                                    <div className="flex items-start justify-between gap-3">
                                        {/* Account Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-semibold text-gray-100">{acct.holder_name}</span>
                                                <span
                                                    className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-400 border border-blue-700/50"
                                                    style={{ fontFamily: "JetBrains Mono, monospace" }}
                                                >
                                                    FROZEN
                                                </span>
                                            </div>
                                            <div
                                                className="text-[10px] text-gray-400 mt-1 flex items-center gap-3"
                                                style={{ fontFamily: "JetBrains Mono, monospace" }}
                                            >
                                                <span>🏦 {acct.account_number}</span>
                                                <span>📍 {acct.city}</span>
                                                <span>📞 {acct.phone}</span>
                                            </div>
                                        </div>

                                        {/* Balance + Unfreeze */}
                                        <div className="flex items-center gap-3 flex-shrink-0">
                                            <div className="text-right">
                                                <div
                                                    className="text-xs font-bold text-gray-400"
                                                    style={{ fontFamily: "JetBrains Mono, monospace" }}
                                                >
                                                    {formatINR(acct.balance)}
                                                </div>
                                                <div className="text-[8px] text-gray-500 uppercase tracking-wider">Balance</div>
                                            </div>
                                            <button
                                                onClick={() => handleUnfreeze(acct.account_number)}
                                                disabled={unfreezing === acct.account_number}
                                                className="px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider cursor-pointer transition-all hover:scale-105 disabled:opacity-50"
                                                style={{
                                                    background: "rgba(34,197,94,0.15)",
                                                    border: "1px solid rgba(34,197,94,0.4)",
                                                    color: "#22c55e",
                                                    fontFamily: "JetBrains Mono, monospace",
                                                }}
                                            >
                                                {unfreezing === acct.account_number ? "⏳ ..." : "🔓 Unfreeze"}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Freeze Details */}
                                    <div className="mt-2 grid grid-cols-3 gap-2">
                                        <div className="bg-gray-800/40 rounded p-1.5">
                                            <p className="text-[8px] text-gray-500 uppercase">Frozen By</p>
                                            <p className="text-[10px] text-gray-300 font-medium truncate">{acct.frozen_by}</p>
                                        </div>
                                        <div className="bg-gray-800/40 rounded p-1.5">
                                            <p className="text-[8px] text-gray-500 uppercase">Reason</p>
                                            <p className="text-[10px] text-gray-300 font-medium truncate">{acct.reason}</p>
                                        </div>
                                        <div className="bg-gray-800/40 rounded p-1.5">
                                            <p className="text-[8px] text-gray-500 uppercase">Frozen At</p>
                                            <p className="text-[10px] text-gray-300 font-medium">
                                                {acct.frozen_at ? new Date(acct.frozen_at).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }) : "—"}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="px-5 py-2 border-t border-gray-800 flex items-center justify-between bg-gray-900/50">
                <span className="text-[9px] text-gray-400" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                    SOC FREEZE CONTROL v1.0
                </span>
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" style={{ animation: "status-blink 2s infinite" }} />
                    <span className="text-[9px] text-gray-400" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                        {accounts.length} ACCOUNTS FROZEN
                    </span>
                </div>
            </div>
        </div>
    );
}
