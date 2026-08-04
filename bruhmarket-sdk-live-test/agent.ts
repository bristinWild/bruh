import { defineAgent } from "@bruhmarket/agent-sdk";

const agent = defineAgent({
    manifest: {
        id: "consumer-test-agent",
        name: "Consumer Test Agent",
        version: "0.1.0",
        description: "Validates the packaged Bruh SDK.",
        source: "custom",
        difficulty: "developer",

        author: {
            name: "Bruh SDK Test",
        },

        categories: ["testing"],

        capabilities: [
            "research",
            "prediction",
        ],

        permissions: {
            canResearch: true,
            canPurchaseResearch: false,
            canTrade: false,
            canAccessHistoricalData: false,
            canAccessOnchainData: false,
            canUseExternalApis: false,
            maximumTradeUsdc: 0,
        },
    },

    systemPrompt:
        "You are a package validation agent.",

    defaults: {
        edgeThreshold: 0.05,
        kellyFraction: 0.1,

        // Must currently be greater than zero.
        maxPositionUsdc: 1,

        researchBudgetUsdc: 0,
        maxResearchSources: 5,
        minimumConfidence: 0.5,
    },

    async research(context) {
        return {
            profileId: "consumer-test-agent",
            marketId: context.market.id,
            collectedAt: new Date().toISOString(),
            summary: "Public SDK package works.",
            evidence: [],
            costUsdc: 0,
        };
    },

    async estimate() {
        return {
            probability: 0.5,
            confidence: 0.5,
            reasoning: "Package validation successful.",
            keyFactors: [],
            risks: [],
            recommendedAction: "PASS" as const,
        };
    },
});

console.log({
    id: agent.id,
    name: agent.name,
    version: agent.version,
    manifest: agent.manifest,
});