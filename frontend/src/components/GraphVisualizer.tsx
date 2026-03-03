"use client";

import { useEffect, useRef, useState } from "react";
import cytoscape from "cytoscape";

interface GraphVisualizerProps {
    selectedThreat: any | null;
}

export default function GraphVisualizer({ selectedThreat }: GraphVisualizerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const cyRef = useRef<cytoscape.Core | null>(null);
    const [dataStats, setDataStats] = useState<{ nodes: number; edges: number } | null>(null);
    const [layout, setLayout] = useState("cose");

    useEffect(() => {
        let active = true;

        async function fetchAndRender() {
            try {
                const res = await fetch("http://localhost:8000/api/v1/graph-data");
                if (!res.ok) throw new Error("Failed to fetch graph data");
                const data = await res.json();

                if (!active || !containerRef.current) return;

                setDataStats({ nodes: data.nodes.length, edges: data.edges.length });

                // Initialize Cytoscape
                const cy = cytoscape({
                    container: containerRef.current,
                    elements: data,
                    style: [
                        {
                            selector: "node",
                            style: {
                                label: "data(label)",
                                color: "#9ca3af", // gray-400
                                "font-size": "10px",
                                "font-family": "monospace",
                                "text-valign": "bottom",
                                "text-margin-y": 5,
                                "text-halign": "center",
                                "text-wrap": "ellipsis",
                                "text-max-width": "80px",
                                "background-color": "#4b5563", // default gray
                                width: 24,
                                height: 24,
                                "transition-property": "opacity, background-color, border-width",
                                "transition-duration": 200,
                                // The prompt requires: Red (cyber exploits), Yellow (financial transactions), Orange (confirmed mule nodes - handled dynamically)
                            },
                        },
                        {
                            selector: "node[type = 'CyberAlert']",
                            style: {
                                "background-color": "#f87171", // red-400
                                shape: "star",
                                width: 32,
                                height: 32,
                            },
                        },
                        {
                            selector: "node[type = 'Transaction']",
                            style: {
                                "background-color": "#facc15", // yellow-400
                                shape: "diamond",
                                width: 28,
                                height: 28,
                            },
                        },
                        {
                            selector: "node[type = 'UserAccount']",
                            style: {
                                "background-color": "#2dd4bf", // teal-400 (default, orange if mule)
                                shape: "ellipse",
                                width: 30,
                                height: 30,
                            },
                        },
                        {
                            selector: "node[type = 'IPAddress']",
                            style: {
                                "background-color": "#ec4899", // pink-500
                                shape: "hexagon",
                            },
                        },
                        {
                            selector: "node[type = 'DeviceFingerprint']",
                            style: {
                                "background-color": "#a855f7", // purple-500
                                shape: "round-rectangle",
                            },
                        },
                        {
                            selector: "edge",
                            style: {
                                width: 1.5,
                                "line-color": "#374151", // gray-700
                                "target-arrow-color": "#4b5563",
                                "target-arrow-shape": "triangle-backcurve",
                                "curve-style": "bezier",
                                "arrow-scale": 0.8,
                                "transition-property": "line-color, opacity, width",
                                "transition-duration": 200,
                            },
                        },
                        // Interactive States
                        {
                            selector: "node.highlight",
                            style: {
                                "border-width": 3,
                                "border-color": "#cbd5e1", // slate-300
                                opacity: 1,
                            },
                        },
                        {
                            selector: "node.dim",
                            style: {
                                opacity: 0.15,
                            },
                        },
                        {
                            selector: "edge.highlight",
                            style: {
                                width: 2.5,
                                "line-color": "#94a3b8", // slate-400
                                "target-arrow-color": "#94a3b8",
                                opacity: 1,
                                "z-index": 10
                            },
                        },
                        {
                            selector: "edge.dim",
                            style: {
                                opacity: 0.1,
                            },
                        },
                        // Mule confirmation highlights
                        {
                            selector: "node.mule",
                            style: {
                                "background-color": "#fb923c", // orange-400
                                "border-width": 4,
                                "border-color": "#ea580c", // orange-600
                                width: 40,
                                height: 40,
                            }
                        }
                    ],
                    layout: {
                        name: layout,
                        animate: true,
                        numIter: 1000,
                        padding: 30,
                    } as any, // Bypass strict TS layout types for dynamic cose
                    userZoomingEnabled: true,
                    userPanningEnabled: true,
                    boxSelectionEnabled: false,
                    minZoom: 0.2,
                    maxZoom: 3,
                });

                cyRef.current = cy;

                // Interactive Click Logic: Focus neighborhood
                cy.on("tap", "node", (evt) => {
                    const node = evt.target;

                    cy.elements().removeClass("highlight dim");

                    // Add highlight to clicked node, its neighborhood (both directions) and connecting edges
                    const neighborhood = node.neighborhood();

                    cy.elements().addClass("dim");
                    node.removeClass("dim").addClass("highlight");
                    neighborhood.removeClass("dim").addClass("highlight");

                    // Optionally fit to the neighborhood
                    // cy.animate({ fit: { eles: neighborhood.union(node), padding: 50 }, duration: 500 });
                });

                // Click on background resets
                cy.on("tap", (evt) => {
                    if (evt.target === cy) {
                        cy.elements().removeClass("highlight dim");
                    }
                });

            } catch (err) {
                console.error("Graph init error", err);
            }
        }

        fetchAndRender();

        return () => {
            active = false;
            if (cyRef.current) {
                cyRef.current.destroy();
                cyRef.current = null;
            }
        };
    }, [layout]); // re-run if layout engine changes

    // Externally driven highlights (from ThreatTable selection)
    useEffect(() => {
        if (!cyRef.current) return;
        const cy = cyRef.current;

        cy.elements().removeClass("highlight dim mule");

        if (selectedThreat) {
            // Find nodes associated with the threat.
            // E.g., if it's a manual entry, finding the node by ID
            // If it's an auto-threat, we have threat_data.breach_details.account_id and threat_data.transaction_details.tx_id
            const t = selectedThreat;
            const tdata = t.threat_data;

            const idsToFind = new Set<string>();

            // Extract IDs based on whether it's an automated fusion threat or manual entry
            if (tdata.breach_details) {
                idsToFind.add(tdata.breach_details.alert_id);
                idsToFind.add(tdata.breach_details.account_id);
                if (tdata.breach_details.ip_address) idsToFind.add(tdata.breach_details.ip_address);
            }
            if (tdata.transaction_details) {
                idsToFind.add(tdata.transaction_details.tx_id);
                idsToFind.add(tdata.transaction_details.sender_id);
            }
            if (tdata.indicator_value) {
                // Manual indicator
                idsToFind.add(tdata.indicator_value);
            }

            const foundNodes = cy.nodes().filter((node) => {
                const id = String(node.data("id"));
                return idsToFind.has(id);
            });

            if (foundNodes.length > 0) {
                cy.elements().addClass("dim");

                foundNodes.removeClass("dim").addClass("highlight");

                // If status is "Confirmed Mule Ring", mark accounts as Orange (Mule)
                if (t.status === "Confirmed Mule Ring") {
                    foundNodes.filter("[type = 'UserAccount']").addClass("mule");
                }

                foundNodes.neighborhood().removeClass("dim").addClass("highlight");
                cy.animate({ fit: { eles: foundNodes.union(foundNodes.neighborhood()), padding: 75 }, duration: 700 });
            }
        }
    }, [selectedThreat]);

    return (
        <div className="flex flex-col h-full bg-[#0d1321] relative">
            {/* Header overlay */}
            <div className="absolute top-0 left-0 right-0 p-3 flex justify-between items-center z-10 pointer-events-none">
                <div className="flex items-center gap-2 bg-[#111827]/80 px-3 py-1.5 rounded backdrop-blur border border-[#1e2d42] pointer-events-auto">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    <h2 className="text-sm font-semibold tracking-wider uppercase text-blue-400 font-mono">
                        Threat Topology
                    </h2>
                    {dataStats && (
                        <span className="ml-2 text-[10px] text-gray-500 font-mono px-2 py-0.5 bg-[#1a2332] rounded border border-[#2a3f5f]">
                            {dataStats.nodes}N / {dataStats.edges}E
                        </span>
                    )}
                </div>

                <div className="flex gap-1 pointer-events-auto">
                    {["cose", "circle", "grid", "breadthfirst"].map((l) => (
                        <button
                            key={l}
                            onClick={() => setLayout(l)}
                            className={`px-3 py-1 text-[10px] uppercase font-mono rounded border transition-colors ${layout === l
                                ? "bg-blue-900/40 text-blue-400 border-blue-500/50"
                                : "bg-[#111827]/80 text-gray-500 border-[#1e2d42] hover:text-gray-300"
                                }`}
                        >
                            {l}
                        </button>
                    ))}
                </div>
            </div>

            {/* Legend */}
            <div className="absolute top-14 left-3 z-10 pointer-events-none flex gap-3 text-[10px] font-mono whitespace-nowrap overflow-x-auto hide-scrollbar">
                <LegendItem color="bg-red-400" label="Cyber Exploit" />
                <LegendItem color="bg-yellow-400" label="Financial Tx" />
                <LegendItem color="bg-orange-400" border="border border-orange-600" label="Confirmed Mule" />
                <LegendItem color="bg-teal-400" label="User Account" />
                <LegendItem color="bg-pink-500" label="IP Address" />
            </div>

            {/* Cytoscape Container */}
            <div ref={containerRef} className="w-full flex-1" style={{ minHeight: "300px" }} />
        </div>
    );
}

function LegendItem({ color, border, label }: { color: string; border?: string; label: string }) {
    return (
        <div className="flex items-center gap-1.5 bg-[#111827]/80 px-2 py-1 rounded backdrop-blur border border-[#1e2d42] pointer-events-auto">
            <div className={`w-2.5 h-2.5 rounded-full ${color} ${border || ""}`} />
            <span className="text-gray-400">{label}</span>
        </div>
    );
}
