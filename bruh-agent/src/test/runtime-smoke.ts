import { defineAgent, getAgentProfile, listAgentProfileIds, runAgentRuntime, } from "../index";

import type {
    AgentProviders,
    AgentResearchResult,
} from "../core/types";

import {
    InMemoryAgentMemoryProvider,
} from "../index";

import {
    createAgentMemoryLifecycle,
} from "../index";



const memoryProvider =
    new InMemoryAgentMemoryProvider();

const memoryLifecycle =
    createAgentMemoryLifecycle(
        memoryProvider,
    );


const mockProviders: AgentProviders = {
    news: {
        async search(input) {
            return {
                provider: "mock-news",
                summary:
                    "Multiple credible reports indicate improving institutional demand for ETH.",
                costUsdc: 0.004,
                items: [
                    {
                        title: "Institutional ETH demand increases",
                        summary:
                            "Recent fund-flow data shows stronger institutional demand.",
                        source: "Mock Financial News",
                        url: "https://example.com/eth-demand",
                        publishedAt: new Date().toISOString(),
                        credibilityScore: 0.88,
                        sentiment: "positive" as const,
                        isPrimarySource: false,
                    },
                    {
                        title: "ETF inflows remain positive",
                        summary:
                            "Daily ETF flows remained positive over the observed period.",
                        source: "Mock ETF Dataset",
                        url: "https://example.com/etf-flows",
                        publishedAt: new Date().toISOString(),
                        credibilityScore: 0.92,
                        sentiment: "positive" as const,
                        isPrimarySource: true,
                    },
                ].slice(0, input.limit),
            };
        },
    },

    historical: {
        async analyze() {
            return {
                provider: "mock-historical",
                summary:
                    "Comparable historical setups resolved YES in 6 of 10 cases.",
                baseRate: 0.6,
                sampleSize: 10,
                confidenceInterval: {
                    lower: 0.31,
                    upper: 0.83,
                },
                costUsdc: 0,
                comparables: [
                    {
                        title: "Comparable ETH breakout",
                        summary:
                            "ETH crossed a major price threshold after sustained inflows.",
                        source: "Mock historical dataset",
                        date: "2025-05-01T00:00:00.000Z",
                        outcome: "YES",
                        credibilityScore: 0.8,
                        similarityScore: 0.74,
                        category: "crypto",
                    },
                ],
            };
        },
    },

    onchain: {
        async analyze() {
            return {
                provider: "mock-onchain",
                summary:
                    "Exchange outflows and whale accumulation indicate moderate accumulation.",
                costUsdc: 0,
                netExchangeFlowUsd: -42_000_000,
                netBridgeFlowUsd: 8_000_000,
                accumulationScore: 0.68,
                signals: [
                    {
                        type: "exchange-flows",
                        title: "Large ETH exchange outflow",
                        summary:
                            "A large amount of ETH moved away from centralized exchanges.",
                        provider: "mock-onchain",
                        timestamp: new Date().toISOString(),
                        confidenceScore: 0.83,
                        chain: "ethereum",
                        asset: "ETH",
                        walletLabel: "Institutional wallet",
                        valueUsd: 18_000_000,
                        direction: "outflow",
                    },
                ],
            };
        },
    },

    llm: {
        async estimate(input) {
            const probabilityByProfile: Record<string, number> = {
                newshound: 0.68,
                actuary: 0.59,
                "whale-hunter": 0.72,
                "test-custom-agent": 0.66,
            };

            const probability =
                probabilityByProfile[input.profileId] ?? 0.5;

            return {
                probability,
                confidence: 0.78,
                reasoning:
                    `Mock estimate for ${input.profileId}. The collected evidence supports a probability above the current market price.`,
                keyFactors: [
                    "Evidence is directionally consistent",
                    "Multiple signals support the thesis",
                ],
                risks: [
                    "Evidence may already be priced in",
                    "Market conditions may change",
                ],
                recommendedAction:
                    probability > input.marketProbability
                        ? "BUY_YES"
                        : "PASS",
            };
        },
    },
};

