import type {
    AgentDecisionMemory,
    AgentMemory,
    AgentPerformanceSummary,
    AgentResolutionMemory,
    AgentRunMemory,
    AgentTradeMemory,
} from "./types";

export function calculateAgentPerformance({
    agentId,
    profileId,
    memories,
}: {
    agentId: string;
    profileId?: string;
    memories: AgentMemory[];
}): AgentPerformanceSummary {
    const scoped = memories.filter(
        (memory) =>
            memory.agentId === agentId &&
            (!profileId ||
                memory.profileId === profileId),
    );

    const runs = scoped.filter(
        (
            memory,
        ): memory is AgentRunMemory =>
            memory.type === "run",
    );

    const decisions = scoped.filter(
        (
            memory,
        ): memory is AgentDecisionMemory =>
            memory.type === "decision",
    );

    const trades = scoped.filter(
        (
            memory,
        ): memory is AgentTradeMemory =>
            memory.type === "trade",
    );

    const resolutions = scoped.filter(
        (
            memory,
        ): memory is AgentResolutionMemory =>
            memory.type === "resolution",
    );

    const resolvedTrades =
        resolutions.filter(
            (resolution) =>
                resolution.won !== null,
        );

    const winningTrades =
        resolvedTrades.filter(
            (resolution) =>
                resolution.won === true,
        );

    const losingTrades =
        resolvedTrades.filter(
            (resolution) =>
                resolution.won === false,
        );

    const totalVolumeUsdc =
        trades
            .filter(
                (trade) =>
                    trade.executionStatus ===
                    "executed",
            )
            .reduce(
                (total, trade) =>
                    total + trade.amountUsdc,
                0,
            );

    const totalPnlUsdc =
        resolutions.reduce(
            (total, resolution) =>
                total + resolution.pnlUsdc,
            0,
        );

    const averageConfidence =
        average(
            decisions.map(
                (decision) =>
                    decision.confidence,
            ),
        );

    const averageEdge =
        average(
            decisions.map(
                (decision) =>
                    Math.abs(decision.edge),
            ),
        );

    const averageResearchCostUsdc =
        average(
            decisions.map(
                (decision) =>
                    decision.researchCostUsdc,
            ),
        );

    const averagePositionUsdc =
        average(
            trades.map(
                (trade) =>
                    trade.amountUsdc,
            ),
        );

    const pnlValues =
        resolutions.map(
            (resolution) =>
                resolution.pnlUsdc,
        );

    return {
        agentId,

        ...(profileId
            ? { profileId }
            : {}),

        totalRuns:
            runs.length,

        totalDecisions:
            decisions.length,

        totalTrades:
            trades.length,

        resolvedTrades:
            resolvedTrades.length,

        winningTrades:
            winningTrades.length,

        losingTrades:
            losingTrades.length,

        winRate:
            resolvedTrades.length > 0
                ? winningTrades.length /
                resolvedTrades.length
                : 0,

        totalVolumeUsdc,

        totalPnlUsdc,

        roi:
            totalVolumeUsdc > 0
                ? totalPnlUsdc /
                totalVolumeUsdc
                : 0,

        averageConfidence,

        averageEdge,

        averageResearchCostUsdc,

        averagePositionUsdc,

        bestTradePnlUsdc:
            pnlValues.length > 0
                ? Math.max(...pnlValues)
                : 0,

        worstTradePnlUsdc:
            pnlValues.length > 0
                ? Math.min(...pnlValues)
                : 0,

        lastUpdatedAt:
            new Date().toISOString(),
    };
}

function average(
    values: number[],
): number {
    if (values.length === 0) {
        return 0;
    }

    return (
        values.reduce(
            (total, value) =>
                total + value,
            0,
        ) / values.length
    );
}