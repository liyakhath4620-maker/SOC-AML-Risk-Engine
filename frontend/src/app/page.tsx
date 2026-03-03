"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import DashboardShell from "@/components/DashboardShell";
import AIAssistant from "@/components/AIAssistant";
import AttackSurfaceRadar from "@/components/AttackSurfaceRadar";
import ThreatMetadataPanel from "@/components/ThreatMetadataPanel";
import CVSSRiskScore from "@/components/CVSSRiskScore";
import AffectedEntitiesTable from "@/components/AffectedEntitiesTable";
import FrozenAccountsPanel from "@/components/FrozenAccountsPanel";
import AlertFeed from "@/components/AlertFeed";
import ThreatNarrative from "@/components/ThreatNarrative";
import SuspiciousAccounts from "@/components/SuspiciousAccounts";
import BankAccountsPanel from "@/components/BankAccountsPanel";
import MoneyAddons from "@/components/MoneyAddons";
import LiveAttackBanner from "@/components/LiveAttackBanner";
import { useAccountFreeze } from "@/hooks/useAccountFreeze";
import { formatINR } from "@/lib/formatINR";

const GraphVisualizer = dynamic(() => import("@/components/GraphVisualizer"), { ssr: false });
const CityHeatmap = dynamic(() => import("@/components/CityHeatmap"), { ssr: false });
const MuleAccountMap = dynamic(() => import("@/components/MuleAccountMap"), { ssr: false });

const API_BASE = "http://localhost:8000";

export interface ActiveThreat {
  id: string;
  title: string;
  risk_level: string;
  status: string;
  timestamp: string;
  threat_data?: any;
  notes?: string[];
}

