/**
 * Indian Numbering System formatter
 * ₹1,50,000 format (lakhs/crores, not millions/billions)
 */
export function formatINR(amount: number): string {
    const isNegative = amount < 0;
    const abs = Math.abs(amount);
    const formatted = abs.toLocaleString("en-IN", {
        maximumFractionDigits: 0,
        minimumFractionDigits: 0,
    });
    return `${isNegative ? "-" : ""}₹${formatted}`;
}

/**
 * Format with decimals for precise amounts
 */
export function formatINRExact(amount: number): string {
    const isNegative = amount < 0;
    const abs = Math.abs(amount);
    const formatted = abs.toLocaleString("en-IN", {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
    });
    return `${isNegative ? "-" : ""}₹${formatted}`;
}

/**
 * Compact format: ₹1.5L, ₹2.3Cr
 */
export function formatINRCompact(amount: number): string {
    const abs = Math.abs(amount);
    if (abs >= 10000000) {
        return `₹${(abs / 10000000).toFixed(1)}Cr`;
    }
    if (abs >= 100000) {
        return `₹${(abs / 100000).toFixed(1)}L`;
    }
    if (abs >= 1000) {
        return `₹${(abs / 1000).toFixed(1)}K`;
    }
    return `₹${abs.toFixed(0)}`;
}