const market = {
    id: "eth-4000-friday",
    question:
        "Will ETH trade above $4,000 by Friday?",
    description:
        "Resolves YES if ETH/USD trades above $4,000 before the deadline.",
    categories: ["crypto", "ethereum"],
    resolutionCriteria:
        "YES if a designated ETH/USD price feed reports a price above $4,000.",
    yesPrice: 0.51,
    noPrice: 0.49,
    liquidityUsdc: 5_000,
    volumeUsdc: 12_000,
    assets: ["ETH"],
    chains: ["ethereum"],
};

async function runBuiltInProfile(profileId: string) {
    const profile = getAgentProfile(profileId);

    const result = await runAgentRuntime({
        profile,

        market,

        providers: mockProviders,

        memoryProvider,

        agentId: `test-${profile.id}`,

        walletAddress:
            "0x1111111111111111111111111111111111111111",

        network: "eip155:5042002",

        executionPlanExpiresInSeconds: 300,

        config: {
            ...profile.defaults,

            availableBalanceUsdc: 100,

            currentMarketExposureUsdc: 0,

            dailyProfitLossUsdc: 0,

            allowTrading: true,

            dryRun: true,
        },

        metadata: {
            test: true,
        },
    });
    console.log(`\n=== ${profile.name} ===`);
    console.dir(result, {
        depth: null,
        colors: true,
    });

    if (result.status === "failed") {
        throw new Error(
            `${profile.name} failed: ${result.error?.message}`,
        );
    }

    if (!result.research) {
        throw new Error(
            `${profile.name} did not produce research.`,
        );
    }

    if (!result.estimate) {
        throw new Error(
            `${profile.name} did not produce an estimate.`,
        );
    }

    if (!result.decision) {
        throw new Error(
            `${profile.name} did not produce a decision.`,
        );
    }

    if (!result.executionPlan) {
        throw new Error(
            `${profile.name} did not produce an execution plan.`,
        );
    }

    return result;
}

async function runCustomAgentTest() {
    const customAgent = defineAgent({
        manifest: {
            id: "test-custom-agent",
            name: "Test Custom Agent",
            version: "1.0.0",
            description:
                "A local SDK smoke-test agent.",
            source: "custom",
            difficulty: "developer",
            author: {
                name: "Bruh Test Suite",
            },
            categories: ["crypto"],
            capabilities: [
                "research",
                "prediction",
                "trading",
            ],
            permissions: {
                canResearch: true,
                canPurchaseResearch: false,
                canTrade: true,
                canAccessHistoricalData: true,
                canAccessOnchainData: false,
                canUseExternalApis: false,
                maximumTradeUsdc: 5,
            },
        },

        systemPrompt:
            "You are a test forecasting agent.",

        defaults: {
            edgeThreshold: 0.05,
            kellyFraction: 0.2,
            maxPositionUsdc: 5,
            researchBudgetUsdc: 0,
            maxResearchSources: 5,
            minimumConfidence: 0.6,
        },


        async research(context): Promise<AgentResearchResult> {
            const historical =
                await context.providers.historical.analyze({
                    question: context.market.question,
                    description: context.market.description,
                    categories: context.market.categories,
                    resolutionCriteria:
                        context.market.resolutionCriteria,
                    limit: context.config.maxResearchSources,
                });

            return {
                profileId: "test-custom-agent",
                marketId: context.market.id,
                collectedAt: new Date().toISOString(),
                summary: historical.summary,
                evidence: historical.comparables.map(
                    (item) => ({
                        type: "historical",
                        title: item.title,
                        summary: item.summary,
                        source: item.source,
                        url: item.url,
                        publishedAt: item.date,
                        credibilityScore:
                            item.credibilityScore,
                    }),
                ),
                costUsdc: historical.costUsdc ?? 0,
            };
        },

        async estimate(context) {
            return context.providers.llm.estimate({
                profileId: "test-custom-agent",
                systemPrompt:
                    "You are a test forecasting agent.",
                market: context.market,
                research: context.research,
                marketProbability:
                    context.marketProbability,
                instructions:
                    "Return a mock structured prediction.",
            });
        },
    });

    const result = await runAgentRuntime({
        profile: customAgent,

        market,

        providers: mockProviders,

        memoryProvider,

        agentId: "test-custom-agent",

        walletAddress:
            "0x1111111111111111111111111111111111111111",

        network: "eip155:5042002",

        executionPlanExpiresInSeconds: 300,

        config: {
            ...customAgent.defaults,

            availableBalanceUsdc: 50,

            currentMarketExposureUsdc: 0,

            dailyProfitLossUsdc: 0,

            allowTrading: true,

            dryRun: true,
        },

        metadata: {
            test: true,
        },
    });

    console.log("\n=== Custom SDK agent ===");
    console.dir(result, {
        depth: null,
        colors: true,
    });

    if (result.status === "failed") {
        throw new Error(
            `Custom agent failed: ${result.error?.message}`,
        );
    }

    if (!result.executionPlan) {
        throw new Error(
            "Custom agent did not emit an execution plan.",
        );
    }

}

