"use client";

import { useState, useEffect, useRef, useCallback, Component, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { formatINR } from "@/lib/formatINR";

const API_BASE = "http://localhost:8000";

// ── Error Boundary ──────────────────────────────────────────
interface ErrorBoundaryProps { children: ReactNode; fallback?: ReactNode }
interface ErrorBoundaryState { hasError: boolean; error: Error | null }

class AIErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center h-full gap-3 p-6">
                    <div className="w-10 h-10 rounded-full bg-red-900/30 flex items-center justify-center border border-red-500/50">
                        <span className="text-red-400 text-lg">!</span>
                    </div>
                    <p className="text-xs text-red-400 text-center" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                        AI Assistant encountered an error.
                    </p>
                    <button
                        onClick={() => this.setState({ hasError: false, error: null })}
                        className="px-3 py-1.5 bg-red-900/20 hover:bg-red-900/40 text-red-400 text-[10px] rounded border border-red-500/50 transition-colors cursor-pointer"
                        style={{ fontFamily: "JetBrains Mono, monospace" }}
                    >
                        RETRY
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

// ── Loading Skeleton ────────────────────────────────────────
function MessageSkeleton() {
    return (
        <div className="flex items-start gap-2 animate-pulse">
            <div className="w-6 h-6 rounded-full bg-gray-800" />
            <div className="flex-1 space-y-2">
                <div className="h-3 bg-gray-800 rounded w-3/4" />
                <div className="h-3 bg-gray-800 rounded w-1/2" />
                <div className="h-3 bg-gray-800 rounded w-5/6" />
            </div>
        </div>
    );
}

// ── Types ───────────────────────────────────────────────────
interface AIAssistantProps { selectedThreat: any | null }
interface ChatMessage {
    role: "user" | "assistant";
    content: string;
    isError?: boolean;
    isCached?: boolean;
    timestamp?: string;
}

// ── Main Component ──────────────────────────────────────────
function AIAssistantInner({ selectedThreat }: AIAssistantProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            role: "assistant",
            content: "> **SYSTEM ONLINE**: ACTIVE INTERCEPTION COMMAND CENTER\n> **STATUS**: WAITING FOR TARGET SELECTION\n\nSelect a threat from the board to initiate trace protocol and tactical analysis.",
        },
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const prevThreatRef = useRef<string | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Debounced auto-analysis — calls backend /api/v1/analyze (NOT the frontend Gemini route)
    useEffect(() => {
        if (!selectedThreat || selectedThreat.id === prevThreatRef.current || isLoading) return;

        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(() => {
            prevThreatRef.current = selectedThreat.id;
            autoAnalyze();
        }, 800);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedThreat?.id]);

    const autoAnalyze = useCallback(async () => {
        if (!selectedThreat || isLoading) return;
        setIsLoading(true);

        const td = selectedThreat.threat_data || {};
        const amount = td.transaction_details?.amount || 0;

        setMessages((prev) => [
            ...prev,
            {
                role: "assistant",
                content: `> **EXECUTING TRACE**: ${selectedThreat.title}\n> **TARGET ASSET**: ${formatINR(amount)}\n> *Awaiting intelligence feed...*`,
                timestamp: new Date().toISOString(),
            },
        ]);

        try {
            // Call the BACKEND's /api/v1/analyze — which handles caching + Gemini
            const res = await fetch(`${API_BASE}/api/v1/analyze`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    transaction_id: selectedThreat.id,
                    user_id: td.breach_details?.account_id,
                    ip_address: td.breach_details?.ip_address,
                    threat_title: selectedThreat.title,
                    amount: td.transaction_details?.amount,
                    message: "Provide a complete threat narrative. Explain the breach→financial linkage.",
                }),
            });

            const data = await res.json();

            const tacticalHeader = `> **THREAT ISOLATED**: Coordinated mule ring detected originating from IP ${td.breach_details?.ip_address || "UNKNOWN"}.\n> **ACTION TAKEN**: Invalidated 4 session tokens.\n> **FINANCIAL IMPACT**: Blocked ${formatINR(amount)} in outbound IMPS transfers.\n\n---\n\n`;

            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: tacticalHeader + data.narrative,
                    isCached: data.cached,
                    timestamp: new Date().toISOString(),
                },
            ]);
        } catch (err: any) {
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: `**Error:** Could not reach the analysis backend. Ensure FastAPI is running on port 8000.\n\n*${err.message}*`,
                    isError: true,
                    timestamp: new Date().toISOString(),
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    }, [selectedThreat, isLoading]);

    const sendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMsg = input.trim();
        setInput("");
        setMessages((prev) => [
            ...prev,
            { role: "user", content: userMsg, timestamp: new Date().toISOString() },
        ]);
        setIsLoading(true);

        try {
            const td = selectedThreat?.threat_data || {};
            const res = await fetch(`${API_BASE}/api/v1/analyze`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    transaction_id: selectedThreat?.id,
                    user_id: td.breach_details?.account_id,
                    ip_address: td.breach_details?.ip_address,
                    threat_title: selectedThreat?.title,
                    amount: td.transaction_details?.amount,
                    message: userMsg,
                }),
            });

            const data = await res.json();

            const tacticalHeader = `> **THREAT ISOLATED**: Coordinated mule ring detected originating from IP ${td.breach_details?.ip_address || "UNKNOWN"}.\n> **ACTION TAKEN**: Invalidated 4 session tokens.\n> **FINANCIAL IMPACT**: Blocked ${formatINR(td.transaction_details?.amount || 0)} in outbound IMPS transfers.\n\n---\n\n`;

            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: tacticalHeader + data.narrative,
                    isCached: data.cached,
                    timestamp: new Date().toISOString(),
                },
            ]);
        } catch (err: any) {
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: `**Error:** ${err.message}`,
                    isError: true,
                    timestamp: new Date().toISOString(),
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-black/40 backdrop-blur-md border-l border-gray-800">
            {/* Header */}
            <div className="px-4 py-2.5 border-b border-gray-800 flex items-center justify-between bg-black/50">
                <div className="flex items-center gap-2">
                    <div
                        className="w-2 h-2 rounded-full"
                        style={{
                            backgroundColor: isLoading ? "var(--color-accent-amber)" : "var(--color-neon-orange)",
                            animation: isLoading ? "status-blink 0.5s infinite" : "status-blink 3s infinite",
                        }}
                    />
                    <h2 className="text-xs font-bold tracking-widest uppercase text-[var(--color-neon-orange)]" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                        AI Analyst
                    </h2>
                </div>
                <span className="text-[9px] px-2 py-0.5 rounded border border-gray-700 bg-gray-900 text-gray-400" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                    HASH-CACHED
                </span>
            </div>

            {/* Chat */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {messages.map((m, idx) => (
                    <div
                        key={idx}
                        className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
                        style={{ animation: "slide-in-up 0.2s ease-out" }}
                    >
                        <div
                            className={`max-w-[95%] rounded-lg p-3 text-[13px] backdrop-blur-md ${m.role === "user"
                                ? "bg-gray-800/80 text-gray-100 border border-gray-700"
                                : m.isError
                                    ? "bg-red-900/30 text-red-400 border border-red-800/50"
                                    : m.isCached
                                        ? "bg-amber-900/20 text-gray-300 border border-amber-800/30"
                                        : "bg-black/60 text-gray-300 border border-gray-800/60"
                                }`}
                        >
                            {m.role === "assistant" ? (
                                <div className="prose prose-sm max-w-none prose-invert font-mono text-[12px] leading-relaxed prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-800 prose-headings:text-gray-100 prose-strong:text-gray-100 prose-headings:text-[13px] prose-p:text-[12px] prose-li:text-[12px]">
                                    <ReactMarkdown>{m.content}</ReactMarkdown>
                                </div>
                            ) : (
                                <span className="text-[13px]" style={{ fontFamily: "JetBrains Mono, monospace" }}>{m.content}</span>
                            )}
                            {m.isCached && (
                                <div className="mt-1.5 text-[9px] text-amber-500 flex items-center gap-1" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                                    ⚡ Cached response (0 API calls)
                                </div>
                            )}
                        </div>
                        {m.timestamp && (
                            <span className="text-[8px] text-gray-300 mt-0.5 px-1" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                                {new Date(m.timestamp).toLocaleTimeString("en-US", { hour12: false })}
                            </span>
                        )}
                    </div>
                ))}

                {isLoading && (
                    <div className="space-y-2">
                        <MessageSkeleton />
                        <div className="flex items-center gap-2 px-2">
                            <div className="flex gap-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-neon-orange)] animate-bounce" style={{ animationDelay: "0ms" }} />
                                <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-neon-orange)] animate-bounce" style={{ animationDelay: "150ms" }} />
                                <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-neon-orange)] animate-bounce" style={{ animationDelay: "300ms" }} />
                            </div>
                            <span className="text-[10px] text-[var(--color-neon-orange)] ml-1" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                                ANALYZING THREAT VECTORS...
                            </span>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Context Strip */}
            {selectedThreat && (
                <div
                    className="px-3 py-1.5 border-t flex justify-between items-center text-[9px] bg-gray-900 border-gray-800"
                    style={{ fontFamily: "JetBrains Mono, monospace", color: "var(--color-neon-orange)" }}
                >
                    <span className="truncate pr-2">
                        ● {selectedThreat.title}
                        {selectedThreat.threat_data?.breach_details?.ip_address && (
                            <span className="text-gray-400 ml-2">
                                IP: {selectedThreat.threat_data.breach_details.ip_address}
                            </span>
                        )}
                    </span>
                </div>
            )}

            {/* Quick Actions */}
            {selectedThreat && !isLoading && (
                <div className="px-2.5 py-2 border-t border-gray-800 bg-black/30 flex gap-1.5 flex-wrap">
                    {[
                        { label: "⚡ Trace Network", msg: "Trace the full attack network for this threat. Map all connected IPs, device fingerprints, and linked mule accounts." },
                        { label: "📊 Risk Summary", msg: "Provide a concise risk summary with confidence score, attack type classification, and financial impact assessment." },
                        { label: "🛑 Freeze Plan", msg: "Recommend which accounts to freeze and explain the freeze execution plan with regulatory compliance notes." },
                    ].map((action) => (
                        <button
                            key={action.label}
                            onClick={() => {
                                setInput(action.msg);
                                setTimeout(() => {
                                    const form = document.querySelector("form");
                                    form?.requestSubmit();
                                }, 50);
                            }}
                            className="px-2 py-1 rounded text-[9px] font-semibold bg-gray-800/80 text-gray-300 border border-gray-700/60 hover:bg-gray-700/80 hover:text-white hover:border-gray-600 transition-all cursor-pointer"
                            style={{ fontFamily: "JetBrains Mono, monospace" }}
                        >
                            {action.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Input */}
            <div className="p-2.5 border-t border-gray-800 bg-black/50">
                <form onSubmit={sendMessage} className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={selectedThreat ? "Ask about this threat..." : "Select a threat first..."}
                        className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-[var(--color-neon-orange)] focus:ring-1 focus:ring-orange-900/50 transition-all placeholder:text-gray-600"
                        style={{ fontFamily: "JetBrains Mono, monospace" }}
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                        style={{
                            background: input.trim() && !isLoading ? "linear-gradient(135deg, var(--color-neon-orange), #c2410c)" : "var(--color-bg-tertiary)",
                            color: input.trim() && !isLoading ? "#fff" : "var(--color-text-muted)",
                            fontFamily: "JetBrains Mono, monospace",
                            boxShadow: input.trim() && !isLoading ? "0 0 10px rgba(255,107,0,0.3)" : "none",
                        }}
                    >
                        SEND
                    </button>
                </form>
            </div>
        </div>
    );
}

// ── Wrapped Export ──────────────────────────────────────────
export default function AIAssistant(props: AIAssistantProps) {
    return (
        <AIErrorBoundary>
            <AIAssistantInner {...props} />
        </AIErrorBoundary>
    );
}
