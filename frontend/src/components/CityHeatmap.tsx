"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { formatINR } from "@/lib/formatINR";

const API_BASE = "http://localhost:8000";

// Indian city coordinates (approximate, for map plotting)
const CITY_COORDS: Record<string, { x: number; y: number }> = {
    Mumbai: { x: 175, y: 330 },
    Delhi: { x: 215, y: 145 },
    Chennai: { x: 245, y: 420 },
    Bangalore: { x: 215, y: 405 },
    Kolkata: { x: 335, y: 260 },
    Hyderabad: { x: 235, y: 365 },
    Pune: { x: 195, y: 340 },
    Ahmedabad: { x: 165, y: 250 },
    Jaipur: { x: 200, y: 190 },
    Lucknow: { x: 265, y: 185 },
    Chandigarh: { x: 215, y: 130 },
    Surat: { x: 170, y: 280 },
    Kochi: { x: 215, y: 445 },
    Indore: { x: 210, y: 260 },
    Nagpur: { x: 240, y: 295 },
    Patna: { x: 310, y: 205 },
    Bhopal: { x: 225, y: 265 },
    Visakhapatnam: { x: 285, y: 355 },
    Coimbatore: { x: 225, y: 435 },
    Guwahati: { x: 385, y: 185 },
};

interface CityStats {
    city: string;
    threat_count: number;
    cyber_log_count: number;
    total_flagged_amount: number;
}

