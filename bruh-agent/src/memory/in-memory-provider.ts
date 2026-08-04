import {
    calculateAgentPerformance,
} from "./performance";

import {
    AgentMemoryError,
    type AgentMemoryProvider,
} from "./memory-provider";

import type {
    AgentDecisionMemory,
    AgentMemory,
    AgentMemoryContext,
    AgentMemoryQuery,
    AgentPerformanceSummary,
    AgentReflectionMemory,
    AgentResolutionMemory,
    AgentRunMemory,
    AgentTradeMemory,
} from "./types";

export class InMemoryAgentMemoryProvider
    implements AgentMemoryProvider {
    readonly id =
        "in-memory-agent-memory";

    private readonly memories =
        new Map<string, AgentMemory>();

    async save(
        memory: AgentMemory,
    ): Promise<void> {
        validateMemory(memory);

        this.memories.set(
            memory.id,
            cloneMemory(memory),
        );
    }

    async saveMany(
        memories: AgentMemory[],
    ): Promise<void> {
        for (const memory of memories) {
            await this.save(memory);
        }
    }

    async find(
        query: AgentMemoryQuery,
    ): Promise<AgentMemory[]> {
        const limit =
            query.limit ?? 50;

        const newestFirst =
            query.newestFirst ?? true;

        const results = [
            ...this.memories.values(),
        ]
            .filter((memory) =>
                matchesQuery(
                    memory,
                    query,
                ),
            )
            .sort((first, second) => {
                const difference =
                    Date.parse(
                        first.createdAt,
                    ) -
                    Date.parse(
                        second.createdAt,
                    );

                return newestFirst
                    ? -difference
                    : difference;
            })
            .slice(0, limit)
            .map(cloneMemory);

        return results;
    }

    async getById(
        memoryId: string,
    ): Promise<AgentMemory | null> {
        const memory =
            this.memories.get(memoryId);

        return memory
            ? cloneMemory(memory)
            : null;
    }

    async getRunMemory(
        runId: string,
    ): Promise<AgentRunMemory | null> {
        const memory = [
            ...this.memories.values(),
        ].find(
            (
                item,
            ): item is AgentRunMemory =>
                item.type === "run" &&
                item.runId === runId,
        );

        return memory
            ? cloneMemory(memory)
            : null;
    }

    async getTradeByExecutionPlan(
        executionPlanId: string,
    ): Promise<AgentTradeMemory | null> {
        const memory = [
            ...this.memories.values(),
        ].find(
            (
                item,
            ): item is AgentTradeMemory =>
                item.type === "trade" &&
                item.executionPlanId ===
                executionPlanId,
        );

        return memory
            ? cloneMemory(memory)
            : null;
    }

    async updateTrade(
        executionPlanId: string,
        updates: Partial<AgentTradeMemory>,
    ): Promise<AgentTradeMemory> {
        const existing =
            await this.getTradeByExecutionPlan(
                executionPlanId,
            );

        if (!existing) {
            throw new AgentMemoryError({
                code:
                    "TRADE_MEMORY_NOT_FOUND",

                message:
                    `No trade memory exists for execution plan ${executionPlanId}.`,
            });
        }

        const updated: AgentTradeMemory = {
            ...existing,

            ...updates,

            id: existing.id,

            type: "trade",

            executionPlanId:
                existing.executionPlanId,

            updatedAt:
                new Date().toISOString(),
        };

        await this.save(updated);

        return updated;
    }

    async saveResolution(
        resolution: AgentResolutionMemory,
    ): Promise<void> {
        await this.save(resolution);
    }

    async saveReflection(
        reflection: AgentReflectionMemory,
    ): Promise<void> {
        await this.save(reflection);
    }

    async getContext(input: {
        agentId: string;
        profileId?: string;
        marketId?: string;
        limit?: number;
    }): Promise<AgentMemoryContext> {
        const memories =
            await this.find({
                agentId:
                    input.agentId,

                ...(input.profileId
                    ? {
                        profileId:
                            input.profileId,
                    }
                    : {}),

                ...(input.marketId
                    ? {
                        marketId:
                            input.marketId,
                    }
                    : {}),

                limit:
                    input.limit ?? 20,

                newestFirst: true,
            });

        const recentRuns =
            memories.filter(
                (
                    memory,
                ): memory is AgentRunMemory =>
                    memory.type === "run",
            );

        const recentDecisions =
            memories.filter(
                (
                    memory,
                ): memory is AgentDecisionMemory =>
                    memory.type ===
                    "decision",
            );

        const recentTrades =
            memories.filter(
                (
                    memory,
                ): memory is AgentTradeMemory =>
                    memory.type === "trade",
            );

        const recentResolutions =
            memories.filter(
                (
                    memory,
                ): memory is AgentResolutionMemory =>
                    memory.type ===
                    "resolution",
            );

        const recentReflections =
            memories.filter(
                (
                    memory,
                ): memory is AgentReflectionMemory =>
                    memory.type ===
                    "reflection",
            );

        return {
            recentRuns,

            recentDecisions,

            recentTrades,

            recentResolutions,

            recentReflections,

            summary:
                buildMemoryContextSummary({
                    recentDecisions,
                    recentTrades,
                    recentResolutions,
                    recentReflections,
                }),
        };
    }

    async getPerformance(
        agentId: string,
        profileId?: string,
    ): Promise<AgentPerformanceSummary> {
        return calculateAgentPerformance({
            agentId,

            ...(profileId
                ? { profileId }
                : {}),

            memories: [
                ...this.memories.values(),
            ],
        });
    }

    async delete(
        memoryId: string,
    ): Promise<void> {
        this.memories.delete(memoryId);
    }

    async clearAgent(
        agentId: string,
    ): Promise<void> {
        for (const [
            id,
            memory,
        ] of this.memories.entries()) {
            if (
                memory.agentId === agentId
            ) {
                this.memories.delete(id);
            }
        }
    }
}

