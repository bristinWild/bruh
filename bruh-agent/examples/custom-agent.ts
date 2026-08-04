import { defineAgent } from "@bruhmarket/agent-sdk";

export default defineAgent({
    manifest: {
        id: "my-first-agent",

        name: "My First Agent",

        version: "0.1.0",

        description:
            "Example Bruh agent.",

        source: "custom",

        difficulty: "developer",

        author: {
            name: "Your Name",
        },

        categories: [
            "macro",
        ],

        capabilities: [
            "research",
            "prediction",
        ],

        permissions: {
            canResearch: true,
            canTrade: false,
            canPurchaseResearch: false,
            canAccessHistoricalData: false,
            canAccessOnchainData: false,
            canUseExternalApis: false,
            maximumTradeUsdc: 0,
        },
    },

    systemPrompt:
        "You are a careful forecasting agent.",

    defaults: {
        edgeThreshold: 0.05,
        kellyFraction: 0.1,
        maxPositionUsdc: 1,
        researchBudgetUsdc: 0,
        maxResearchSources: 5,
        minimumConfidence: 0.5,
    },

    async research(context) {
        return {
            profileId: "my-first-agent",
            marketId: context.market.id,
            collectedAt: new Date().toISOString(),
            summary: "Example research.",
            evidence: [],
            costUsdc: 0,
        };
    },

    async estimate() {
        return {
            probability: 0.55,
            confidence: 0.65,
            reasoning:
                "Example estimation.",

            keyFactors: [],

            risks: [],

            recommendedAction:
                "BUY_YES",
        };
    },
});