export default function CityHeatmap() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [cities, setCities] = useState<CityStats[]>([]);
    const [hoveredCity, setHoveredCity] = useState<CityStats | null>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const animFrameRef = useRef<number>(0);
    const pulseRef = useRef(0);

    // Fetch city stats from real backend
    useEffect(() => {
        const fetchCities = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/v1/city-stats`);
                if (res.ok) setCities(await res.json());
            } catch {
                /* backend may not be running */
            }
        };
        fetchCities();
        const interval = setInterval(fetchCities, 30000);
        return () => clearInterval(interval);
    }, []);

    const maxThreats = Math.max(...cities.map((c) => c.threat_count), 1);

    // Draw the map
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

        // Draw India outline (simplified polygon)
        ctx.beginPath();
        ctx.moveTo(215, 65);  // Kashmir
        ctx.lineTo(250, 90);
        ctx.lineTo(270, 110);
        ctx.lineTo(270, 140);
        ctx.lineTo(310, 165);
        ctx.lineTo(340, 175);
        ctx.lineTo(380, 175);
        ctx.lineTo(400, 195);
        ctx.lineTo(365, 225);
        ctx.lineTo(345, 260);
        ctx.lineTo(335, 310);
        ctx.lineTo(305, 360);
        ctx.lineTo(280, 380);
        ctx.lineTo(260, 415);
        ctx.lineTo(250, 450);
        ctx.lineTo(240, 465);
        ctx.lineTo(225, 460);
        ctx.lineTo(215, 445);
        ctx.lineTo(198, 425);
        ctx.lineTo(190, 395);
        ctx.lineTo(175, 365);
        ctx.lineTo(160, 335);
        ctx.lineTo(150, 300);
        ctx.lineTo(140, 260);
        ctx.lineTo(150, 230);
        ctx.lineTo(165, 195);
        ctx.lineTo(175, 155);
        ctx.lineTo(190, 120);
        ctx.lineTo(200, 90);
        ctx.lineTo(215, 65);
        ctx.closePath();

        // Fill with dark gradient
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, "rgba(30, 41, 59, 0.6)");
        grad.addColorStop(1, "rgba(15, 23, 42, 0.8)");
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = "rgba(59, 130, 246, 0.3)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Draw grid lines
        ctx.strokeStyle = "rgba(59, 130, 246, 0.05)";
        ctx.lineWidth = 0.5;
        for (let i = 0; i < w; i += 30) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, h);
            ctx.stroke();
        }
        for (let i = 0; i < h; i += 30) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(w, i);
            ctx.stroke();
        }

        // Draw city markers
        cities.forEach((city) => {
            const coords = CITY_COORDS[city.city];
            if (!coords) return;

            const intensity = city.threat_count / maxThreats;
            const baseRadius = 6 + intensity * 14;
            const animRadius = baseRadius + pulse * 4 * intensity;

            // Outer glow
            const glowGrad = ctx.createRadialGradient(
                coords.x, coords.y, 0,
                coords.x, coords.y, animRadius * 3
            );
            if (intensity > 0.7) {
                glowGrad.addColorStop(0, `rgba(239, 68, 68, ${0.3 * intensity})`);
                glowGrad.addColorStop(1, "rgba(239, 68, 68, 0)");
            } else if (intensity > 0.4) {
                glowGrad.addColorStop(0, `rgba(245, 158, 11, ${0.3 * intensity})`);
                glowGrad.addColorStop(1, "rgba(245, 158, 11, 0)");
            } else {
                glowGrad.addColorStop(0, `rgba(59, 130, 246, ${0.25 * intensity})`);
                glowGrad.addColorStop(1, "rgba(59, 130, 246, 0)");
            }
            ctx.beginPath();
            ctx.arc(coords.x, coords.y, animRadius * 3, 0, Math.PI * 2);
            ctx.fillStyle = glowGrad;
            ctx.fill();

            // Main dot
            ctx.beginPath();
            ctx.arc(coords.x, coords.y, baseRadius, 0, Math.PI * 2);
            if (intensity > 0.7) {
                ctx.fillStyle = `rgba(239, 68, 68, ${0.6 + pulse * 0.3})`;
            } else if (intensity > 0.4) {
                ctx.fillStyle = `rgba(245, 158, 11, ${0.6 + pulse * 0.2})`;
            } else {
                ctx.fillStyle = `rgba(59, 130, 246, ${0.5 + pulse * 0.2})`;
            }
            ctx.fill();

            // Inner bright core
            ctx.beginPath();
            ctx.arc(coords.x, coords.y, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = "#fff";
            ctx.fill();

            // City label
            ctx.fillStyle = "rgba(209, 213, 219, 0.85)";
            ctx.font = "9px 'JetBrains Mono', monospace";
            ctx.textAlign = "center";
            ctx.fillText(city.city.toUpperCase(), coords.x, coords.y - baseRadius - 6);

            // Threat count
            ctx.fillStyle = intensity > 0.7 ? "#ef4444" : intensity > 0.4 ? "#f59e0b" : "#60a5fa";
            ctx.font = "bold 10px 'JetBrains Mono', monospace";
            ctx.fillText(`${city.threat_count}`, coords.x, coords.y + baseRadius + 12);
        });

        animFrameRef.current = requestAnimationFrame(draw);
    }, [cities, maxThreats]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = 500;
        canvas.height = 520;
        animFrameRef.current = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(animFrameRef.current);
    }, [draw]);

    // Handle mouse hover for tooltip
    const handleMouseMove = useCallback(
        (e: React.MouseEvent<HTMLCanvasElement>) => {
            const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
            const scaleX = 500 / rect.width;
            const scaleY = 520 / rect.height;
            const mx = (e.clientX - rect.left) * scaleX;
            const my = (e.clientY - rect.top) * scaleY;
            setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });

            let found: CityStats | null = null;
            for (const city of cities) {
                const coords = CITY_COORDS[city.city];
                if (!coords) continue;
                const dx = mx - coords.x;
                const dy = my - coords.y;
                if (dx * dx + dy * dy < 400) {
                    found = city;
                    break;
                }
            }
            setHoveredCity(found);
        },
        [cities]
    );

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="px-4 py-2.5 border-b border-gray-800 flex items-center gap-2">
                <div
                    className="w-2 h-2 rounded-full bg-blue-500"
                    style={{ animation: "status-blink 2s infinite" }}
                />
                <h3
                    className="text-xs font-bold tracking-widest uppercase text-blue-400"
                    style={{ fontFamily: "JetBrains Mono, monospace" }}
                >
                    India Threat Heatmap
                </h3>
                <span
                    className="ml-auto text-[10px] px-2 py-0.5 rounded-full border border-blue-700/50 bg-blue-900/30 text-blue-400"
                    style={{ fontFamily: "JetBrains Mono, monospace" }}
                >
                    {cities.length} cities
                </span>
            </div>

            {/* Map Canvas */}
            <div className="flex-1 relative flex items-center justify-center p-2 min-h-0">
                <canvas
                    ref={canvasRef}
                    className="max-w-full max-h-full cursor-crosshair"
                    style={{ imageRendering: "auto" }}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={() => setHoveredCity(null)}
                />

                {/* Tooltip */}
                {hoveredCity && (
                    <div
                        className="absolute pointer-events-none z-50 bg-gray-900/95 border border-gray-700 rounded-lg px-3 py-2 shadow-xl backdrop-blur-sm"
                        style={{
                            left: mousePos.x + 15,
                            top: mousePos.y - 10,
                            fontFamily: "JetBrains Mono, monospace",
                        }}
                    >
                        <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">
                            {hoveredCity.city}
                        </div>
                        <div className="text-[10px] text-gray-300 mt-1 space-y-0.5">
                            <div>
                                Threats:{" "}
                                <span className="text-red-400 font-bold">
                                    {hoveredCity.threat_count}
                                </span>
                            </div>
                            <div>
                                Cyber Logs:{" "}
                                <span className="text-amber-400 font-bold">
                                    {hoveredCity.cyber_log_count}
                                </span>
                            </div>
                            <div>
                                Flagged:{" "}
                                <span className="text-emerald-400 font-bold">
                                    {formatINR(hoveredCity.total_flagged_amount)}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Legend */}
            <div className="px-4 py-2 border-t border-gray-800 flex items-center gap-4">
                <LegendDot color="#ef4444" label="CRITICAL" />
                <LegendDot color="#f59e0b" label="HIGH" />
                <LegendDot color="#3b82f6" label="MODERATE" />
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