function matchesQuery(
    memory: AgentMemory,
    query: AgentMemoryQuery,
): boolean {
    if (
        query.agentId &&
        memory.agentId !== query.agentId
    ) {
        return false;
    }

    if (
        query.profileId &&
        memory.profileId !==
        query.profileId
    ) {
        return false;
    }

    if (
        query.marketId &&
        memory.marketId !== query.marketId
    ) {
        return false;
    }

    if (
        query.runId &&
        memory.runId !== query.runId
    ) {
        return false;
    }

    if (
        query.types?.length &&
        !query.types.includes(memory.type)
    ) {
        return false;
    }

    const createdAt =
        Date.parse(memory.createdAt);

    if (
        query.from &&
        createdAt <
        Date.parse(query.from)
    ) {
        return false;
    }

    if (
        query.to &&
        createdAt >
        Date.parse(query.to)
    ) {
        return false;
    }

    return true;
}

function validateMemory(
    memory: AgentMemory,
): void {
    if (!memory.id?.trim()) {
        throw new AgentMemoryError({
            code: "MISSING_MEMORY_ID",
            message:
                "Agent memory requires an ID.",
        });
    }

    if (!memory.agentId?.trim()) {
        throw new AgentMemoryError({
            code:
                "MISSING_MEMORY_AGENT_ID",
            message:
                "Agent memory requires an agent ID.",
        });
    }

    if (!memory.marketId?.trim()) {
        throw new AgentMemoryError({
            code:
                "MISSING_MEMORY_MARKET_ID",
            message:
                "Agent memory requires a market ID.",
        });
    }
}

function buildMemoryContextSummary({
    recentDecisions,
    recentTrades,
    recentResolutions,
    recentReflections,
}: {
    recentDecisions: AgentDecisionMemory[];
    recentTrades: AgentTradeMemory[];
    recentResolutions: AgentResolutionMemory[];
    recentReflections: AgentReflectionMemory[];
}): string {
    const parts: string[] = [];

    if (recentDecisions.length > 0) {
        parts.push(
            `${recentDecisions.length} recent decisions`,
        );
    }

    if (recentTrades.length > 0) {
        parts.push(
            `${recentTrades.length} recent trades`,
        );
    }

    if (
        recentResolutions.length > 0
    ) {
        const pnl =
            recentResolutions.reduce(
                (total, resolution) =>
                    total +
                    resolution.pnlUsdc,
                0,
            );

        parts.push(
            `${recentResolutions.length} resolved outcomes with ${pnl.toFixed(
                2,
            )} USDC PnL`,
        );
    }

    if (
        recentReflections.length > 0
    ) {
        const lessons =
            recentReflections.flatMap(
                (reflection) =>
                    reflection.lessons,
            );

        if (lessons.length > 0) {
            parts.push(
                `Recent lessons: ${lessons
                    .slice(0, 3)
                    .join("; ")}`,
            );
        }
    }

    return parts.length > 0
        ? parts.join(". ")
        : "No previous agent memory is available.";
}

function cloneMemory<T extends AgentMemory>(
    memory: T,
): T {
    return structuredClone(memory);
}