import {
    describe,
    expect,
    it,
} from "vitest";

import {
    X402ResearchAdapter,
    X402ResearchAdapterError,
    type X402PaymentExecutor,
} from "./research";

const executor: X402PaymentExecutor = {
    id: "test-executor",

    async pay() {
        return {
            response: new Response(
                JSON.stringify({
                    summary:
                        "Premium research result.",

                    confidence: 0.8,

                    provider:
                        "test-provider",

                    sources: [
                        {
                            title:
                                "Test source",

                            provider:
                                "test-provider",

                            content:
                                "Research evidence.",

                            confidence: 0.8,
                        },
                    ],
                }),
                {
                    status: 200,

                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                },
            ),

            receipt: {
                protocol: "x402",

                amountUsdc: 0.01,

                paidAt:
                    new Date().toISOString(),
            },
        };
    },
};

describe(
    "X402ResearchAdapter",
    () => {
        it(
            "requires a payment executor",
            () => {
                expect(
                    () =>
                        new X402ResearchAdapter({
                            paymentExecutor:
                                undefined as never,
                        }),
                ).toThrow(
                    X402ResearchAdapterError,
                );
            },
        );

        it(
            "returns structured paid research",
            async () => {
                const adapter =
                    new X402ResearchAdapter({
                        paymentExecutor:
                            executor,

                        maximumPaymentUsdc:
                            0.05,

                        performInitialRequest:
                            false,
                    });

                const result =
                    await adapter.purchaseResearch({
                        url:
                            "https://example.com/research",

                        query:
                            "Will ETH exceed $4,000?",

                        budgetUsdc: 0.02,
                    });

                expect(result.summary).toBe(
                    "Premium research result.",
                );

                expect(
                    result.totalCostUsdc,
                ).toBe(0.01);

                expect(result.sources).toHaveLength(
                    1,
                );
            },
        );
    },
);