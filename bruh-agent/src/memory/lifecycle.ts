import type {
    ExecutionPlan,
} from "../core/types";

import type {
    AgentMemoryProvider,
} from "./memory-provider";

import {
    createReflection,
    type ReflectionGenerator,
} from "./reflection";

import {
    createResolutionMemory,
} from "./resolution";

import {
    createPendingTradeMemory,
    markTradeExecuted,
    markTradeExecuting,
    markTradeFailed,
    markTradeRejected,
    type RecordTradeExecutionInput,
    type RecordTradeFailureInput,
} from "./trade";

import type {
    AgentReflectionMemory,
    AgentResolutionMemory,
    AgentTradeMemory,
    MarketResolution,
} from "./types";

export interface AgentMemoryLifecycle {
    createPendingTrade(
        executionPlan: ExecutionPlan,
        metadata?: Record<string, unknown>,
    ): Promise<AgentTradeMemory>;

    markExecuting(
        executionPlanId: string,
    ): Promise<AgentTradeMemory>;

    recordExecution(
        executionPlanId: string,
        input: RecordTradeExecutionInput,
    ): Promise<AgentTradeMemory>;

    recordFailure(
        executionPlanId: string,
        input: RecordTradeFailureInput,
    ): Promise<AgentTradeMemory>;

    recordRejection(
        executionPlanId: string,
        reason: string,
    ): Promise<AgentTradeMemory>;

    resolveMarket(input: {
        runId: string;

        resolution: MarketResolution;

        resolvedAt?: string;

        reflectionGenerator?: ReflectionGenerator;

        metadata?: Record<string, unknown>;
    }): Promise<{
        resolution:
        AgentResolutionMemory;

        reflection:
        AgentReflectionMemory;
    }>;
}

export function createAgentMemoryLifecycle(
    provider: AgentMemoryProvider,
): AgentMemoryLifecycle {
    return {
        async createPendingTrade(
            executionPlan,
            metadata,
        ) {
            const existing =
                await provider
                    .getTradeByExecutionPlan(
                        executionPlan.id,
                    );

            if (existing) {
                return existing;
            }

            const memory =
                createPendingTradeMemory({
                    executionPlan,

                    ...(metadata
                        ? { metadata }
                        : {}),
                });

            await provider.save(memory);

            return memory;
        },

        async markExecuting(
            executionPlanId,
        ) {
            const existing =
                await requireTrade(
                    provider,
                    executionPlanId,
                );

            const updated =
                markTradeExecuting(
                    existing,
                );

            await provider.save(updated);

            return updated;
        },

        async recordExecution(
            executionPlanId,
            input,
        ) {
            const existing =
                await requireTrade(
                    provider,
                    executionPlanId,
                );

            const updated =
                markTradeExecuted(
                    existing,
                    input,
                );

            await provider.save(updated);

            return updated;
        },

        async recordFailure(
            executionPlanId,
            input,
        ) {
            const existing =
                await requireTrade(
                    provider,
                    executionPlanId,
                );

            const updated =
                markTradeFailed(
                    existing,
                    input,
                );

            await provider.save(updated);

            return updated;
        },

        async recordRejection(
            executionPlanId,
            reason,
        ) {
            const existing =
                await requireTrade(
                    provider,
                    executionPlanId,
                );

            const updated =
                markTradeRejected(
                    existing,
                    reason,
                );

            await provider.save(updated);

            return updated;
        },

        async resolveMarket(input) {
            const runMemory =
                await provider
                    .getRunMemory(
                        input.runId,
                    );

            if (!runMemory) {
                throw new Error(
                    `Run memory ${input.runId} was not found.`,
                );
            }

            const tradeMemory =
                await provider
                    .getTradeByExecutionPlan(
                        runMemory
                            .executionPlan.id,
                    );

            const resolution =
                createResolutionMemory({
                    runMemory,

                    ...(tradeMemory
                        ? {
                            tradeMemory,
                        }
                        : {}),

                    resolution:
                        input.resolution,

                    ...(input.resolvedAt
                        ? {
                            resolvedAt:
                                input.resolvedAt,
                        }
                        : {}),

                    ...(input.metadata
                        ? {
                            metadata:
                                input.metadata,
                        }
                        : {}),
                });

            await provider.saveResolution(
                resolution,
            );

            const context =
                await provider.getContext({
                    agentId:
                        runMemory.agentId,

                    profileId:
                        runMemory.profileId,

                    limit: 20,
                });

            const reflection =
                await createReflection({
                    resolution,

                    ...(input
                        .reflectionGenerator
                        ? {
                            generator:
                                input.reflectionGenerator,
                        }
                        : {}),

                    previousLessons:
                        context.recentReflections.flatMap(
                            (item) =>
                                item.lessons,
                        ),
                });

            await provider.saveReflection(
                reflection,
            );

            return {
                resolution,
                reflection,
            };
        },
    };
}

async function requireTrade(
    provider: AgentMemoryProvider,
    executionPlanId: string,
): Promise<AgentTradeMemory> {
    const trade =
        await provider
            .getTradeByExecutionPlan(
                executionPlanId,
            );

    if (!trade) {
        throw new Error(
            `Trade memory for execution plan ${executionPlanId} was not found.`,
        );
    }

    return trade;
}