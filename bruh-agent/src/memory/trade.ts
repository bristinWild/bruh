import { randomUUID } from "node:crypto";

import type {
    ExecutionPlan,
} from "../core/types";

import type {
    AgentTradeMemory,
} from "./types";

export interface CreatePendingTradeMemoryInput {
    executionPlan: ExecutionPlan;

    createdAt?: string;

    metadata?: Record<string, unknown>;
}

export interface RecordTradeExecutionInput {
    transactionHash: string;

    executedAt?: string;

    walletAddress?: string;

    network?: string;

    metadata?: Record<string, unknown>;
}

export interface RecordTradeFailureInput {
    failureReason: string;

    failedAt?: string;

    metadata?: Record<string, unknown>;
}

export function createPendingTradeMemory(
    input: CreatePendingTradeMemoryInput,
): AgentTradeMemory {
    const plan = input.executionPlan;

    if (
        plan.action === "PASS" ||
        !plan.side
    ) {
        throw new Error(
            "Cannot create trade memory from a PASS execution plan.",
        );
    }

    return {
        id: randomUUID(),

        type: "trade",

        agentId:
            plan.agentId ??
            plan.profileId,

        profileId:
            plan.profileId,

        profileVersion:
            plan.profileVersion,

        marketId:
            plan.marketId,

        runId:
            plan.runId,

        executionPlanId:
            plan.id,

        marketQuestion:
            plan.marketQuestion,

        action:
            plan.action,

        side:
            plan.side,

        amountUsdc:
            plan.amountUsdc,

        executionStatus:
            "pending",

        ...(plan.walletAddress
            ? {
                walletAddress:
                    plan.walletAddress,
            }
            : {}),

        ...(plan.network
            ? {
                network:
                    plan.network,
            }
            : {}),

        createdAt:
            input.createdAt ??
            new Date().toISOString(),

        metadata: {
            ...(plan.metadata ?? {}),
            ...(input.metadata ?? {}),

            executionPlanStatus:
                plan.status,

            expectedProfitUsdc:
                plan.expectedProfitUsdc,

            expectedReturnUsdc:
                plan.expectedReturnUsdc,

            confidence:
                plan.confidence,

            edge:
                plan.edge,
        },
    };
}

export function markTradeExecuting(
    trade: AgentTradeMemory,
): AgentTradeMemory {
    assertMutableTrade(trade);

    return {
        ...trade,

        executionStatus:
            "executing",

        updatedAt:
            new Date().toISOString(),
    };
}

export function markTradeExecuted(
    trade: AgentTradeMemory,
    input: RecordTradeExecutionInput,
): AgentTradeMemory {
    assertMutableTrade(trade);

    if (!input.transactionHash.trim()) {
        throw new Error(
            "Executed trade requires a transaction hash.",
        );
    }

    const executedAt =
        input.executedAt ??
        new Date().toISOString();

    return {
        ...trade,

        executionStatus:
            "executed",

        transactionHash:
            input.transactionHash,

        executedAt,

        ...(input.walletAddress
            ? {
                walletAddress:
                    input.walletAddress,
            }
            : {}),

        ...(input.network
            ? {
                network:
                    input.network,
            }
            : {}),

        updatedAt:
            executedAt,

        metadata: {
            ...(trade.metadata ?? {}),
            ...(input.metadata ?? {}),
        },
    };
}

export function markTradeFailed(
    trade: AgentTradeMemory,
    input: RecordTradeFailureInput,
): AgentTradeMemory {
    assertMutableTrade(trade);

    if (!input.failureReason.trim()) {
        throw new Error(
            "Failed trade requires a failure reason.",
        );
    }

    const failedAt =
        input.failedAt ??
        new Date().toISOString();

    return {
        ...trade,

        executionStatus:
            "failed",

        failureReason:
            input.failureReason,

        updatedAt:
            failedAt,

        metadata: {
            ...(trade.metadata ?? {}),
            ...(input.metadata ?? {}),

            failedAt,
        },
    };
}

export function markTradeRejected(
    trade: AgentTradeMemory,
    reason: string,
): AgentTradeMemory {
    assertMutableTrade(trade);

    return {
        ...trade,

        executionStatus:
            "rejected",

        failureReason:
            reason,

        updatedAt:
            new Date().toISOString(),
    };
}

function assertMutableTrade(
    trade: AgentTradeMemory,
): void {
    if (
        trade.executionStatus ===
        "executed" ||
        trade.executionStatus ===
        "failed" ||
        trade.executionStatus ===
        "rejected"
    ) {
        throw new Error(
            `Trade ${trade.id} is already in terminal state ${trade.executionStatus}.`,
        );
    }
}