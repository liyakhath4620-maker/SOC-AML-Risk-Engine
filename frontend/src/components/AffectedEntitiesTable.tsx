"use client";

import React, { useMemo, useState } from "react";

interface Entity {
    id: string;
    entityType: string;
    ipAddress: string;
    status: string;
    riskLevel: string;
    relatedThreatTitle: string;
}

interface AffectedEntitiesTableProps {
    threats: {
        id: string;
        title: string;
        risk_level: string;
        status: string;
        threat_data?: {
            breach_details?: {
                account_id?: string;
                ip_address?: string;
            };
            transaction_details?: {
                sender_id?: string;
                receiver_id?: string;
            };
        };
    }[];
    frozenAccounts: Set<string>;
    onFreezeAccount: (accountId: string) => void;
    freezingAccounts: Set<string>;
}

export default function AffectedEntitiesTable({
    threats,
    frozenAccounts,
    onFreezeAccount,
    freezingAccounts,
}: AffectedEntitiesTableProps) {
    const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
    const [processingTrace, setProcessingTrace] = useState<string | null>(null);
    const [localFrozen, setLocalFrozen] = useState<Set<string>>(new Set());

    const entities = useMemo(() => {
        const seen = new Set<string>();
        const result: Entity[] = [];

        threats.forEach((t) => {
            const td = t.threat_data;
            if (!td) return;

            const accountId = td.breach_details?.account_id;
            const ip = td.breach_details?.ip_address || "—";
            const senderId = td.transaction_details?.sender_id;
            const receiverId = td.transaction_details?.receiver_id;

            if (accountId && !seen.has(accountId)) {
                seen.add(accountId);
                result.push({
                    id: accountId,
                    entityType: "Compromised Account",
                    ipAddress: ip,
                    status: frozenAccounts.has(accountId) ? "FROZEN" : "Active",
                    riskLevel: t.risk_level,
                    relatedThreatTitle: t.title,
                });
            }
            if (senderId && senderId !== accountId && !seen.has(senderId)) {
                seen.add(senderId);
                result.push({
                    id: senderId,
                    entityType: "Sender Account",
                    ipAddress: ip,
                    status: frozenAccounts.has(senderId) ? "FROZEN" : "Active",
                    riskLevel: t.risk_level,
                    relatedThreatTitle: t.title,
                });
            }
            if (receiverId && !seen.has(receiverId)) {
                seen.add(receiverId);
                result.push({
                    id: receiverId,
                    entityType: "Receiver (Mule)",
                    ipAddress: "—",
                    status: frozenAccounts.has(receiverId) ? "FROZEN" : "Active",
                    riskLevel: t.risk_level,
                    relatedThreatTitle: t.title,
                });
            }
        });

        return result;
    }, [threats, frozenAccounts]);

    const toggleRow = (id: string) => {
        setExpandedRowId(prev => prev === id ? null : id);
    };

    const handleExecuteTrace = (id: string) => {
        setProcessingTrace(id);
        // Call real backend freeze + optimistic UI update
        onFreezeAccount(id);
        setTimeout(() => {
            setLocalFrozen(prev => new Set(prev).add(id));
            setProcessingTrace(null);
        }, 1500);
    };

    return (
        <div
            className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl flex flex-col overflow-hidden"
            style={{ animation: "float-in 0.5s ease-out 0.3s both" }}
        >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--color-accent-red)", animation: "status-blink 2s infinite 1s" }} />
                    <h3
                        className="text-xs font-bold tracking-widest uppercase"
                        style={{ color: "var(--color-accent-red)", fontFamily: "JetBrains Mono, monospace" }}
                    >
                        Affected Entities
                    </h3>
                </div>
                <span
                    className="text-[10px] px-2 py-0.5 rounded-full border border-gray-700 bg-gray-900 text-gray-300"
                    style={{ fontFamily: "JetBrains Mono, monospace" }}
                >
                    {entities.length} entities
                </span>
            </div>

            <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10 bg-gray-900 border-b border-gray-800">
                        <tr
                            className="text-[9px] uppercase tracking-widest text-gray-500"
                            style={{ fontFamily: "JetBrains Mono, monospace" }}
                        >
                            <th className="p-3 font-medium">ID</th>
                            <th className="p-3 font-medium">Type</th>
                            <th className="p-3 font-medium">IP</th>
                            <th className="p-3 font-medium">Status</th>
                            <th className="p-3 font-medium text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                        {entities.map((entity, idx) => {
                            const isFrozen = localFrozen.has(entity.id) || entity.status === "FROZEN" || frozenAccounts.has(entity.id);
                            const entityStatus = isFrozen ? "FROZEN / MITIGATED" : "ACTIVE";
                            const isExpanded = expandedRowId === entity.id;

                            return (
                                <React.Fragment key={entity.id}>
                                    <tr
                                        onClick={() => toggleRow(entity.id)}
                                        className={`text-xs transition-all duration-300 hover:bg-gray-800/50 cursor-pointer ${isFrozen ? "row-frozen" : ""
                                            }`}
                                        style={{
                                            animation: `slide-in-up 0.3s ease-out ${idx * 0.05}s both`,
                                            fontFamily: "JetBrains Mono, monospace",
                                        }}
                                    >
                                        <td className="p-3">
                                            <span className="text-gray-100 font-semibold">{entity.id}</span>
                                        </td>
                                        <td className="p-3 text-gray-400 text-[10px]">{entity.entityType}</td>
                                        <td className="p-3">
                                            <span className="text-[10px] text-[var(--color-neon-orange)]">{entity.ipAddress}</span>
                                        </td>
                                        <td className="p-3">
                                            <span
                                                className={`inline-flex items-center gap-1.5 px-0 text-[10px] font-bold tracking-wider ${isFrozen
                                                    ? "text-emerald-400"
                                                    : "text-red-500"
                                                    }`}
                                            >
                                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isFrozen ? "var(--color-accent-green)" : "var(--color-accent-red)", animation: isFrozen ? "none" : "status-blink 1s infinite" }} />
                                                {entityStatus}
                                            </span>
                                        </td>
                                        <td className="p-3 text-right">
                                            <span className="text-gray-500">{isExpanded ? '▲' : '▼'}</span>
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr className="bg-gray-950/80 border-b border-gray-800">
                                            <td colSpan={5} className="p-4 border-l-2 border-[var(--color-accent-red)]">
                                                <div className="flex flex-col gap-3">
                                                    <div className="flex flex-col gap-1 text-xs font-mono text-gray-400">
                                                        <p className="text-[10px] uppercase text-[var(--color-accent-red)] tracking-widest font-bold mb-1">Trace Intelligence</p>
                                                        <p>› Initiating traceback on IP {entity.ipAddress}...</p>
                                                        <p>› Financial links identified for account {entity.id}.</p>
                                                        <p>› Ready for preemptive containment.</p>
                                                    </div>
                                                    <button
                                                        onClick={() => handleExecuteTrace(entity.id)}
                                                        disabled={processingTrace === entity.id || isFrozen}
                                                        className={`w-full py-3 rounded text-sm font-bold uppercase tracking-widest transition-all duration-300 ${isFrozen ? "bg-emerald-900/50 text-emerald-500 border border-emerald-500/40" :
                                                            processingTrace === entity.id ? "bg-red-900/40 text-red-300 cursor-wait border border-red-500/40" :
                                                                "bg-red-900 text-red-100 hover:shadow-[0_0_20px_rgba(220,38,38,0.8)] border border-red-500/50 cursor-pointer"
                                                            }`}
                                                        style={{ fontFamily: "JetBrains Mono, monospace" }}
                                                    >
                                                        {processingTrace === entity.id ? (
                                                            <span className="flex items-center justify-center gap-2">
                                                                <span className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></span>
                                                                TRACING & FREEZING...
                                                            </span>
                                                        ) : isFrozen ? (
                                                            "✓ FROZEN / MITIGATED"
                                                        ) : (
                                                            "[ EXECUTE TRACE & FREEZE ]"
                                                        )}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                        {entities.length === 0 && (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-gray-400 text-xs">
                                    No affected entities detected.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
