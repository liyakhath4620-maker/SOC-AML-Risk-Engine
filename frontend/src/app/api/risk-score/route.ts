import { NextResponse } from "next/server";

// Returns an elevated mule ring probability score — 82% for the demo
export async function GET() {
    return NextResponse.json({
        mule_ring_probability: 0.82,
        total_threats_analyzed: 47,
        high_confidence_threats: 12,
        avg_confidence: 0.74,
        timestamp: new Date().toISOString(),
    });
}
