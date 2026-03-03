import { NextResponse } from "next/server";

/**
 * GET: Proxy to the real backend for threats.
 * No mock data — all threats come from the SOC-AML backend.
 */
export async function GET() {
    try {
        const res = await fetch("http://localhost:8000/api/v1/threats", {
            cache: "no-store",
        });
        if (res.ok) {
            const data = await res.json();
            return NextResponse.json(data);
        }
        // Backend returned an error — return empty
        return NextResponse.json([]);
    } catch {
        // Backend not reachable — return empty
        return NextResponse.json([]);
    }
}

/**
 * POST: Proxy create-threat to real backend.
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const res = await fetch("http://localhost:8000/api/v1/threats", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            cache: "no-store",
        });
        if (res.ok) {
            const data = await res.json();
            return NextResponse.json(data, { status: 201 });
        }
        return NextResponse.json({ error: "Backend error" }, { status: 500 });
    } catch {
        return NextResponse.json({ error: "Backend not reachable" }, { status: 500 });
    }
}
