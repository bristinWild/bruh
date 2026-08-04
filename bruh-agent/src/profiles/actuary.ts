import type { AgentEstimate, AgentProfile, AgentReasoningContext, AgentResearchContext, AgentResearchResult, } from "../core/types";

const SYSTEM_PROMPT = `
You are Actuary, a conservative prediction-market probability analyst.

Your specialty is estimating outcomes using:

- historical base rates
- comparable events
- long-term frequencies
- statistical evidence
- prior probabilities
- Bayesian updating

You should resist hype, recency bias and emotional narratives.

Rules:

1. Begin with the historical base rate.
2. Clearly identify the relevant comparison class.
3. Adjust the prior only when current evidence justifies it.
4. Avoid large probability changes based on weak evidence.
5. Explain uncertainty and data limitations.
6. Return PASS when the expected edge is too small.
7. Keep probability estimates between 0.01 and 0.99.
`;

export const actuaryProfile: AgentProfile = {
    id: "actuary",
    name: "Actuary",
    version: "1.0.0",
    source: "bruh",

    description:
        "A conservative forecasting agent that anchors decisions on historical base rates, comparable outcomes and statistical priors.",

    difficulty: "intermediate",

    categories: [
        "economics",
        "macro",
        "elections",
        "finance",
        "weather",
        "public-policy",
    ],

    capabilities: [
        "historical-research",
        "base-rate-analysis",
        "bayesian-reasoning",
        "probability-estimation",
        "prediction-market-trading",
    ],

    defaults: {
        edgeThreshold: 0.08,
        kellyFraction: 0.15,
        maxPositionUsdc: 3,
        researchBudgetUsdc: 0.015,
        maxResearchSources: 6,
    },

    systemPrompt: SYSTEM_PROMPT,

    async research(
        context: AgentResearchContext,
    ): Promise<AgentResearchResult> {
        const result =
            await context.providers.historical.analyze({
                question: context.market.question,
                description: context.market.description,
                categories: context.market.categories,
                resolutionCriteria:
                    context.market.resolutionCriteria,
                limit: context.config.maxResearchSources,
            });

        return {
            profileId: "actuary",
            marketId: context.market.id,
            collectedAt: new Date().toISOString(),

            summary: result.summary,

            evidence: result.comparables.map((comparable) => ({
                type: "historical",
                title: comparable.title,
                summary: comparable.summary,
                source: comparable.source,
                url: comparable.url,
                publishedAt: comparable.date,
                credibilityScore:
                    comparable.credibilityScore,
                metadata: {
                    outcome: comparable.outcome,
                    similarityScore:
                        comparable.similarityScore,
                    category: comparable.category,
                },
            })),

            costUsdc: result.costUsdc ?? 0,

            metadata: {
                provider: result.provider,
                baseRate: result.baseRate,
                sampleSize: result.sampleSize,
                confidenceInterval:
                    result.confidenceInterval,
            },
        };
    },

    async estimate(
        context: AgentReasoningContext,
    ): Promise<AgentEstimate> {
        return context.providers.llm.estimate({
            profileId: "actuary",
            systemPrompt: SYSTEM_PROMPT,

            market: context.market,
            research: context.research,

            marketProbability: context.marketProbability,

            instructions: `
Start with the historical base rate contained in the research.

Then:

1. Define the most relevant comparison class.
2. Explain the strength and size of the historical sample.
3. Identify differences between historical cases and the current market.
4. Apply only justified probability adjustments.
5. Compare the final estimate against the current market probability.
6. Recommend PASS unless the edge exceeds the configured threshold.

Return a calibrated probability, confidence score, concise reasoning,
key factors, risks and a recommended action.
      `,
        });
    },
};