export default function DashboardPage() {
  const [selectedThreat, setSelectedThreat] = useState<ActiveThreat | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [threats, setThreats] = useState<ActiveThreat[]>([]);
  const [showAI, setShowAI] = useState(true);
  const { freeze, frozenAccounts, freezingAccounts } = useAccountFreeze();

  // Fetch real threats from the Python FastAPI backend
  const fetchThreats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/threats`);
      if (res.ok) {
        const data = await res.json();
        setThreats(data);
      }
    } catch {
      // Silent — backend may not be running
    }
  }, []);

  useEffect(() => {
    fetchThreats();
    const interval = setInterval(fetchThreats, 15000); // Refresh every 15s
    return () => clearInterval(interval);
  }, [fetchThreats]);

  const handleFreezeAccount = useCallback(
    async (accountId: string) => {
      await freeze([accountId]);
      // Re-fetch threats to update status
      setTimeout(fetchThreats, 500);
    },
    [freeze, fetchThreats]
  );

  const handleStatusChange = useCallback((threatId: string, newStatus: string) => {
    setThreats((prev) =>
      prev.map((t) => (t.id === threatId ? { ...t, status: newStatus } : t))
    );
  }, []);

  const clearAllThreats = useCallback(async () => {
    if (!confirm("Clear all threats and reset to idle? This will delete all attack logs.")) return;
    try {
      await fetch("http://localhost:8000/api/v1/clear-threats", { method: "POST" });
      setThreats([]);
      setSelectedThreat(null);
      setTimeout(fetchThreats, 500);
    } catch { /* ignore */ }
  }, [fetchThreats]);

  return (
    <DashboardShell activeTab={activeTab} onTabChange={setActiveTab}>
      <div className="h-[calc(100vh-110px)] relative flex gap-3">
        {/* ──── Main Content ──── */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Live Attack Monitor */}
          <LiveAttackBanner />

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div
                className="h-full grid grid-cols-12 grid-rows-[auto_1fr] gap-3 overflow-auto pr-1"
                style={{ animation: "fade-in 0.3s ease-out" }}
              >
                {/* Clear Button */}
                <div className="col-span-12 flex justify-end">
                  <button
                    onClick={clearAllThreats}
                    className="px-4 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase transition-all duration-200 cursor-pointer"
                    style={{
                      background: threats.length > 0 ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)",
                      border: `1px solid ${threats.length > 0 ? "rgba(239,68,68,0.4)" : "rgba(34,197,94,0.4)"}`,
                      color: threats.length > 0 ? "#ef4444" : "#22c55e",
                      fontFamily: "JetBrains Mono, monospace",
                    }}
                  >
                    {threats.length > 0 ? `🔴 ${threats.length} Active — Clear All Threats` : "✅ System Idle — No Threats"}
                  </button>
                </div>
                {/* Top Row: Radar + Metadata + CVSS */}
                <div className="col-span-5">
                  <AttackSurfaceRadar threats={threats} />
                </div>
                <div className="col-span-4">
                  <ThreatMetadataPanel threats={threats} />
                </div>
                <div className="col-span-3">
                  <CVSSRiskScore threats={threats} />
                </div>

                {/* Bottom Row: Threat List + Entities */}
                <div className="col-span-5 bg-gray-900/70 backdrop-blur-sm border border-gray-800 rounded-xl overflow-hidden flex flex-col">
                  <div className="px-4 py-2.5 border-b border-gray-800 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500" style={{ animation: "status-blink 2s infinite" }} />
                    <h3
                      className="text-xs font-bold tracking-widest uppercase text-[var(--color-neon-orange)]"
                      style={{ fontFamily: "JetBrains Mono, monospace" }}
                    >
                      Active Threats
                    </h3>
                    <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full border border-amber-700/50 bg-amber-900/30 text-amber-400" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                      {threats.length} detected
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto divide-y divide-gray-800">
                    {threats.map((t, idx) => {
                      const amount = t.threat_data?.transaction_details?.amount || 0;
                      const breach = t.threat_data?.breach_details || {};
                      const isExpanded = selectedThreat?.id === t.id;
                      return (
                        <div
                          key={t.id}
                          className="transition-all duration-200"
                          style={{ animation: `slide-in-up 0.3s ease-out ${idx * 0.05}s both` }}
                        >
                          <button
                            onClick={() => setSelectedThreat(isExpanded ? null : t)}
                            className={`w-full text-left px-4 py-3 transition-all duration-200 cursor-pointer ${isExpanded
                              ? "bg-blue-900/30 border-l-3 border-l-blue-400"
                              : "hover:bg-gray-800/60"
                              }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-gray-100 truncate">{t.title}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                                  {t.id} • {formatINR(amount)}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${t.risk_level === "CRITICAL"
                                    ? "bg-red-900/40 text-red-400 border border-red-700/50"
                                    : t.risk_level === "HIGH"
                                      ? "bg-amber-900/40 text-amber-400 border border-amber-700/50"
                                      : "bg-blue-900/40 text-blue-400 border border-blue-700/50"
                                    }`}
                                  style={{ fontFamily: "JetBrains Mono, monospace" }}
                                >
                                  {t.risk_level}
                                </span>
                                <span className="text-gray-500 text-[10px]" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0)", display: "inline-block", transition: "transform 0.2s" }}>▼</span>
                              </div>
                            </div>
                          </button>

                          {/* ── Expanded Detail Panel ── */}
                          {isExpanded && (
                            <div className="px-4 py-3 bg-gray-950/80 border-t border-gray-800" style={{ animation: "fade-in 0.2s ease-out" }}>
                              {/* Account & Attack Details */}
                              <div className="grid grid-cols-2 gap-2 mb-3">
                                <div className="bg-gray-800/50 rounded-lg p-2">
                                  <p className="text-[8px] text-gray-500 uppercase tracking-wider" style={{ fontFamily: "JetBrains Mono, monospace" }}>Account</p>
                                  <p className="text-[10px] text-amber-400 font-bold" style={{ fontFamily: "JetBrains Mono, monospace" }}>{breach.account_id || "—"}</p>
                                </div>
                                <div className="bg-gray-800/50 rounded-lg p-2">
                                  <p className="text-[8px] text-gray-500 uppercase tracking-wider" style={{ fontFamily: "JetBrains Mono, monospace" }}>IP Address</p>
                                  <p className="text-[10px] text-red-400 font-bold" style={{ fontFamily: "JetBrains Mono, monospace" }}>{breach.ip_address || "—"}</p>
                                </div>
                                <div className="bg-gray-800/50 rounded-lg p-2">
                                  <p className="text-[8px] text-gray-500 uppercase tracking-wider" style={{ fontFamily: "JetBrains Mono, monospace" }}>Alert Type</p>
                                  <p className="text-[10px] text-blue-400 font-bold" style={{ fontFamily: "JetBrains Mono, monospace" }}>{breach.alert_type || "—"}</p>
                                </div>
                                <div className="bg-gray-800/50 rounded-lg p-2">
                                  <p className="text-[8px] text-gray-500 uppercase tracking-wider" style={{ fontFamily: "JetBrains Mono, monospace" }}>Risk Score</p>
                                  <p className="text-[10px] text-red-400 font-bold" style={{ fontFamily: "JetBrains Mono, monospace" }}>{((t.threat_data?.confidence_score || 0) * 100).toFixed(0)}%</p>
                                </div>
                              </div>

                              {/* Description */}
                              <div className="bg-gray-800/30 rounded-lg p-2 mb-3">
                                <p className="text-[9px] text-gray-300 leading-relaxed" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                                  {breach.description || "No additional details available."}
                                </p>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex gap-2">
                                <button
                                  onClick={(e) => { e.stopPropagation(); alert(`📞 Calling account holder for ${breach.account_id}...`); }}
                                  className="flex-1 px-2 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider cursor-pointer transition-all hover:scale-[1.02]"
                                  style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.4)", color: "#3b82f6", fontFamily: "JetBrains Mono, monospace" }}
                                >
                                  📞 Call
                                </button>
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (!breach.account_id || breach.account_id === "—") return;
                                    try {
                                      await fetch("http://localhost:8000/api/v1/freeze-accounts", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ account_ids: [breach.account_id] }),
                                      });
                                      setSelectedThreat(null);
                                      fetchThreats();
                                      alert(`🧊 Account ${breach.account_id} has been FROZEN! Login & transfers blocked. Threat cleared.`);
                                    } catch { alert("Failed to freeze account"); }
                                  }}
                                  className="flex-1 px-2 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider cursor-pointer transition-all hover:scale-[1.02]"
                                  style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.4)", color: "#a855f7", fontFamily: "JetBrains Mono, monospace" }}
                                >
                                  🧊 Freeze
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); window.open(`mailto:?subject=SOC Alert: ${breach.alert_type} on ${breach.account_id}&body=Account ${breach.account_id} has been flagged for ${breach.alert_type}.%0AIP: ${breach.ip_address}%0ADetails: ${breach.description}`); }}
                                  className="flex-1 px-2 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider cursor-pointer transition-all hover:scale-[1.02]"
                                  style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.4)", color: "#22c55e", fontFamily: "JetBrains Mono, monospace" }}
                                >
                                  📧 Mail
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {threats.length === 0 && (
                      <div className="p-8 text-center text-gray-400 text-sm">
                        <p className="font-medium">No threats detected</p>
                        <p className="text-xs mt-1">Ensure the Python backend is running on port 8000</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="col-span-7">
                  <AffectedEntitiesTable
                    threats={threats}
                    frozenAccounts={frozenAccounts}
                    onFreezeAccount={handleFreezeAccount}
                    freezingAccounts={freezingAccounts}
                  />
                </div>
              </div>
            )}

            {/* Accounts Tab */}
            {activeTab === "accounts" && (
              <div className="h-full overflow-hidden flex flex-col" style={{ animation: "fade-in 0.3s ease-out" }}>
                <BankAccountsPanel />
              </div>
            )}

            {/* Money Addons Tab */}
            {activeTab === "moneyaddon" && (
              <div className="h-full overflow-hidden flex flex-col" style={{ animation: "fade-in 0.3s ease-out" }}>
                <MoneyAddons />
              </div>
            )}

            {/* Vectors Tab */}
            {activeTab === "vectors" && (
              <div className="h-full grid grid-cols-12 gap-3" style={{ animation: "fade-in 0.3s ease-out" }}>
                <div className="col-span-5 glass-panel overflow-hidden flex flex-col">
                  <CityHeatmap />
                </div>
                <div className="col-span-7 glass-panel overflow-hidden flex flex-col">
                  <GraphVisualizer selectedThreat={selectedThreat} />
                </div>
              </div>
            )}

            {/* Timeline Tab */}
            {activeTab === "timeline" && (
              <div className="h-full glass-panel overflow-hidden flex flex-col" style={{ animation: "fade-in 0.3s ease-out" }}>
                <AlertFeed />
              </div>
            )}

            {/* Logs Tab */}
            {activeTab === "logs" && (
              <div className="h-full glass-panel overflow-hidden flex flex-col" style={{ animation: "fade-in 0.3s ease-out" }}>
                <ThreatNarrative />
              </div>
            )}

            {/* Suspicious Accounts Tab */}
            {activeTab === "suspicious" && (
              <div className="h-full overflow-hidden flex flex-col" style={{ animation: "fade-in 0.3s ease-out" }}>
                <SuspiciousAccounts />
              </div>
            )}

            {/* Mule Map Tab */}
            {activeTab === "mulemap" && (
              <div className="h-full overflow-hidden flex flex-col" style={{ animation: "fade-in 0.3s ease-out" }}>
                <MuleAccountMap />
              </div>
            )}

            {/* Frozen Accounts Tab */}
            {activeTab === "frozen" && (
              <div className="h-full overflow-hidden flex flex-col" style={{ animation: "fade-in 0.3s ease-out" }}>
                <FrozenAccountsPanel />
              </div>
            )}
          </div> {/* end Tab Content */}
        </div>

        {/* ──── Floating AI Sidebar ──── */}
        <div
          className={`transition-all duration-300 ease-in-out flex-shrink-0 ${showAI ? "w-[420px] opacity-100" : "w-0 opacity-0 overflow-hidden"
            }`}
        >
          <div className="glass-panel-elevated h-full overflow-hidden flex flex-col relative">
            <AIAssistant selectedThreat={selectedThreat} />
          </div>
        </div>

        {/* AI Toggle */}
        <button
          onClick={() => setShowAI(!showAI)}
          className="absolute top-2 z-50 w-8 h-8 rounded-full flex items-center justify-center text-xs transition-all duration-200 cursor-pointer shadow-md"
          style={{
            background: showAI ? "#2563eb" : "#f1f3f5",
            color: showAI ? "#fff" : "#9ca3af",
            right: showAI ? "428px" : "8px",
            border: showAI ? "none" : "1px solid #e2e6ea",
          }}
          title={showAI ? "Hide AI Assistant" : "Show AI Assistant"}
        >
          {showAI ? "✕" : "AI"}
        </button>
      </div>
    </DashboardShell>
  );
}
