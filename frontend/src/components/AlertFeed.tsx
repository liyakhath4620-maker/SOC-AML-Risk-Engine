"use client";

import { useState, useEffect, useRef } from "react";

const API_BASE = "http://localhost:8000";

interface AlertItem {
    alert_id?: string;
    tx_id?: string;
    record_type: string;
    severity?: string;
    alert_type?: string;
    description?: string;
    account_name?: string;
    account_id?: string;
    sender_name?: string;
    receiver_name?: string;
    amount?: number;
    currency?: string;
    timestamp?: string;
    ip_address?: string;
}

const severityStyles: Record<string, string> = {
    critical: "border-l-red-500 bg-red-500/5",
    high: "border-l-orange-500 bg-orange-500/5",
    medium: "border-l-amber-500 bg-amber-500/5",
    low: "border-l-cyan-500 bg-cyan-500/5",
};

const severityBadge: Record<string, string> = {
    critical: "bg-red-500/20 text-red-400 ring-1 ring-red-500/30",
    high: "bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/30",
    medium: "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30",
    low: "bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/30",
};

const typeIcons: Record<string, string> = {
    cyber_alert: "🛡️",
    transaction: "💸",
    login_event: "🔑",
};

function formatTime(timestamp?: string) {
    if (!timestamp) return "";
    const d = new Date(timestamp);
    return d.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });
}

function formatAmount(amount?: number, currency?: string) {
    if (!amount) return "";
    return `${currency || "USD"} ${amount.toLocaleString("en-US", {
        minimumFractionDigits: 2,
    })}`;
}

export default function AlertFeed() {
    const [alerts, setAlerts] = useState<AlertItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<string>("all");
    const feedRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchAlerts();
        // Simulate real-time with periodic refresh
        const interval = setInterval(fetchAlerts, 15000);
        return () => clearInterval(interval);
    }, []);

    async function fetchAlerts() {
        try {
            // Fetch the raw sample data which represents our "feed"
            const res = await fetch(`${API_BASE}/api/v1/graph-data`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const graphData = await res.json();

            // Build alert items from graph nodes
            const items: AlertItem[] = [];

            for (const node of graphData.nodes) {
                const d = node.data;
                if (d.type === "CyberAlert") {
                    items.push({
                        record_type: "cyber_alert",
                        alert_id: d.alert_id,
                        alert_type: d.alert_type,
                        severity: d.severity || "medium",
                        description: d.description,
                        timestamp: d.timestamp,
                        ip_address: d.ip_address,
                        account_name: d.name,
                        account_id: d.account_id,
                    });
                } else if (d.type === "Transaction") {
                    items.push({
                        record_type: "transaction",
                        tx_id: d.tx_id,
                        severity:
                            (d.amount || 0) >= 20000
                                ? "critical"
                                : (d.amount || 0) >= 10000
                                    ? "high"
                                    : "medium",
                        description: d.description,
                        amount: d.amount,
                        currency: d.currency,
                        timestamp: d.timestamp,
                        sender_name: d.sender_name,
                        receiver_name: d.receiver_name,
                        ip_address: d.ip_address,
                    });
                }
            }

            // Sort by timestamp descending
            items.sort((a, b) => {
                const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                return tb - ta;
            });

            setAlerts(items);
            setLoading(false);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch");
            setLoading(false);
        }
    }

    const filteredAlerts =
        filter === "all"
            ? alerts
            : alerts.filter((a) => a.record_type === filter);

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2d42]">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <h2
                        className="text-sm font-semibold tracking-wider uppercase"
                        style={{ color: "var(--color-neon-orange)", fontFamily: "JetBrains Mono, monospace" }}
                    >
                        Live Alert Feed
                    </h2>
                    <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-[#1a2332] text-gray-400 ring-1 ring-[#2a3f5f]">
                        {filteredAlerts.length}
                    </span>
                </div>
                {/* Filter buttons */}
                <div className="flex gap-1">
                    {["all", "cyber_alert", "transaction"].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-2.5 py-1 text-xs rounded-md transition-all duration-200 ${filter === f
                                ? "bg-gray-800 text-[var(--color-neon-orange)] ring-1 ring-orange-900/40"
                                : "text-gray-500 hover:text-gray-300 hover:bg-gray-800"
                                }`}
                            style={{ fontFamily: "JetBrains Mono, monospace" }}
                        >
                            {f === "all" ? "ALL" : f === "cyber_alert" ? "SOC" : "AML"}
                        </button>
                    ))}
                </div>
            </div>

            {/* Feed */}
            <div
                ref={feedRef}
                className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5"
                style={{ maxHeight: "calc(100vh - 200px)" }}
            >
                {loading && (
                    <div className="flex items-center justify-center h-32 text-gray-500">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                            <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "12px" }}>
                                Connecting to feed...
                            </span>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="mx-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                        <span className="font-mono">ERROR:</span> {error}
                    </div>
                )}

                {!loading &&
                    !error &&
                    filteredAlerts.map((alert, idx) => (
                        <div
                            key={alert.alert_id || alert.tx_id || idx}
                            className={`border-l-2 rounded-r-lg px-3 py-2.5 transition-all duration-300 hover:bg-[#1a2332]/80 cursor-pointer group ${severityStyles[alert.severity || "low"]
                                }`}
                            style={{
                                animation: `slide-in-right 0.3s ease-out ${idx * 0.05}s both`,
                            }}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm">
                                            {typeIcons[alert.record_type] || "📋"}
                                        </span>
                                        <span
                                            className={`px-1.5 py-0.5 text-[10px] font-semibold rounded uppercase tracking-wider ${severityBadge[alert.severity || "low"]
                                                }`}
                                        >
                                            {alert.severity}
                                        </span>
                                        {alert.alert_type && (
                                            <span
                                                className="text-[10px] text-gray-500 uppercase tracking-wider"
                                                style={{ fontFamily: "JetBrains Mono, monospace" }}
                                            >
                                                {alert.alert_type.replace(/_/g, " ")}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-300 leading-relaxed truncate">
                                        {alert.description || "No description"}
                                    </p>
                                    {alert.record_type === "transaction" && alert.amount && (
                                        <p className="text-xs mt-1 font-semibold text-amber-400">
                                            {formatAmount(alert.amount, alert.currency)}
                                        </p>
                                    )}
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <span
                                        className="text-[10px] text-gray-600 block"
                                        style={{ fontFamily: "JetBrains Mono, monospace" }}
                                    >
                                        {formatTime(alert.timestamp)}
                                    </span>
                                    {alert.ip_address && (
                                        <span
                                            className="text-[10px] text-gray-600 block mt-0.5"
                                            style={{ fontFamily: "JetBrains Mono, monospace" }}
                                        >
                                            {alert.ip_address}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
            </div>
        </div>
    );
}
