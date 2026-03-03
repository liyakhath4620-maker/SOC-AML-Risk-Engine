"use client";

import { useState, useEffect, ReactNode } from "react";
import RadialProgressGauge from "./RadialProgressGauge";
import { useThreatFramework } from "@/hooks/useThreatFramework";

const NAV_ITEMS = [
    { id: "overview", icon: "◉", label: "Overview" },
    { id: "accounts", icon: "🏦", label: "Accounts" },
    { id: "moneyaddon", icon: "💰", label: "Money Addons" },
    { id: "vectors", icon: "⬡", label: "Vectors" },
    { id: "timeline", icon: "◷", label: "Timeline" },
    { id: "logs", icon: "☰", label: "Logs" },
    { id: "suspicious", icon: "⚠", label: "Suspicious" },
    { id: "mulemap", icon: "◎", label: "Mule Map" },
];

interface DashboardShellProps {
    children: ReactNode;
    activeTab: string;
    onTabChange: (tab: string) => void;
}

export default function DashboardShell({
    children,
    activeTab,
    onTabChange,
}: DashboardShellProps) {
    // Hydration-safe clock: only render after mount
    const [mounted, setMounted] = useState(false);
    const [time, setTime] = useState<Date | null>(null);
    const { score } = useThreatFramework(5000);

    useEffect(() => {
        setMounted(true);
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const riskPercent = score ? Math.round(score.mule_ring_probability * 100) : 0;

    return (
        <div className="min-h-screen flex bg-gray-950 text-gray-100 font-sans scanlines">
            {/* ──── Left Sidebar ──── */}
            <aside className="sidebar-nav flex-shrink-0 flex flex-col border-r border-gray-800 bg-gray-900 sticky top-0 h-screen z-40">
                {/* New Operation CTA */}
                <div className="p-2 border-b border-gray-800">
                    <button
                        className="w-full flex items-center justify-center gap-0 rounded-lg py-2.5 px-2 font-bold text-xs uppercase tracking-wider transition-all duration-200 hover:shadow-lg cursor-pointer text-white"
                        style={{
                            background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                            fontFamily: "JetBrains Mono, monospace",
                            boxShadow: "0 2px 10px rgba(37, 99, 235, 0.25)",
                        }}
                        title="New Operation"
                    >
                        <span className="text-base">+</span>
                        <span className="nav-label text-[10px]">NEW OP</span>
                    </button>
                </div>

                {/* Nav Items */}
                <nav className="flex-1 flex flex-col gap-1 p-2 pt-4">
                    {NAV_ITEMS.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => onTabChange(item.id)}
                            className={`flex items-center rounded-lg py-2.5 px-3 text-sm transition-all duration-200 cursor-pointer ${activeTab === item.id
                                ? "bg-gray-800 text-[var(--color-neon-orange)]"
                                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                                }`}
                            title={item.label}
                        >
                            <span className="text-base flex-shrink-0 w-5 text-center">{item.icon}</span>
                            <span
                                className="nav-label text-[11px] font-medium"
                                style={{ fontFamily: "JetBrains Mono, monospace" }}
                            >
                                {item.label}
                            </span>
                        </button>
                    ))}
                </nav>

                {/* Bottom */}
                <div className="p-2 border-t border-gray-800">
                    <div className="flex items-center justify-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" style={{ animation: "status-blink 3s infinite" }} />
                        <span
                            className="nav-label text-[9px] text-gray-400"
                            style={{ fontFamily: "JetBrains Mono, monospace" }}
                        >
                            ONLINE
                        </span>
                    </div>
                </div>
            </aside>

            {/* ──── Main Area ──── */}
            <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
                {/* Top Bar */}
                <header className="flex-shrink-0 border-b border-gray-800 bg-gray-900 sticky top-0 z-30">
                    <div className="flex items-center justify-between px-5 py-2.5">
                        {/* Left: Logo */}
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div
                                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                                    style={{
                                        background: "linear-gradient(135deg, #2563eb, #7c3aed)",
                                        animation: "pulse-glow 3s ease-in-out infinite",
                                    }}
                                >
                                    <span className="text-white text-sm font-bold">⬡</span>
                                </div>
                                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border-2 border-white" />
                            </div>
                            <div>
                                <h1
                                    className="text-sm font-bold tracking-widest uppercase"
                                    style={{
                                        background: "linear-gradient(90deg, #2563eb, #7c3aed)",
                                        WebkitBackgroundClip: "text",
                                        WebkitTextFillColor: "transparent",
                                        fontFamily: "JetBrains Mono, monospace",
                                    }}
                                >
                                    SOC-AML Risk Engine
                                </h1>
                                <p
                                    className="text-[9px] tracking-wider text-gray-400"
                                    style={{ fontFamily: "JetBrains Mono, monospace" }}
                                >
                                    Unified Threat Intelligence Dashboard
                                </p>
                            </div>
                        </div>

                        {/* Center: Tab Nav */}
                        <div className="hidden lg:flex items-center gap-0 border border-gray-800 rounded-lg overflow-hidden bg-gray-900">
                            {NAV_ITEMS.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => onTabChange(item.id)}
                                    className={`px-4 py-1.5 text-[10px] uppercase tracking-wider font-semibold transition-all duration-200 cursor-pointer ${activeTab === item.id ? "tab-active" : "tab-inactive"
                                        }`}
                                    style={{ fontFamily: "JetBrains Mono, monospace" }}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>

                        {/* Right: Gauge + Clock + Status */}
                        <div className="flex items-center gap-4">
                            <div className="hidden md:flex items-center gap-4">
                                <StatusBadge label="ENGINE" />
                                <StatusBadge label="NEO4J" />
                                <StatusBadge label="FEED" />
                            </div>

                            <div className="w-px h-6 bg-gray-800 hidden md:block" />

                            <RadialProgressGauge score={riskPercent} />

                            <div className="w-px h-6 bg-gray-800" />

                            {/* Hydration-safe clock */}
                            <div className="text-right">
                                {mounted && time ? (
                                    <div className="text-right">
                                        <div
                                            className="text-xs text-gray-300 font-bold tracking-wider"
                                            style={{ fontFamily: "JetBrains Mono, monospace" }}
                                        >
                                            {mounted ? time.toLocaleTimeString("en-US", { hour12: false }) : "--:--:--"}
                                        </div>
                                        <div
                                            className="text-[10px] text-gray-500 font-semibold tracking-widest uppercase mt-0.5"
                                            style={{ fontFamily: "JetBrains Mono, monospace" }}
                                        >
                                            {mounted ? time.toLocaleDateString("en-US", {
                                                year: "numeric",
                                                month: "short",
                                                day: "numeric",
                                            }) : "--- --, ----"}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-16 h-8" /> /* Placeholder to prevent layout shift */
                                )}
                            </div>

                            {/* Threat Level Bars */}
                            <div className="flex flex-col items-center gap-0.5">
                                <div className="flex gap-0.5">
                                    {[0, 1, 2, 3, 4].map((i) => (
                                        <div
                                            key={i}
                                            className="w-1.5 rounded-full transition-all duration-300"
                                            style={{
                                                height: `${10 + i * 3}px`,
                                                backgroundColor:
                                                    i >= 4 ? "#dc2626" : i >= 3 ? "#d97706" : i >= 2 ? "#2563eb" : "#e2e6ea",
                                            }}
                                        />
                                    ))}
                                </div>
                                <span
                                    className="text-[7px] uppercase tracking-widest font-bold text-red-500"
                                    style={{ fontFamily: "JetBrains Mono, monospace" }}
                                >
                                    HIGH
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Accent line */}
                    <div
                        className="h-px w-full"
                        style={{
                            background: "linear-gradient(90deg, transparent, #2563eb40, transparent)",
                        }}
                    />
                </header>

                {/* Main Content */}
                <main className="flex-1 p-3 overflow-hidden">{children}</main>

                {/* Bottom Bar */}
                <footer className="flex-shrink-0 border-t border-gray-800 px-5 py-1.5 flex items-center justify-between bg-gray-900">
                    <div className="flex items-center gap-4">
                        <span className="text-[9px] text-gray-400" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                            v2.0.0
                        </span>
                        <span className="text-[9px] text-gray-300">|</span>
                        <span className="text-[9px] text-gray-400" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                            LIVE ENGINE • SQLite + Gemini AI
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span className="text-[9px] text-gray-400" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                            ALL SYSTEMS OPERATIONAL
                        </span>
                    </div>
                </footer>
            </div>
        </div>
    );
}

function StatusBadge({ label }: { label: string }) {
    return (
        <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span
                className="text-[9px] text-gray-400 tracking-widest"
                style={{ fontFamily: "JetBrains Mono, monospace" }}
            >
                {label}
            </span>
        </div>
    );
}
