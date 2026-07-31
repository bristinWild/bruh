import { randomUUID } from "node:crypto";

import type {
    AgentDecision,
    AgentMarket,
    AgentProfile,
    AgentResearchResult,
    ExecutionPlan,
} from "./types";

export interface BuildExecutionPlanInput {
    runId: string;

    agentId?: string;

    profile: AgentProfile;

    market: AgentMarket;

    research: AgentResearchResult;

    decision: AgentDecision;

    walletAddress?: string;

    network?: string;

    expiresInSeconds?: number;

    metadata?: Record<string, unknown>;
}

export function buildExecutionPlan(
    input: BuildExecutionPlanInput,
): ExecutionPlan {
    const createdAt = new Date();

    const expiresAt = new Date(
        createdAt.getTime() +
        (input.expiresInSeconds ?? 300) * 1_000,
    );

    const expectedReturnUsdc =
        calculateExpectedReturnUsdc({
            action: input.decision.action,
            amountUsdc: input.decision.amountUsdc,
            estimatedProbability:
                input.decision.probability,
            marketProbability:
                input.decision.marketProbability,
        });

    const expectedProfitUsdc =
        expectedReturnUsdc -
        input.decision.amountUsdc;

    return {
        id: randomUUID(),

        runId: input.runId,

        agentId: input.agentId,

        profileId: input.profile.id,

        profileVersion: input.profile.version,

        marketId: input.market.id,

        marketQuestion: input.market.question,

        network:
            input.network ?? "eip155:5042002",

        walletAddress:
            input.walletAddress,

        action: input.decision.action,

        side:
            input.decision.action === "BUY_YES"
                ? "YES"
                : input.decision.action === "BUY_NO"
                    ? "NO"
                    : null,

        status:
            input.decision.shouldExecute
                ? "ready"
                : input.decision.action === "PASS"
                    ? "skipped"
                    : "simulation",

        amountUsdc:
            input.decision.amountUsdc,

        researchCostUsdc:
            input.decision.researchCostUsdc,

        estimatedProbability:
            input.decision.probability,

        marketProbability:
            input.decision.marketProbability,

        edge:
            input.decision.edge,

        confidence:
            input.decision.confidence,

        expectedReturnUsdc,
        expectedProfitUsdc,

        riskLevel:
            calculateRiskLevel(input.decision),

        reasoning:
            input.decision.reasoning,

        keyFactors:
            input.decision.keyFactors,

        risks:
            input.decision.risks,

        research: {
            summary: input.research.summary,

            sourceCount:
                input.research.evidence.length,

            sources:
                input.research.evidence.map(
                    (evidence) => ({
                        type: evidence.type,

                        title: evidence.title,

                        source: evidence.source,

                        url: evidence.url,

                        credibilityScore:
                            evidence.credibilityScore,
                    }),
                ),

            costUsdc:
                input.research.costUsdc,
        },

        riskChecks:
            input.decision.riskChecks,

        execution: {
            requiresApproval:
                !input.decision.shouldExecute,

            allowExecution:
                input.decision.shouldExecute,

            dryRun:
                input.decision.metadata?.dryRun ===
                true,

            expectedContract:
                input.market.metadata?.contractAddress
                    ? String(
                        input.market.metadata
                            .contractAddress,
                    )
                    : undefined,

            slippageBps: 100,

            deadline:
                expiresAt.toISOString(),
        },

        createdAt:
            createdAt.toISOString(),

        expiresAt:
            expiresAt.toISOString(),

        metadata: {
            ...input.metadata,

            decisionMetadata:
                input.decision.metadata,
        },
    };
}

function calculateRiskLevel(
    decision: AgentDecision,
): ExecutionPlan["riskLevel"] {
    const failedChecks =
        decision.riskChecks.filter(
            (check) => !check.passed,
        ).length;

    if (
        failedChecks > 0 ||
        decision.action === "PASS"
    ) {
        return "blocked";
    }

    if (
        decision.confidence >= 0.8 &&
        Math.abs(decision.edge) >= 0.15
    ) {
        return "medium";
    }

    if (
        decision.confidence >= 0.65 &&
        Math.abs(decision.edge) >= 0.08
    ) {
        return "medium";
    }

    return "high";
}

function calculateExpectedReturnUsdc({
    action,
    amountUsdc,
    estimatedProbability,
    marketProbability,
}: {
    action: AgentDecision["action"];
    amountUsdc: number;
    estimatedProbability: number;
    marketProbability: number;
}): number {
    if (
        action === "PASS" ||
        amountUsdc <= 0
    ) {
        return 0;
    }

    const selectedProbability =
        action === "BUY_YES"
            ? estimatedProbability
            : 1 - estimatedProbability;

    const selectedPrice =
        action === "BUY_YES"
            ? marketProbability
            : 1 - marketProbability;

    if (
        selectedPrice <= 0 ||
        selectedPrice >= 1
    ) {
        return 0;
    }

    const shares =
        amountUsdc / selectedPrice;

    return Number(
        (
            selectedProbability * shares
        ).toFixed(6),
    );
}