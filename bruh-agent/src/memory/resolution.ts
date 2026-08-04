import { randomUUID } from "node:crypto";

import type {
    AgentAction,
} from "../core/types";

import type {
    AgentResolutionMemory,
    AgentRunMemory,
    AgentTradeMemory,
    MarketResolution,
} from "./types";

export interface RecordMarketResolutionInput {
    runMemory: AgentRunMemory;

    tradeMemory?: AgentTradeMemory;

    resolution: MarketResolution;

    resolvedAt?: string;

    metadata?: Record<string, unknown>;
}

export function createResolutionMemory(
    input: RecordMarketResolutionInput,
): AgentResolutionMemory {
    const {
        runMemory,
        tradeMemory,
        resolution,
    } = input;

    const action =
        runMemory.decision.action;

    const positionAmountUsdc =
        tradeMemory?.amountUsdc ??
        runMemory.decision.amountUsdc;

    const result =
        calculateResolutionResult({
            action,
            resolution,
            amountUsdc:
                positionAmountUsdc,

            marketProbability:
                runMemory.decision
                    .marketProbability,
        });

    return {
        id: randomUUID(),

        type: "resolution",

        agentId:
            runMemory.agentId,

        profileId:
            runMemory.profileId,

        profileVersion:
            runMemory.profileVersion,

        marketId:
            runMemory.marketId,

        ...(runMemory.runId
            ? {
                runId:
                    runMemory.runId,
            }
            : {}),

        marketQuestion:
            runMemory.marketQuestion,

        resolution,

        resolvedAt:
            input.resolvedAt ??
            new Date().toISOString(),

        action,

        positionAmountUsdc,

        probability:
            runMemory.decision
                .probability,

        marketProbability:
            runMemory.decision
                .marketProbability,

        confidence:
            runMemory.decision
                .confidence,

        pnlUsdc:
            result.pnlUsdc,

        returnUsdc:
            result.returnUsdc,

        won:
            result.won,

        ...(tradeMemory
            ?.transactionHash
            ? {
                transactionHash:
                    tradeMemory
                        .transactionHash,
            }
            : {}),

        createdAt:
            new Date().toISOString(),

        metadata: {
            ...(runMemory.metadata ?? {}),
            ...(tradeMemory?.metadata ??
                {}),
            ...(input.metadata ?? {}),

            executionPlanId:
                tradeMemory
                    ?.executionPlanId ??
                runMemory.executionPlan.id,

            tradeExecutionStatus:
                tradeMemory
                    ?.executionStatus,
        },
    };
}

function calculateResolutionResult({
    action,
    resolution,
    amountUsdc,
    marketProbability,
}: {
    action: AgentAction;

    resolution: MarketResolution;

    amountUsdc: number;

    marketProbability: number;
}): {
    won: boolean | null;

    returnUsdc: number;

    pnlUsdc: number;
} {
    if (
        resolution === "INVALID" ||
        resolution === "CANCELLED"
    ) {
        return {
            won: null,

            returnUsdc:
                amountUsdc,

            pnlUsdc: 0,
        };
    }

    if (
        action === "PASS" ||
        amountUsdc <= 0
    ) {
        return {
            won: null,

            returnUsdc: 0,

            pnlUsdc: 0,
        };
    }

    const won =
        (action === "BUY_YES" &&
            resolution === "YES") ||
        (action === "BUY_NO" &&
            resolution === "NO");

    if (!won) {
        return {
            won: false,

            returnUsdc: 0,

            pnlUsdc:
                -amountUsdc,
        };
    }

    const selectedPrice =
        action === "BUY_YES"
            ? marketProbability
            : 1 - marketProbability;

    if (
        selectedPrice <= 0 ||
        selectedPrice >= 1
    ) {
        return {
            won: true,

            returnUsdc:
                amountUsdc,

            pnlUsdc: 0,
        };
    }

    const returnUsdc =
        amountUsdc /
        selectedPrice;

    return {
        won: true,

        returnUsdc:
            Number(
                returnUsdc.toFixed(6),
            ),

        pnlUsdc:
            Number(
                (
                    returnUsdc -
                    amountUsdc
                ).toFixed(6),
            ),
    };
}