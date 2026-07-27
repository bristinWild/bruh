import Anthropic from "@anthropic-ai/sdk";
import { CONFIG } from "./config.js";
import { MarketState } from "./market.js";

const client = new Anthropic({ apiKey: CONFIG.ANTHROPIC_API_KEY });

export interface Reasoning {
    probability: number;     // 0–1 estimated P(YES)
    confidence: number;      // 0–1 confidence in estimate
    keyFactors: string[];    // top 3 reasons
    summary: string;         // one-line reasoning
}

export async function reason(
    market: MarketState,
    agentName: string,
    strategy: string
): Promise<Reasoning> {
    const prompt = `You are ${agentName}, an autonomous AI forecasting agent using a ${strategy} strategy.

Market question: "${market.question}"
Current market price: YES=${(market.yesPrice * 100).toFixed(1)}%, NO=${(market.noPrice * 100).toFixed(1)}%

Your task: Estimate the true probability of YES and determine if the market is mispriced.

Respond ONLY with valid JSON in this exact format:
{
  "probability": 0.65,
  "confidence": 0.7,
  "keyFactors": ["factor 1", "factor 2", "factor 3"],
  "summary": "one line reasoning"
}

Rules:
- probability must be between 0.0 and 1.0
- confidence must be between 0.0 and 1.0
- keyFactors must have exactly 3 items
- summary must be under 100 characters`;

    const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    try {
        const clean = text.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(clean) as Reasoning;
        return parsed;
    } catch {
        // Fallback to market price if parsing fails
        return {
            probability: market.yesPrice,
            confidence: 0.1,
            keyFactors: ["failed to parse", "using market price", "low confidence"],
            summary: "reasoning failed — using market price as prior",
        };
    }
}