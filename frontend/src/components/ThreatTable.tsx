"use client";

import { useState, useEffect } from "react";

export interface ActiveThreat {
    id: string;
    title: string;
    risk_level: string;
    status: string;
    timestamp: string;
    threat_data: any;
    notes: { timestamp: string; text: string; author: string }[];
}

interface ThreatTableProps {
    onSelectThreat: (threat: ActiveThreat | null) => void;
    selectedThreatId: string | null;
}

export default function ThreatTable({ onSelectThreat, selectedThreatId }: ThreatTableProps) {
    const [threats, setThreats] = useState<ActiveThreat[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddingManual, setIsAddingManual] = useState(false);
    const [manualTitle, setManualTitle] = useState("");
    const [manualDescription, setManualDescription] = useState("");
    const [manualType, setManualType] = useState("IP Address");
    const [manualValue, setManualValue] = useState("");

    const fetchThreats = async () => {
        try {
            const res = await fetch("http://localhost:8000/api/v1/threats");
            if (res.ok) {
                const data = await res.json();
                setThreats(data);
            }
        } catch (err) {
            console.error("Failed to fetch threats", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Initial fetch
        fetchThreats();
        // Poll every 10 seconds for updates
        const interval = setInterval(fetchThreats, 10000);
        return () => clearInterval(interval);
    }, []);

    const handleUpdateStatus = async (id: string, newStatus: string) => {
        // Optimistic UI Update
        setThreats((prev) =>
            prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t))
        );

        // Backend sync
        await fetch(`http://localhost:8000/api/v1/threats/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus }),
        });
    };

    const handleDismiss = async (id: string) => {
        // Optimistic UI Update
        setThreats((prev) => prev.filter((t) => t.id !== id));
        if (selectedThreatId === id) onSelectThreat(null);

        // Backend sync
        await fetch(`http://localhost:8000/api/v1/threats/${id}`, { method: "DELETE" });
    };

    const submitManualThreat = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualTitle || !manualValue) return;

        const payload = {
            title: manualTitle,
            description: manualDescription,
            indicator_type: manualType,
            indicator_value: manualValue,
            risk_level: "HIGH"
        };

        // Optimistic UI creation (temporary ID until server responds)
        const tempId = `TEMP-${Date.now()}`;
        const newThreat: ActiveThreat = {
            id: tempId,
            ...payload,
            status: "Investigating",
            timestamp: new Date().toISOString(),
            threat_data: { source: "Manual Analyst Entry", indicator_type: manualType, indicator_value: manualValue, description: manualDescription },
            notes: [],
        };

        setThreats((prev) => [newThreat, ...prev]);
        setIsAddingManual(false);
        setManualTitle("");
        setManualValue("");
        setManualDescription("");

        // Backend sync
        const res = await fetch("http://localhost:8000/api/v1/threats", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (res.ok) {
            const finalThreat = await res.json();
            setThreats((prev) => prev.map((t) => (t.id === tempId ? finalThreat : t)));
        } else {
            // Revert on failure
            setThreats((prev) => prev.filter((t) => t.id !== tempId));
        }
    };

    const getRiskColor = (level: string) => {
        switch (level.toUpperCase()) {
            case "CRITICAL": return "text-red-400 bg-red-400/10 border-red-400/20";
            case "HIGH": return "text-orange-400 bg-orange-400/10 border-orange-400/20";
            case "MEDIUM": return "text-yellow-400 bg-yellow-400/10 border-yellow-400/20";
            default: return "text-blue-400 bg-blue-400/10 border-blue-400/20";
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900 backdrop-blur-md">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--color-neon-orange)", animation: "status-blink 2s infinite" }} />
                    <h2 className="text-sm font-semibold tracking-wider uppercase text-[var(--color-neon-orange)] font-mono">
                        Active Threat Center
                    </h2>
                </div>
                <button
                    onClick={() => setIsAddingManual(!isAddingManual)}
                    className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-[var(--color-neon-orange)] font-mono text-[10px] rounded border border-orange-900/50 transition-colors"
                >
                    {isAddingManual ? "CANCEL" : "+ MANUAL ENTRY"}
                </button>
            </div>

            {/* Manual Entry Form */}
            {isAddingManual && (
                <div className="p-4 bg-gray-950 border-b border-gray-800">
                    <form onSubmit={submitManualThreat} className="space-y-3 font-mono text-xs">
                        <div className="grid grid-cols-2 gap-3">
                            <input
                                type="text" required placeholder="Threat Title" value={manualTitle} onChange={(e) => setManualTitle(e.target.value)}
                                className="bg-gray-900 border border-gray-800 p-2 rounded text-gray-200 w-full focus:outline-none focus:border-[var(--color-neon-orange)]"
                            />
                            <div className="flex gap-2">
                                <select
                                    value={manualType} onChange={(e) => setManualType(e.target.value)}
                                    className="bg-gray-900 border border-gray-800 p-2 rounded text-gray-200 focus:outline-none focus:border-[var(--color-neon-orange)]"
                                >
                                    <option>IP Address</option>
                                    <option>Email</option>
                                    <option>Account ID</option>
                                </select>
                                <input
                                    type="text" required placeholder="Value (e.g. 192.168.1.1)" value={manualValue} onChange={(e) => setManualValue(e.target.value)}
                                    className="bg-gray-900 border border-gray-800 p-2 rounded text-gray-200 flex-1 focus:outline-none focus:border-[var(--color-neon-orange)]"
                                />
                            </div>
                        </div>
                        <input
                            type="text" placeholder="Description / Context" value={manualDescription} onChange={(e) => setManualDescription(e.target.value)}
                            className="bg-gray-900 border border-gray-800 p-2 rounded text-gray-200 w-full focus:outline-none focus:border-[var(--color-neon-orange)]"
                        />
                        <button type="submit" className="w-full py-2 bg-[var(--color-neon-orange)] hover:opacity-80 text-white rounded font-bold transition-opacity">
                            SUBMIT THREAT TO ENGINE
                        </button>
                    </form>
                </div>
            )}

            {/* Table Data */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {loading ? (
                    <div className="p-8 text-center text-gray-500 font-mono text-sm animate-pulse">Fetching active threats...</div>
                ) : threats.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 font-mono text-sm">No active threats found.</div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-900 text-gray-400 font-mono text-[10px] uppercase sticky top-0 z-10 border-b border-gray-800">
                            <tr>
                                <th className="p-3 font-medium cursor-pointer hover:bg-gray-800 w-[40%]">Threat Title</th>
                                <th className="p-3 font-medium w-[20%]">Risk</th>
                                <th className="p-3 font-medium w-[25%]">Status</th>
                                <th className="p-3 font-medium w-[15%] text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-gray-300 font-mono text-xs divide-y divide-gray-800">
                            {threats.map((threat) => (
                                <tr
                                    key={threat.id}
                                    className={`hover:bg-gray-800/50 transition-colors ${selectedThreatId === threat.id ? 'bg-gray-800 border-l-2 border-l-[var(--color-neon-orange)]' : 'border-l-2 border-l-transparent'}`}
                                    onClick={(e) => {
                                        // Prevent row click if clicking a select or button
                                        if ((e.target as HTMLElement).tagName.toLowerCase() !== 'select' && (e.target as HTMLElement).tagName.toLowerCase() !== 'button') {
                                            onSelectThreat(threat);
                                        }
                                    }}
                                    style={{ cursor: "pointer" }}
                                >
                                    <td className="p-3">
                                        <div className="font-semibold text-gray-100 truncate flex items-center gap-2">
                                            {selectedThreatId === threat.id && <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-neon-orange)]" style={{ animation: "status-blink 1s infinite" }} />}
                                            {threat.title}
                                        </div>
                                        <div className="text-[10px] text-gray-500 mt-1">
                                            {new Date(threat.timestamp).toLocaleTimeString()} • {threat.id.split('-')[0]}
                                        </div>
                                    </td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 rounded border text-[10px] font-bold tracking-wider ${getRiskColor(threat.risk_level)}`}>
                                            {threat.risk_level}
                                        </span>
                                    </td>
                                    <td className="p-3">
                                        <select
                                            value={threat.status}
                                            onChange={(e) => handleUpdateStatus(threat.id, e.target.value)}
                                            className="bg-gray-950 border border-gray-800 text-gray-300 text-[10px] rounded p-1 w-full focus:outline-none focus:border-[var(--color-neon-orange)] transition-colors"
                                        >
                                            <option value="Pending Review">Pending Review</option>
                                            <option value="Investigating">Investigating</option>
                                            <option value="Confirmed Mule Ring">Confirmed Mule Ring</option>
                                            <option value="False Positive">False Positive</option>
                                        </select>
                                    </td>
                                    <td className="p-3 text-right">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDismiss(threat.id); }}
                                            className="text-gray-500 hover:text-red-400 text-lg transition-colors"
                                            title="Dismiss Threat"
                                        >
                                            ×
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
