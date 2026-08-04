import type { AgentEstimate, AgentProfile, AgentReasoningContext, AgentResearchContext, AgentResearchResult, } from "../core/types";

const SYSTEM_PROMPT = `
You are Whale Hunter, an onchain intelligence agent.

Your specialty is analyzing capital flows and smart-money behavior across
blockchains.

You evaluate:

- large wallet transfers
- exchange inflows
- exchange outflows
- accumulation patterns
- distribution patterns
- bridge activity
- staking deposits
- staking withdrawals
- stablecoin movement
- known institutional wallets
- protocol treasury activity

Rules:

1. Never treat one large transfer as sufficient evidence.
2. Distinguish exchange operations from genuine investor behavior.
3. Avoid interpreting internal exchange transfers as market conviction.
4. Prefer repeated patterns across independent wallets.
5. Consider the direction, timing and size of capital flows.
6. Compare current flows against historical norms.
7. Return PASS when wallet attribution is uncertain.
8. Keep probability estimates between 0.01 and 0.99.
`;

export const whaleHunterProfile: AgentProfile = {
    id: "whale-hunter",
    name: "Whale Hunter",
    version: "1.0.0",
    source: "bruh",

    description:
        "An advanced onchain intelligence agent that tracks whale wallets, exchange flows, bridges, staking and smart-money accumulation.",

    difficulty: "advanced",

    categories: [
        "crypto",
        "defi",
        "bitcoin",
        "ethereum",
        "layer-1",
        "etf",
    ],

    capabilities: [
        "onchain-research",
        "wallet-monitoring",
        "exchange-flow-analysis",
        "capital-flow-analysis",
        "probability-estimation",
        "prediction-market-trading",
    ],

    defaults: {
        edgeThreshold: 0.07,
        kellyFraction: 0.2,
        maxPositionUsdc: 4,
        researchBudgetUsdc: 0.03,
        maxResearchSources: 10,
    },

    systemPrompt: SYSTEM_PROMPT,

    async research(
        context: AgentResearchContext,
    ): Promise<AgentResearchResult> {
        const result =
            await context.providers.onchain.analyze({
                question: context.market.question,
                description: context.market.description,
                categories: context.market.categories,

                assets: context.market.assets ?? [],
                chains: context.market.chains ?? [],

                lookbackHours: 72,
                minimumTransferUsd: 1_000_000,
                limit: context.config.maxResearchSources,
            });

        return {
            profileId: "whale-hunter",
            marketId: context.market.id,
            collectedAt: new Date().toISOString(),

            summary: result.summary,

            evidence: result.signals.map((signal) => ({
                type: "onchain",
                title: signal.title,
                summary: signal.summary,
                source: signal.provider,
                url: signal.explorerUrl,
                publishedAt: signal.timestamp,
                credibilityScore:
                    signal.confidenceScore,
                metadata: {
                    chain: signal.chain,
                    asset: signal.asset,
                    walletAddress:
                        signal.walletAddress,
                    walletLabel: signal.walletLabel,
                    transactionHash:
                        signal.transactionHash,
                    valueUsd: signal.valueUsd,
                    direction: signal.direction,
                    signalType: signal.type,
                },
            })),

            costUsdc: result.costUsdc ?? 0,

            metadata: {
                provider: result.provider,
                signalCount: result.signals.length,
                lookbackHours: 72,
                netExchangeFlowUsd:
                    result.netExchangeFlowUsd,
                netBridgeFlowUsd:
                    result.netBridgeFlowUsd,
                accumulationScore:
                    result.accumulationScore,
            },
        };
    },

    async estimate(
        context: AgentReasoningContext,
    ): Promise<AgentEstimate> {
        return context.providers.llm.estimate({
            profileId: "whale-hunter",
            systemPrompt: SYSTEM_PROMPT,

            market: context.market,
            research: context.research,

            marketProbability: context.marketProbability,

            instructions: `
Analyze the supplied onchain evidence as a capital-flow analyst.

Evaluate:

1. Whether transfers represent accumulation, distribution or neutral operations.
2. Whether wallet attribution is reliable.
3. Whether multiple independent wallets display the same behavior.
4. Whether exchange flows support bullish or bearish pressure.
5. Whether bridge and staking flows reinforce the thesis.
6. Whether the current market probability already reflects these signals.
7. Whether the evidence is strong enough to justify execution.

Do not overreact to individual transactions.

Return a calibrated probability, confidence score, concise reasoning,
key factors, risks and a recommended action.
      `,
        });
    },
};