async function main() {
    console.log("Bruh Agent Runtime smoke test");

    console.log(
        "Registered profiles:",
        listAgentProfileIds(),
    );

    let newshoundResult:
        Awaited<
            ReturnType<
                typeof runBuiltInProfile
            >
        > | undefined;

    for (const profileId of listAgentProfileIds()) {
        const result =
            await runBuiltInProfile(
                profileId,
            );

        if (
            profileId === "newshound"
        ) {
            newshoundResult = result;
        }
    }

    await runCustomAgentTest();

    if (!newshoundResult) {
        throw new Error(
            "Newshound result was not captured.",
        );
    }

    /* ----------------------------------------------------- */
    /* Phase 7 lifecycle test */
    /* ----------------------------------------------------- */

    const pendingTrade =
        await memoryLifecycle.createPendingTrade(
            newshoundResult.executionPlan!,
        );

    console.log(
        "\n=== Pending Trade ===",
    );

    console.dir(pendingTrade, {
        depth: null,
        colors: true,
    });

    await memoryLifecycle.markExecuting(
        newshoundResult.executionPlan!.id,
    );

    const executedTrade =
        await memoryLifecycle.recordExecution(
            newshoundResult.executionPlan!.id,
            {
                transactionHash:
                    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            },
        );

    console.log(
        "\n=== Executed Trade ===",
    );

    console.dir(executedTrade, {
        depth: null,
        colors: true,
    });

    const resolved =
        await memoryLifecycle.resolveMarket({
            runId:
                newshoundResult.runId,

            resolution: "YES",
        });

    console.log(
        "\n=== Resolution ===",
    );

    console.dir(
        resolved.resolution,
        {
            depth: null,
            colors: true,
        },
    );

    console.log(
        "\n=== Reflection ===",
    );

    console.dir(
        resolved.reflection,
        {
            depth: null,
            colors: true,
        },
    );

    /* ----------------------------------------------------- */
    /* Memory inspection */
    /* ----------------------------------------------------- */

    const memories =
        await memoryProvider.find({
            agentId: "test-newshound",
        });

    console.log(
        "\n=== Newshound Memory ===",
    );

    console.dir(memories, {
        depth: null,
        colors: true,
    });

    const performance =
        await memoryProvider.getPerformance(
            "test-newshound",
        );

    console.log(
        "\n=== Newshound Performance ===",
    );

    console.dir(performance, {
        depth: null,
        colors: true,
    });

    /* ----------------------------------------------------- */
    /* Assertions */
    /* ----------------------------------------------------- */

    if (memories.length < 4) {
        throw new Error(
            "Expected run, decision, trade and resolution memories.",
        );
    }

    if (
        executedTrade.executionStatus !==
        "executed"
    ) {
        throw new Error(
            "Trade was not marked executed.",
        );
    }

    if (
        resolved.reflection
            .outcomeAssessment !==
        "correct"
    ) {
        throw new Error(
            "Reflection was incorrect.",
        );
    }

    console.log(
        "\n✅ Phase 7 passed.",
    );
}

main().catch((error) => {
    console.error("\n❌ Smoke test failed");
    console.error(error);
    process.exitCode = 1;
});