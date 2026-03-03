"use client";

import { useState, useCallback } from "react";

const API_BASE = "http://localhost:8000";

interface FreezeResult {
    success: boolean;
    frozen_accounts: string[];
    message: string;
}

interface UseAccountFreezeReturn {
    freeze: (accountIds: string[]) => Promise<boolean>;
    isLoading: boolean;
    result: FreezeResult | null;
    error: string | null;
    frozenAccounts: Set<string>;
    freezingAccounts: Set<string>;
}

export function useAccountFreeze(): UseAccountFreezeReturn {
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<FreezeResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [frozenAccounts, setFrozenAccounts] = useState<Set<string>>(new Set());
    const [freezingAccounts, setFreezingAccounts] = useState<Set<string>>(new Set());

    const freeze = useCallback(async (accountIds: string[]): Promise<boolean> => {
        setIsLoading(true);
        setError(null);

        setFreezingAccounts((prev) => {
            const next = new Set(prev);
            accountIds.forEach((id) => next.add(id));
            return next;
        });

        try {
            const res = await fetch(`${API_BASE}/api/v1/freeze-accounts`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ account_ids: accountIds }),
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data: FreezeResult = await res.json();
            setResult(data);

            if (data.success) {
                setFrozenAccounts((prev) => {
                    const next = new Set(prev);
                    data.frozen_accounts.forEach((id) => next.add(id));
                    return next;
                });
            }
            return data.success;
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to freeze";
            setError(msg);
            setFreezingAccounts((prev) => {
                const next = new Set(prev);
                accountIds.forEach((id) => next.delete(id));
                return next;
            });
            return false;
        } finally {
            setIsLoading(false);
            setFreezingAccounts((prev) => {
                const next = new Set(prev);
                accountIds.forEach((id) => next.delete(id));
                return next;
            });
        }
    }, []);

    return { freeze, isLoading, result, error, frozenAccounts, freezingAccounts };
}
