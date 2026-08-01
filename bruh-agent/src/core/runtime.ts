import { randomUUID } from "node:crypto";

import { buildAgentDecision } from "./decision";
import { buildExecutionPlan } from "./execution-plan";


import type {
    AgentRuntimeConfig,
    AgentRuntimeInput,
    AgentRuntimeResult,
} from "./types";

function mergeRuntimeConfig(
    input: AgentRuntimeInput,
): AgentRuntimeConfig {
    const defaults = input.profile.defaults;

    const overrides = {
        ...(input.config.configOverrides ?? {}),
    };

    return {
        ...defaults,
        ...overrides,
        ...input.config,

        availableBalanceUsdc:
            input.config.availableBalanceUsdc,

        ...(input.config.configOverrides !== undefined
            ? {
                configOverrides:
                    input.config.configOverrides,
            }
            : {}),
    };
}

function validateRuntimeInput(
    input: AgentRuntimeInput,
): void {
    if (!input.profile) {
        throw new Error(
            "Agent runtime requires a profile.",
        );
    }

    if (!input.market) {
        throw new Error(
            "Agent runtime requires a market.",
        );
    }

    if (!input.providers) {
        throw new Error(
            "Agent runtime requires providers.",
        );
    }

    if (
        !Number.isFinite(
            input.config.availableBalanceUsdc,
        )
    ) {
        throw new Error(
            "availableBalanceUsdc must be a valid number.",
        );
    }

    if (
        input.config.availableBalanceUsdc < 0
    ) {
        throw new Error(
            "availableBalanceUsdc cannot be negative.",
        );
    }

    if (
        input.market.yesPrice <= 0 ||
        input.market.yesPrice >= 1
    ) {
        throw new Error(
            "Market YES price must be between 0 and 1.",
        );
    }
}

export async function runAgentRuntime(
    input: AgentRuntimeInput,
): Promise<AgentRuntimeResult> {
    const runId =
        input.runId ?? randomUUID();

    const startedAt =
        new Date().toISOString();

    try {
        validateRuntimeInput(input);

        const config =
            mergeRuntimeConfig(input);

        const memoryContext =
            input.memoryProvider &&
                input.agentId
                ? await input.memoryProvider.getContext({
                    agentId:
                        input.agentId,

                    profileId:
                        input.profile.id,

                    marketId:
                        input.market.id,

                    limit: 20,
                })
                : undefined;

        const runtimeMemory =
            memoryContext
                ? {
                    summary:
                        memoryContext.summary,

                    recentLessons:
                        memoryContext.recentReflections.flatMap(
                            (reflection) =>
                                reflection.lessons,
                        ),

                    recentDecisions:
                        memoryContext.recentDecisions.map(
                            (decision) => ({
                                marketId:
                                    decision.marketId,

                                action:
                                    decision.action,

                                probability:
                                    decision.probability,

                                confidence:
                                    decision.confidence,

                                edge:
                                    decision.edge,

                                reasoning:
                                    decision.reasoning,
                            }),
                        ),

                    recentOutcomes:
                        memoryContext.recentResolutions.map(
                            (resolution) => ({
                                marketId:
                                    resolution.marketId,

                                resolution:
                                    resolution.resolution,

                                pnlUsdc:
                                    resolution.pnlUsdc,

                                won:
                                    resolution.won,
                            }),
                        ),
                }
                : undefined;

        const research =
            await input.profile.research({
                market: input.market,

                config,

                providers:
                    input.providers,

                ...(runtimeMemory
                    ? {
                        memory:
                            runtimeMemory,
                    }
                    : {}),
            });

        const estimate =
            await input.profile.estimate({
                market: input.market,

                config,

                providers:
                    input.providers,

                research,

                marketProbability:
                    input.market.yesPrice,

                ...(runtimeMemory
                    ? {
                        memory:
                            runtimeMemory,
                    }
                    : {}),
            });

        const decision =
            buildAgentDecision({
                market: input.market,
                estimate,
                research,
                config,
            });

        const executionPlan =
            buildExecutionPlan({
                runId,

                profile: input.profile,

                market: input.market,

                research,

                decision,

                ...(input.agentId !== undefined
                    ? {
                        agentId:
                            input.agentId,
                    }
                    : {}),

                ...(input.walletAddress !== undefined
                    ? {
                        walletAddress:
                            input.walletAddress,
                    }
                    : {}),

                ...(input.network !== undefined
                    ? {
                        network:
                            input.network,
                    }
                    : {}),

                ...(input.executionPlanExpiresInSeconds !==
                    undefined
                    ? {
                        expiresInSeconds:
                            input.executionPlanExpiresInSeconds,
                    }
                    : {}),

                ...(input.metadata !== undefined
                    ? {
                        metadata: {
                            runtimeMetadata:
                                input.metadata,
                        },
                    }
                    : {}),
            });

        /* ADD MEMORY PERSISTENCE HERE */
        if (
            input.memoryProvider &&
            input.agentId
        ) {
            const createdAt =
                new Date().toISOString();

            await input.memoryProvider.saveMany([
                {
                    id: randomUUID(),

                    type: "run",

                    agentId:
                        input.agentId,

                    profileId:
                        input.profile.id,

                    profileVersion:
                        input.profile.version,

                    marketId:
                        input.market.id,

                    runId,

                    marketQuestion:
                        input.market.question,

                    research,

                    estimate,

                    decision,

                    executionPlan,

                    createdAt,
                },

                {
                    id: randomUUID(),

                    type: "decision",

                    agentId:
                        input.agentId,

                    profileId:
                        input.profile.id,

                    profileVersion:
                        input.profile.version,

                    marketId:
                        input.market.id,

                    runId,

                    marketQuestion:
                        input.market.question,

                    action:
                        decision.action,

                    probability:
                        decision.probability,

                    marketProbability:
                        decision.marketProbability,

                    confidence:
                        decision.confidence,

                    edge:
                        decision.edge,

                    amountUsdc:
                        decision.amountUsdc,

                    reasoning:
                        decision.reasoning,

                    keyFactors:
                        decision.keyFactors,

                    risks:
                        decision.risks,

                    riskChecks:
                        decision.riskChecks,

                    researchCostUsdc:
                        decision.researchCostUsdc,

                    createdAt,
                },
            ]);
        }

        const completedAt =
            new Date().toISOString();

        return {
            runId,

            profileId:
                input.profile.id,

            profileVersion:
                input.profile.version,

            marketId:
                input.market.id,

            startedAt,

            completedAt,

            status:
                decision.action === "PASS" &&
                    decision.riskChecks.some(
                        (check) => !check.passed,
                    )
                    ? "rejected"
                    : "completed",

            research,

            estimate,

            decision,

            executionPlan,

            metadata: {
                ...(input.metadata ?? {}),

                dryRun:
                    config.dryRun ?? false,

                allowTrading:
                    config.allowTrading !== false,
            },
        };
    } catch (error) {
        const completedAt =
            new Date().toISOString();

        const message =
            error instanceof Error
                ? error.message
                : "Unknown agent runtime error.";

        return {
            runId,

            profileId:
                input.profile?.id ??
                "unknown",

            profileVersion:
                input.profile?.version ??
                "unknown",

            marketId:
                input.market?.id ??
                "unknown",

            startedAt,

            completedAt,

            status: "failed",

            error: {
                message,
            },

            ...(input.metadata !== undefined
                ? {
                    metadata:
                        input.metadata,
                }
                : {}),
        };
    }
}

export const executeAgent =
    runAgentRuntime;