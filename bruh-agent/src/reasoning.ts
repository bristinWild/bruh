import Anthropic from "@anthropic-ai/sdk";
import { CONFIG } from "./config";
import { MarketState } from "./market";

const client = new Anthropic({ apiKey: CONFIG.ANTHROPIC_API_KEY });

export interface Reasoning {
    probability: number;
    confidence: number;
    keyFactors: string[];
    summary: string;
}

const AGENT_PERSONAS: Record<string, { system: string; temperature: number }> = {
    Newshound: {
        system: `You are an aggressive momentum trader. You weight recent news, price action, and narrative shifts heavily. You move fast and are willing to take strong positions when you see clear signals. You distrust markets that are slow to price in new information. Be decisive — don't hedge everything.`,
        temperature: 0.9,
    },
    Actuary: {
        system: `You are a conservative base-rate analyst. You anchor firmly on historical frequencies and revert aggressively to priors. You are deeply skeptical of recency bias and narrative-driven moves. You believe markets frequently overreact to headlines. Your estimates barely move unless the fundamentals change.`,
        temperature: 0.3,
    },
};

export async function reason(
    market: MarketState,
    agentName: string,
    strategy: string
): Promise<Reasoning> {
    const persona = AGENT_PERSONAS[agentName] ?? {
        system: `You are a forecasting agent using a ${strategy} strategy.`,
        temperature: 0.7,
    };

    const prompt = `Market question: "${market.question}"
Current market consensus: YES=${(market.yesPrice * 100).toFixed(1)}%, NO=${(market.noPrice * 100).toFixed(1)}%

Estimate the TRUE probability of YES. Consider whether the market is mispriced.

Respond ONLY with valid JSON:
{
  "probability": 0.65,
  "confidence": 0.7,
  "keyFactors": ["specific factor 1", "specific factor 2", "specific factor 3"],
  "summary": "one line under 100 chars"
}`;

    const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 300,
        system: persona.system,
        messages: [{ role: "user", content: prompt }],
        // @ts-ignore — temperature supported at runtime
        temperature: persona.temperature,
    });

    const text =
        response.content[0].type === "text" ? response.content[0].text : "";

    try {
        const clean = text.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(clean) as Reasoning;

        // Clamp values to valid range
        parsed.probability = Math.max(0.01, Math.min(0.99, parsed.probability));
        parsed.confidence = Math.max(0.01, Math.min(0.99, parsed.confidence));

        return parsed;
    } catch {
        return {
            probability: market.yesPrice,
            confidence: 0.1,
            keyFactors: ["parse failed", "using market prior", "low confidence"],
            summary: "reasoning failed — defaulting to market price",
        };
    }
}