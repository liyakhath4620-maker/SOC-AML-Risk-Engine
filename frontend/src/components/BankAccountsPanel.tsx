"use client";

import { useState, useEffect } from "react";

const API = "http://localhost:8000";

interface BankAccount {
    account_number: string;
    holder_name: string;
    phone: string;
    email: string;
    ifsc: string;
    city: string;
    balance: number;
    is_under_attack: boolean;
    created_at: string;
}

export default function BankAccountsPanel() {
    const [accounts, setAccounts] = useState<BankAccount[]>([]);
    const [selected, setSelected] = useState<BankAccount | null>(null);
    const [report, setReport] = useState("");
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);

    useEffect(() => {
        fetchAccounts();
        const interval = setInterval(fetchAccounts, 10000);
        return () => clearInterval(interval);
    }, []);

    async function fetchAccounts() {
        try {
            const res = await fetch(`${API}/bankserver/api/accounts`);
            if (res.ok) {
                const data = await res.json();
                setAccounts(data);
            }
        } catch { /* silent */ }
        setFetching(false);
    }

    async function analyzeAccount(acct: BankAccount) {
        setSelected(acct);
        setReport("");
        setLoading(true);
        try {
            const res = await fetch(`${API}/api/v1/account-report`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ account_number: acct.account_number }),
            });
            if (res.ok) {
                const data = await res.json();
                setReport(data.report);
            } else {
                setReport("Failed to generate report. Backend may be unavailable.");
            }
        } catch {
            setReport("Error connecting to AI analysis engine.");
        }
        setLoading(false);
    }

    return (
        <div className="h-full grid grid-cols-12 gap-3" style={{ animation: "fade-in 0.3s ease-out" }}>
            {/* LEFT: Account List */}
            <div className="col-span-5 bg-gray-900/70 backdrop-blur-sm border border-gray-800 rounded-xl overflow-hidden flex flex-col">
                <div className="px-4 py-2.5 border-b border-gray-800 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" style={{ animation: "status-blink 2s infinite" }} />
                    <h3 className="text-xs font-bold tracking-widest uppercase text-blue-400"
                        style={{ fontFamily: "JetBrains Mono, monospace" }}>
                        Bank Accounts
                    </h3>
                    <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full border border-blue-700/50 bg-blue-900/30 text-blue-400"
                        style={{ fontFamily: "JetBrains Mono, monospace" }}>
                        {accounts.length} registered
                    </span>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-gray-800">
                    {accounts.map((acct, idx) => (
                        <button
                            key={acct.account_number}
                            onClick={() => analyzeAccount(acct)}
                            className={`w-full text-left px-4 py-3 transition-all duration-200 cursor-pointer ${selected?.account_number === acct.account_number
                                    ? "bg-blue-900/30 border-l-3 border-l-blue-400"
                                    : "hover:bg-gray-800/60"
                                }`}
                            style={{ animation: `slide-in-up 0.3s ease-out ${idx * 0.05}s both` }}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-gray-100 truncate flex items-center gap-1.5">
                                        {acct.is_under_attack && (
                                            <span className="inline-block w-2 h-2 rounded-full bg-red-500 flex-shrink-0" style={{ animation: "status-blink 1s infinite" }} />
                                        )}
                                        {acct.holder_name}
                                    </p>
                                    <p className="text-[10px] text-gray-400 mt-0.5" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                                        A/C: {acct.account_number} • {acct.city}
                                    </p>
                                </div>
                                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                    <span className="text-[10px] font-bold text-green-400" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                                        ₹{Number(acct.balance).toLocaleString("en-IN")}
                                    </span>
                                    {acct.is_under_attack ? (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-900/40 text-red-400 border border-red-700/50 font-bold"
                                            style={{ fontFamily: "JetBrains Mono, monospace" }}>
                                            UNDER ATTACK
                                        </span>
                                    ) : (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-900/30 text-green-400 border border-green-700/40 font-bold"
                                            style={{ fontFamily: "JetBrains Mono, monospace" }}>
                                            ACTIVE
                                        </span>
                                    )}
                                </div>
                            </div>
                        </button>
                    ))}

                    {accounts.length === 0 && (
                        <div className="p-8 text-center text-gray-400 text-sm">
                            <p className="text-2xl mb-2">🏦</p>
                            <p className="font-medium">{fetching ? "Loading accounts..." : "No accounts registered"}</p>
                            <p className="text-xs mt-1">Create accounts at /bankserver to populate</p>
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT: AI Report */}
            <div className="col-span-7 bg-gray-900/70 backdrop-blur-sm border border-gray-800 rounded-xl overflow-hidden flex flex-col">
                <div className="px-4 py-2.5 border-b border-gray-800 flex items-center gap-2">
                    <span className="text-sm">🤖</span>
                    <h3 className="text-xs font-bold tracking-widest uppercase text-purple-400"
                        style={{ fontFamily: "JetBrains Mono, monospace" }}>
                        AI Account Report
                    </h3>
                    {selected && (
                        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full border border-purple-700/50 bg-purple-900/30 text-purple-400"
                            style={{ fontFamily: "JetBrains Mono, monospace" }}>
                            {selected.holder_name}
                        </span>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {!selected && !loading && (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500">
                            <p className="text-3xl mb-3">📊</p>
                            <p className="text-sm font-medium">Select an Account</p>
                            <p className="text-xs mt-1">Click on any account to generate an AI risk report</p>
                        </div>
                    )}

                    {loading && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-purple-900/40 border border-purple-700/50 flex items-center justify-center">
                                    <span className="text-lg" style={{ animation: "spin 1s linear infinite" }}>⚙</span>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-purple-400">Gemini AI Analyzing...</p>
                                    <p className="text-[10px] text-gray-500">{selected?.holder_name} — A/C {selected?.account_number}</p>
                                </div>
                            </div>
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} className="h-3 rounded" style={{
                                    background: "linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%)",
                                    backgroundSize: "200% 100%",
                                    animation: `shimmer 1.5s infinite ${i * 0.15}s`,
                                    width: `${100 - i * 12}%`,
                                }} />
                            ))}
                        </div>
                    )}

                    {report && !loading && selected && (
                        <div style={{ animation: "fade-in 0.3s ease-out" }}>
                            {/* Account Summary Card */}
                            <div className="grid grid-cols-3 gap-2 mb-4">
                                <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-3">
                                    <p className="text-[9px] text-gray-500 uppercase tracking-wider">Account</p>
                                    <p className="text-xs font-bold text-gray-200 mt-0.5" style={{ fontFamily: "JetBrains Mono, monospace" }}>{selected.account_number}</p>
                                </div>
                                <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-3">
                                    <p className="text-[9px] text-gray-500 uppercase tracking-wider">Balance</p>
                                    <p className="text-xs font-bold text-green-400 mt-0.5" style={{ fontFamily: "JetBrains Mono, monospace" }}>₹{Number(selected.balance).toLocaleString("en-IN")}</p>
                                </div>
                                <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-3">
                                    <p className="text-[9px] text-gray-500 uppercase tracking-wider">Status</p>
                                    <p className={`text-xs font-bold mt-0.5 ${selected.is_under_attack ? "text-red-400" : "text-green-400"}`}>
                                        {selected.is_under_attack ? "⚠ COMPROMISED" : "● SECURE"}
                                    </p>
                                </div>
                            </div>

                            {/* Details Row */}
                            <div className="grid grid-cols-4 gap-2 mb-4">
                                <div className="bg-gray-800/40 rounded-lg p-2">
                                    <p className="text-[8px] text-gray-500 uppercase">Phone</p>
                                    <p className="text-[10px] text-gray-300 font-medium truncate">{selected.phone || "—"}</p>
                                </div>
                                <div className="bg-gray-800/40 rounded-lg p-2">
                                    <p className="text-[8px] text-gray-500 uppercase">Email</p>
                                    <p className="text-[10px] text-gray-300 font-medium truncate">{selected.email || "—"}</p>
                                </div>
                                <div className="bg-gray-800/40 rounded-lg p-2">
                                    <p className="text-[8px] text-gray-500 uppercase">IFSC</p>
                                    <p className="text-[10px] text-gray-300 font-medium">{selected.ifsc}</p>
                                </div>
                                <div className="bg-gray-800/40 rounded-lg p-2">
                                    <p className="text-[8px] text-gray-500 uppercase">City</p>
                                    <p className="text-[10px] text-gray-300 font-medium">{selected.city}</p>
                                </div>
                            </div>

                            {/* AI Report */}
                            <div className="bg-gray-800/40 border border-purple-800/30 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-xs">🤖</span>
                                    <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Gemini AI Analysis</p>
                                </div>
                                <div className="prose prose-invert prose-xs max-w-none">
                                    {report.split("\n").map((line, i) => {
                                        if (line.startsWith("##")) {
                                            return <h4 key={i} className="text-xs font-bold text-blue-400 mt-3 mb-1">{line.replace(/^#+\s/, "")}</h4>;
                                        }
                                        if (line.startsWith("**") || line.startsWith("- **")) {
                                            return <p key={i} className="text-[11px] text-gray-200 font-semibold my-0.5">{line.replace(/\*\*/g, "")}</p>;
                                        }
                                        if (line.startsWith("- ") || line.startsWith("• ")) {
                                            return <p key={i} className="text-[11px] text-gray-300 pl-3 my-0.5">• {line.replace(/^[-•]\s/, "")}</p>;
                                        }
                                        if (line.trim() === "") return <div key={i} className="h-2" />;
                                        return <p key={i} className="text-[11px] text-gray-300 leading-relaxed my-0.5">{line}</p>;
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
