import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { threatData, messageContext } = await req.json();

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: "GEMINI_API_KEY is not set in environment variables." },
                { status: 500 }
            );
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        // Build structured context from the threat data
        const contextBlock = threatData?.threat_id
            ? `
## Active Threat Context
- **Threat ID**: ${threatData.threat_id}
- **Title**: ${threatData.threat_title}
- **Risk Level**: ${threatData.risk_level}
- **Status**: ${threatData.status}
- **Alert Type**: ${threatData.alert_type}
- **Confidence Score**: ${((threatData.confidence_score || 0) * 100).toFixed(0)}%
- **Source IP**: ${threatData.selected_ip}
- **Transaction Amount**: ${threatData.transaction_currency} ${(threatData.transaction_amount || 0).toLocaleString()}
- **Sender**: ${threatData.sender}
- **Receiver**: ${threatData.receiver}

### Breach Details
${JSON.stringify(threatData.breach_details || {}, null, 2)}

### Transaction Details
${JSON.stringify(threatData.transaction_details || {}, null, 2)}

### Linkage Evidence
${(threatData.linkage_evidence || []).map((e: string) => `- ${e}`).join("\n") || "None available"}
`
            : "No specific threat is currently selected by the analyst.";

        const systemPrompt = `You are an elite AI Security Analyst embedded within a Unified SOC-AML Risk Engine dashboard.
Your role is to analyze the linkage between cyber breaches and suspicious financial transfers, 
helping human analysts understand threat patterns and make rapid decisions.

${contextBlock}

## Analyst Query
${messageContext}

## Response Guidelines
- Be concise, direct, and authoritative.
- If threat data is available, explain HOW the cyber breach enabled the financial movement.
- Highlight IP correlations, temporal proximity, and account linkages.
- For CRITICAL/HIGH threats, recommend immediate actions (freeze accounts, block transactions).
- Use markdown formatting: headers, bold, bullet points, code blocks where appropriate.
- If no threat is selected, provide general SOC-AML guidance based on the analyst's question.
- Always end with a clear, actionable recommendation.`;

        const result = await model.generateContent(systemPrompt);
        const responseText = result.response.text();

        return NextResponse.json({ response: responseText });
    } catch (error: any) {
        console.error("Gemini API Error:", error);

        const errorMessage = error?.message || "Unknown error";
        const statusCode = error?.status || 500;

        // Rate limit handling
        if (
            errorMessage.includes("429") ||
            errorMessage.toLowerCase().includes("quota") ||
            errorMessage.toLowerCase().includes("rate")
        ) {
            return NextResponse.json(
                {
                    error: "AI Analyst is rate-limited. Retrying automatically...",
                    retryable: true,
                },
                { status: 429 }
            );
        }

        // Model overload
        if (errorMessage.includes("503") || errorMessage.toLowerCase().includes("overloaded")) {
            return NextResponse.json(
                {
                    error: "AI model is temporarily overloaded. Please retry in a moment.",
                    retryable: true,
                },
                { status: 503 }
            );
        }

        return NextResponse.json(
            { error: "Failed to generate AI response. Please try again.", retryable: false },
            { status: statusCode }
        );
    }
}
