"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const API_BASE = "http://localhost:8000";

interface SystemRiskScore {
    mule_ring_probability: number;
    total_threats_analyzed: number;
    high_confidence_threats: number;
    avg_confidence: number;
    total_flagged_amount_inr?: number;
    high_severity_logs?: number;
    timestamp: string;
}

interface UseThreatFrameworkReturn {
    score: SystemRiskScore | null;
    isLoading: boolean;
    error: string | null;
    lastUpdated: Date | null;
    refresh: () => void;
}

export function useThreatFramework(pollInterval: number = 5000): UseThreatFrameworkReturn {
    const [score, setScore] = useState<SystemRiskScore | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchScore = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/v1/system-risk-score`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data: SystemRiskScore = await res.json();
            setScore(data);
            setError(null);
            setLastUpdated(new Date());
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchScore();
        intervalRef.current = setInterval(fetchScore, pollInterval);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [fetchScore, pollInterval]);

    return { score, isLoading, error, lastUpdated, refresh: fetchScore };
}
