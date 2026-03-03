"use client";

import { useState } from "react";

const API = "http://localhost:8000";

export default function MoneyAddons() {
    const [accountNumber, setAccountNumber] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [amount, setAmount] = useState("");
    const [action, setAction] = useState<"add" | "withdraw">("add");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string; new_balance?: number; holder_name?: string } | null>(null);
    const [error, setError] = useState("");

    async function handleSubmit() {
        if (!accountNumber || !username || !password || !amount) {
            setError("Please fill all fields");
            return;
        }
        setLoading(true);
        setError("");
        setResult(null);

        try {
            const res = await fetch(`${API}/bankserver/api/money-addon`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    account_number: accountNumber,
                    username,
                    password,
                    action,
                    amount: parseFloat(amount),
                }),
            });
            const data = await res.json();
            if (data.success) {
                setResult(data);
                setAmount("");
            } else {
                setError(data.error || "Operation failed");
            }
        } catch {
            setError("Failed to connect to server");
        }
        setLoading(false);
    }

    return (
        <div className="h-full grid grid-cols-12 gap-3" style={{ animation: "fade-in 0.3s ease-out" }}>
            {/* LEFT: Form */}
            <div className="col-span-5 bg-gray-900/70 backdrop-blur-sm border border-gray-800 rounded-xl overflow-hidden flex flex-col">
                <div className="px-4 py-2.5 border-b border-gray-800 flex items-center gap-2">
                    <span className="text-sm">🏛️</span>
                    <h3 className="text-xs font-bold tracking-widest uppercase text-emerald-400"
                        style={{ fontFamily: "JetBrains Mono, monospace" }}>
                        Bank Official Panel
                    </h3>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg p-3">
                        <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">⚠ Authorized Access Only</p>
                        <p className="text-[10px] text-amber-300/70 mt-1">Bank official operations require valid account credentials</p>
                    </div>

                    {/* Account Number */}
                    <div>
                        <label className="text-[10px] text-gray-400 uppercase tracking-wider font-bold block mb-1">Account Number</label>
                        <input
                            type="text" value={accountNumber}
                            onChange={(e) => setAccountNumber(e.target.value)}
                            placeholder="Enter account number"
                            className="w-full px-3 py-2 bg-gray-800/80 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                        />
                    </div>

                    {/* Credentials */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] text-gray-400 uppercase tracking-wider font-bold block mb-1">Username</label>
                            <input
                                type="text" value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Account username"
                                className="w-full px-3 py-2 bg-gray-800/80 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-400 uppercase tracking-wider font-bold block mb-1">Password</label>
                            <input
                                type="password" value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Account password"
                                className="w-full px-3 py-2 bg-gray-800/80 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>

                    {/* Action Toggle */}
                    <div>
                        <label className="text-[10px] text-gray-400 uppercase tracking-wider font-bold block mb-2">Action</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setAction("add")}
                                className={`px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${action === "add"
                                        ? "bg-emerald-600 text-white border border-emerald-500"
                                        : "bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700"
                                    }`}
                            >
                                💰 Add Money
                            </button>
                            <button
                                onClick={() => setAction("withdraw")}
                                className={`px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${action === "withdraw"
                                        ? "bg-red-600 text-white border border-red-500"
                                        : "bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700"
                                    }`}
                            >
                                📤 Withdraw Money
                            </button>
                        </div>
                    </div>

                    {/* Amount */}
                    <div>
                        <label className="text-[10px] text-gray-400 uppercase tracking-wider font-bold block mb-1">Amount (₹)</label>
                        <input
                            type="number" value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="Enter amount in INR"
                            min="1"
                            className="w-full px-3 py-2 bg-gray-800/80 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                        />
                    </div>

                    {/* Submit */}
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className={`w-full py-3 rounded-lg font-bold text-sm transition-all cursor-pointer ${action === "add"
                                ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                                : "bg-red-600 hover:bg-red-500 text-white"
                            } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                        {loading ? "Processing..." : action === "add" ? "💰 Add Funds" : "📤 Withdraw Funds"}
                    </button>

                    {/* Error */}
                    {error && (
                        <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3">
                            <p className="text-xs text-red-400 font-medium">❌ {error}</p>
                        </div>
                    )}

                    {/* Success */}
                    {result && (
                        <div className="bg-emerald-900/30 border border-emerald-700/50 rounded-lg p-3" style={{ animation: "fade-in 0.3s ease-out" }}>
                            <p className="text-xs text-emerald-400 font-bold">✅ {result.message}</p>
                            <p className="text-[10px] text-gray-400 mt-1">
                                Account: {result.holder_name} — New Balance: <span className="text-emerald-400 font-bold">₹{Number(result.new_balance).toLocaleString("en-IN")}</span>
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT: Info Panel */}
            <div className="col-span-7 bg-gray-900/70 backdrop-blur-sm border border-gray-800 rounded-xl overflow-hidden flex flex-col">
                <div className="px-4 py-2.5 border-b border-gray-800 flex items-center gap-2">
                    <span className="text-sm">📋</span>
                    <h3 className="text-xs font-bold tracking-widest uppercase text-blue-400"
                        style={{ fontFamily: "JetBrains Mono, monospace" }}>
                        Operations Log
                    </h3>
                </div>

                <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center">
                    <div className="text-center max-w-sm">
                        <p className="text-4xl mb-4">🏛️</p>
                        <h3 className="text-lg font-bold text-gray-200 mb-2">Bank Official Portal</h3>
                        <p className="text-xs text-gray-400 leading-relaxed mb-6">
                            Use the form on the left to add or withdraw funds from any registered account.
                            You must provide the account&apos;s login credentials for authentication.
                        </p>
                        <div className="grid grid-cols-2 gap-3 text-left">
                            <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-3">
                                <p className="text-emerald-400 text-lg mb-1">💰</p>
                                <p className="text-[10px] font-bold text-gray-300 uppercase">Add Funds</p>
                                <p className="text-[9px] text-gray-500 mt-1">Credit money to account balance</p>
                            </div>
                            <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-3">
                                <p className="text-red-400 text-lg mb-1">📤</p>
                                <p className="text-[10px] font-bold text-gray-300 uppercase">Withdraw</p>
                                <p className="text-[9px] text-gray-500 mt-1">Debit from account (balance checked)</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
