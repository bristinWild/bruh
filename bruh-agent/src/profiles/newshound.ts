import type { AgentEstimate, AgentProfile, AgentReasoningContext, AgentResearchContext, AgentResearchResult, } from "../core/types";

const SYSTEM_PROMPT = `
You are Newshound, a fast-moving prediction-market intelligence agent.

Your specialty is detecting information changes before the wider market
fully incorporates them.

Prioritize:

- recent credible news
- official announcements
- press releases
- regulatory updates
- company statements
- reputable reporting
- changes in market sentiment

Rules:

1. Recency alone is not evidence.
2. Prefer primary and official sources.
3. Distinguish confirmed information from speculation.
4. Do not trade solely because a topic is trending.
5. Identify whether the information is already priced into the market.
6. Return PASS when the evidence does not create a meaningful edge.
7. Keep probability estimates between 0.01 and 0.99.
`;

export const newshoundProfile: AgentProfile = {
    id: "newshound",
    name: "Newshound",
    version: "1.0.0",
    source: "bruh",

    description:
        "A fast, news-driven forecasting agent that reacts to credible breaking information and market-moving announcements.",

    difficulty: "beginner",

    categories: [
        "crypto",
        "artificial-intelligence",
        "technology",
        "politics",
        "business",
    ],

    capabilities: [
        "news-research",
        "source-evaluation",
        "sentiment-analysis",
        "probability-estimation",
        "prediction-market-trading",
    ],

    defaults: {
        edgeThreshold: 0.06,
        kellyFraction: 0.25,
        maxPositionUsdc: 5,
        researchBudgetUsdc: 0.02,
        maxResearchSources: 8,
    },

    systemPrompt: SYSTEM_PROMPT,

    async research(
        context: AgentResearchContext,
    ): Promise<AgentResearchResult> {
        const result = await context.providers.news.search({
            query: context.market.question,
            description: context.market.description,
            categories: context.market.categories,
            lookbackHours: 48,
            limit: context.config.maxResearchSources,
        });

        return {
            profileId: "newshound",
            marketId: context.market.id,
            collectedAt: new Date().toISOString(),

            summary: result.summary,

            evidence: result.items.map((item) => ({
                type: "news",
                title: item.title,
                summary: item.summary,
                source: item.source,
                url: item.url,
                publishedAt: item.publishedAt,
                credibilityScore: item.credibilityScore,
                metadata: {
                    sentiment: item.sentiment,
                    isPrimarySource: item.isPrimarySource,
                },
            })),

            costUsdc: result.costUsdc ?? 0,

            metadata: {
                lookbackHours: 48,
                sourceCount: result.items.length,
                provider: result.provider,
            },
        };
    },

    async estimate(
        context: AgentReasoningContext,
    ): Promise<AgentEstimate> {
        return context.providers.llm.estimate({
            profileId: "newshound",
            systemPrompt: SYSTEM_PROMPT,

            market: context.market,
            research: context.research,

            marketProbability: context.marketProbability,

            instructions: `
Determine whether recent information creates a genuine prediction-market edge.

Pay special attention to:

- the reliability of each source
- whether multiple independent sources agree
- whether the information is confirmed
- how recently it became public
- whether the current market price already reflects it

Return a calibrated probability, confidence score, concise reasoning,
key factors, risks and a recommended action.
      `,
        });
    },
};