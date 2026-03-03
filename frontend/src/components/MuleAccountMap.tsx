"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { formatINR } from "@/lib/formatINR";

const API_BASE = "http://localhost:8000";

// Tamil Nadu city coordinates (scaled to canvas)
const TN_CITY_COORDS: Record<string, { x: number; y: number }> = {
    Chennai: { x: 390, y: 115 },
    Vellore: { x: 340, y: 100 },
    Salem: { x: 285, y: 180 },
    Erode: { x: 250, y: 210 },
    Coimbatore: { x: 210, y: 245 },
    Trichy: { x: 310, y: 260 },
    Madurai: { x: 280, y: 340 },
    Tirunelveli: { x: 250, y: 430 },
};

interface MuleAccount {
    mule_account_number: string;
    mule_bank_name: string;
    mule_ifsc: string;
    receiver_name: string;
    receiver_phone: string;
    city: string;
    lat: number;
    lon: number;
    total_amount: number;
    attempt_count: number;
    attacker_name: string;
    attacker_ip: string;
    status: string;
}

export default function MuleAccountMap() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [accounts, setAccounts] = useState<MuleAccount[]>([]);
    const [hoveredAccount, setHoveredAccount] = useState<MuleAccount | null>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const animFrameRef = useRef<number>(0);
    const pulseRef = useRef(0);

    // Fetch mule accounts from backend
    useEffect(() => {
        const fetchAccounts = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/v1/sandbox/mule-accounts`);
                if (res.ok) setAccounts(await res.json());
            } catch {
                /* backend may not be running */
            }
        };
        fetchAccounts();
        const interval = setInterval(fetchAccounts, 30000);
        return () => clearInterval(interval);
    }, []);

    const maxAmount = Math.max(...accounts.map((a) => a.total_amount), 1);

    // Draw Tamil Nadu map
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        pulseRef.current += 0.03;
        const pulse = Math.sin(pulseRef.current) * 0.5 + 0.5;

        // Draw Tamil Nadu outline (simplified polygon)
        ctx.beginPath();
        ctx.moveTo(320, 30);   // Northern tip (border with AP)
        ctx.lineTo(370, 40);
        ctx.lineTo(410, 60);
        ctx.lineTo(430, 90);
        ctx.lineTo(420, 120);  // Chennai coast
        ctx.lineTo(400, 160);
        ctx.lineTo(380, 200);
        ctx.lineTo(370, 240);
        ctx.lineTo(355, 280);
        ctx.lineTo(340, 310);
        ctx.lineTo(320, 340);
        ctx.lineTo(300, 370);
        ctx.lineTo(280, 400);
        ctx.lineTo(265, 430);
        ctx.lineTo(250, 455);  // Kanyakumari
        ctx.lineTo(235, 460);
        ctx.lineTo(220, 450);
        ctx.lineTo(210, 430);
        ctx.lineTo(200, 400);
        ctx.lineTo(185, 360);
        ctx.lineTo(170, 320);
        ctx.lineTo(165, 280);  // Western ghats
        ctx.lineTo(175, 240);
        ctx.lineTo(185, 210);
        ctx.lineTo(195, 180);
        ctx.lineTo(210, 150);
        ctx.lineTo(230, 120);
        ctx.lineTo(250, 90);
        ctx.lineTo(270, 60);
        ctx.lineTo(290, 40);
        ctx.lineTo(320, 30);   // close
        ctx.closePath();

        // Fill with dark gradient
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, "rgba(30, 41, 59, 0.7)");
        grad.addColorStop(1, "rgba(15, 23, 42, 0.9)");
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = "rgba(239, 68, 68, 0.3)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Draw grid lines
        ctx.strokeStyle = "rgba(239, 68, 68, 0.04)";
        ctx.lineWidth = 0.5;
        for (let i = 0; i < w; i += 25) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, h);
            ctx.stroke();
        }
        for (let i = 0; i < h; i += 25) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(w, i);
            ctx.stroke();
        }

        // Draw "TAMIL NADU" label
        ctx.save();
        ctx.fillStyle = "rgba(239, 68, 68, 0.15)";
        ctx.font = "bold 28px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText("TAMIL NADU", w / 2, h / 2 + 10);
        ctx.restore();

        // Group accounts by city for map plotting
        const cityGroups: Record<string, MuleAccount[]> = {};
        accounts.forEach((a) => {
            if (!cityGroups[a.city]) cityGroups[a.city] = [];
            cityGroups[a.city].push(a);
        });

        // Draw connection lines between cities (mule network)
        const cityNames = Object.keys(cityGroups);
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.1 + pulse * 0.1})`;
        ctx.lineWidth = 0.8;
        ctx.setLineDash([4, 4]);
        for (let i = 0; i < cityNames.length; i++) {
            for (let j = i + 1; j < cityNames.length; j++) {
                const c1 = TN_CITY_COORDS[cityNames[i]];
                const c2 = TN_CITY_COORDS[cityNames[j]];
                if (c1 && c2) {
                    ctx.beginPath();
                    ctx.moveTo(c1.x, c1.y);
                    ctx.lineTo(c2.x, c2.y);
                    ctx.stroke();
                }
            }
        }
        ctx.setLineDash([]);

        // Draw city markers
        Object.entries(cityGroups).forEach(([city, accts]) => {
            const coords = TN_CITY_COORDS[city];
            if (!coords) return;

            const totalAmt = accts.reduce((s, a) => s + a.total_amount, 0);
            const intensity = totalAmt / maxAmount;
            const baseRadius = 8 + intensity * 12;
            const animRadius = baseRadius + pulse * 4 * intensity;

            // Outer glow ring
            const glowGrad = ctx.createRadialGradient(
                coords.x, coords.y, 0,
                coords.x, coords.y, animRadius * 3
            );
            glowGrad.addColorStop(0, `rgba(239, 68, 68, ${0.35 * intensity})`);
            glowGrad.addColorStop(0.5, `rgba(245, 158, 11, ${0.15 * intensity})`);
            glowGrad.addColorStop(1, "rgba(239, 68, 68, 0)");
            ctx.beginPath();
            ctx.arc(coords.x, coords.y, animRadius * 3, 0, Math.PI * 2);
            ctx.fillStyle = glowGrad;
            ctx.fill();

            // Pulsing ring
            ctx.beginPath();
            ctx.arc(coords.x, coords.y, animRadius * 1.8, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(239, 68, 68, ${0.2 + pulse * 0.15})`;
            ctx.lineWidth = 1;
            ctx.stroke();

            // Main dot
            ctx.beginPath();
            ctx.arc(coords.x, coords.y, baseRadius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(239, 68, 68, ${0.6 + pulse * 0.3})`;
            ctx.fill();

            // Outer ring
            ctx.beginPath();
            ctx.arc(coords.x, coords.y, baseRadius + 2, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(245, 158, 11, ${0.5 + pulse * 0.3})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Inner bright core
            ctx.beginPath();
            ctx.arc(coords.x, coords.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = "#fff";
            ctx.fill();

            // City label
            ctx.fillStyle = "rgba(209, 213, 219, 0.9)";
            ctx.font = "bold 10px 'JetBrains Mono', monospace";
            ctx.textAlign = "center";
            ctx.fillText(city.toUpperCase(), coords.x, coords.y - baseRadius - 10);

            // Account count
            ctx.fillStyle = "#ef4444";
            ctx.font = "bold 9px 'JetBrains Mono', monospace";
            ctx.fillText(`${accts.length} acct${accts.length > 1 ? "s" : ""}`, coords.x, coords.y - baseRadius - 1);

            // Amount
            ctx.fillStyle = "#f59e0b";
            ctx.font = "9px 'JetBrains Mono', monospace";
            const shortAmt = totalAmt >= 100000 ? `₹${(totalAmt / 100000).toFixed(1)}L` : `₹${(totalAmt / 1000).toFixed(0)}K`;
            ctx.fillText(shortAmt, coords.x, coords.y + baseRadius + 14);
        });

        animFrameRef.current = requestAnimationFrame(draw);
    }, [accounts, maxAmount]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = 500;
        canvas.height = 500;
        animFrameRef.current = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(animFrameRef.current);
    }, [draw]);

    // Handle mouse hover for tooltip
    const handleMouseMove = useCallback(
        (e: React.MouseEvent<HTMLCanvasElement>) => {
            const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
            const scaleX = 500 / rect.width;
            const scaleY = 500 / rect.height;
            const mx = (e.clientX - rect.left) * scaleX;
            const my = (e.clientY - rect.top) * scaleY;
            setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });

            let found: MuleAccount | null = null;
            for (const acct of accounts) {
                const coords = TN_CITY_COORDS[acct.city];
                if (!coords) continue;
                const dx = mx - coords.x;
                const dy = my - coords.y;
                if (dx * dx + dy * dy < 600) {
                    found = acct;
                    break;
                }
            }
            setHoveredAccount(found);
        },
        [accounts]
    );

    return (
        <div className="h-full grid grid-cols-12 gap-3">
            {/* Left: Map */}
            <div className="col-span-5 bg-gray-900/70 backdrop-blur-sm border border-gray-800 rounded-xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-4 py-2.5 border-b border-gray-800 flex items-center gap-2">
                    <div
                        className="w-2 h-2 rounded-full bg-red-500"
                        style={{ animation: "status-blink 2s infinite" }}
                    />
                    <h3
                        className="text-xs font-bold tracking-widest uppercase text-red-400"
                        style={{ fontFamily: "JetBrains Mono, monospace" }}
                    >
                        Tamil Nadu — Mule Network
                    </h3>
                    <span
                        className="ml-auto text-[10px] px-2 py-0.5 rounded-full border border-red-700/50 bg-red-900/30 text-red-400"
                        style={{ fontFamily: "JetBrains Mono, monospace" }}
                    >
                        {accounts.length} mule accts
                    </span>
                </div>

                {/* Map Canvas */}
                <div className="flex-1 relative flex items-center justify-center p-2 min-h-0">
                    <canvas
                        ref={canvasRef}
                        className="max-w-full max-h-full cursor-crosshair"
                        style={{ imageRendering: "auto" }}
                        onMouseMove={handleMouseMove}
                        onMouseLeave={() => setHoveredAccount(null)}
                    />

                    {/* Tooltip */}
                    {hoveredAccount && (
                        <div
                            className="absolute pointer-events-none z-50 bg-gray-900/95 border border-red-700/50 rounded-lg px-3 py-2 shadow-xl backdrop-blur-sm"
                            style={{
                                left: Math.min(mousePos.x + 15, 220),
                                top: mousePos.y - 10,
                                fontFamily: "JetBrains Mono, monospace",
                            }}
                        >
                            <div className="text-[10px] font-bold text-red-400 uppercase tracking-wider">
                                {hoveredAccount.city} — Mule Account
                            </div>
                            <div className="text-[10px] text-gray-300 mt-1 space-y-0.5">
                                <div>
                                    Acct: <span className="text-amber-400 font-bold">{hoveredAccount.mule_account_number}</span>
                                </div>
                                <div>
                                    Receiver: <span className="text-gray-200">{hoveredAccount.receiver_name}</span>
                                </div>
                                <div>
                                    Bank: <span className="text-gray-200">{hoveredAccount.mule_bank_name}</span>
                                </div>
                                <div>
                                    Amount: <span className="text-red-400 font-bold">{formatINR(hoveredAccount.total_amount)}</span>
                                </div>
                                <div>
                                    Attacker: <span className="text-purple-400">{hoveredAccount.attacker_name}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Legend */}
                <div className="px-4 py-2 border-t border-gray-800 flex items-center gap-4">
                    <LegendDot color="#ef4444" label="HIGH VALUE" />
                    <LegendDot color="#f59e0b" label="MEDIUM" />
                    <LegendDot color="#3b82f6" label="TRACED" />
                </div>
            </div>

            {/* Right: Mule Accounts Table */}
            <div className="col-span-7 bg-gray-900/70 backdrop-blur-sm border border-gray-800 rounded-xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-4 py-2.5 border-b border-gray-800 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500" style={{ animation: "status-blink 2s infinite" }} />
                    <h3
                        className="text-xs font-bold tracking-widest uppercase text-amber-400"
                        style={{ fontFamily: "JetBrains Mono, monospace" }}
                    >
                        Intercepted Mule Accounts
                    </h3>
                    <span
                        className="ml-auto text-[10px] px-2 py-0.5 rounded-full border border-amber-700/50 bg-amber-900/30 text-amber-400"
                        style={{ fontFamily: "JetBrains Mono, monospace" }}
                    >
                        {accounts.length} flagged
                    </span>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-[10px]" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                        <thead className="sticky top-0 bg-gray-900/95 z-10">
                            <tr className="text-gray-500 uppercase tracking-wider border-b border-gray-800">
                                <th className="text-left py-2 px-3">Account #</th>
                                <th className="text-left py-2 px-3">Bank</th>
                                <th className="text-left py-2 px-3">IFSC</th>
                                <th className="text-left py-2 px-3">Receiver</th>
                                <th className="text-left py-2 px-3">Phone</th>
                                <th className="text-left py-2 px-3">City</th>
                                <th className="text-right py-2 px-3">Amount</th>
                                <th className="text-center py-2 px-3">Attempts</th>
                                <th className="text-left py-2 px-3">Attacker</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/50">
                            {accounts.map((acct, idx) => (
                                <tr
                                    key={acct.mule_account_number}
                                    className="text-gray-300 hover:bg-red-900/10 transition-colors"
                                    style={{ animation: `slide-in-up 0.3s ease-out ${idx * 0.04}s both` }}
                                >
                                    <td className="py-2 px-3">
                                        <span className="text-amber-400 font-bold">{acct.mule_account_number}</span>
                                    </td>
                                    <td className="py-2 px-3 text-gray-300">{acct.mule_bank_name}</td>
                                    <td className="py-2 px-3 text-gray-400">{acct.mule_ifsc}</td>
                                    <td className="py-2 px-3 text-gray-200">{acct.receiver_name}</td>
                                    <td className="py-2 px-3 text-gray-400">{acct.receiver_phone}</td>
                                    <td className="py-2 px-3">
                                        <span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-300">{acct.city}</span>
                                    </td>
                                    <td className="py-2 px-3 text-right">
                                        <span className="text-red-400 font-bold">{formatINR(acct.total_amount)}</span>
                                    </td>
                                    <td className="py-2 px-3 text-center">
                                        <span className="px-1.5 py-0.5 rounded-full bg-red-900/30 text-red-400 border border-red-700/30 font-bold">
                                            {acct.attempt_count}
                                        </span>
                                    </td>
                                    <td className="py-2 px-3">
                                        <div className="text-purple-400">{acct.attacker_name}</div>
                                        <div className="text-gray-500 text-[9px]">{acct.attacker_ip}</div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {accounts.length === 0 && (
                        <div className="p-8 text-center text-gray-400 text-sm">
                            <p className="font-medium">No mule accounts intercepted</p>
                            <p className="text-xs mt-1">Ensure the backend is running and database is seeded</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-2 border-t border-gray-800 flex items-center justify-between">
                    <span className="text-[9px] text-gray-400" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                        DATA SOURCE: MIRROR SANDBOX INTERCEPTS
                    </span>
                    <span className="text-[9px] text-red-400" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                        {formatINR(accounts.reduce((s, a) => s + a.total_amount, 0))} TOTAL INTERCEPTED
                    </span>
                </div>
            </div>
        </div>
    );
}

function LegendDot({ color, label }: { color: string; label: string }) {
    return (
        <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span
                className="text-[8px] text-gray-400 uppercase tracking-widest"
                style={{ fontFamily: "JetBrains Mono, monospace" }}
            >
                {label}
            </span>
        </div>
    );
}
