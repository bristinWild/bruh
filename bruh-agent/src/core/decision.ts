import type { AgentAction, AgentDecision, AgentEstimate, AgentMarket, AgentResearchResult, AgentRuntimeConfig, } from "./types";
import { evaluateRisk } from "./risk";
import { calculatePositionSize } from "./sizing";

export interface BuildDecisionInput {
    market: AgentMarket;

    estimate: AgentEstimate;

    research: AgentResearchResult;

    config: AgentRuntimeConfig;
}

function clampProbability(
    probability: number,
): number {
    return Math.min(
        Math.max(probability, 0.01),
        0.99,
    );
}

function resolveAction(
    probability: number,
    marketProbability: number,
    edgeThreshold: number,
    recommendedAction?: AgentAction,
): AgentAction {
    const edge =
        probability - marketProbability;

    const derivedAction: AgentAction =
        edge >= edgeThreshold
            ? "BUY_YES"
            : edge <= -edgeThreshold
                ? "BUY_NO"
                : "PASS";

    if (!recommendedAction) {
        return derivedAction;
    }

    if (recommendedAction === "PASS") {
        return "PASS";
    }

    if (
        recommendedAction === derivedAction
    ) {
        return recommendedAction;
    }

    return derivedAction;
}

export function buildAgentDecision(
    input: BuildDecisionInput,
): AgentDecision {
    const probability = clampProbability(
        input.estimate.probability,
    );

    const marketProbability =
        clampProbability(input.market.yesPrice);

    const rawEdge =
        probability - marketProbability;

    const action = resolveAction(
        probability,
        marketProbability,
        input.config.edgeThreshold,
        input.estimate.recommendedAction,
    );

    const selectedEdge =
        action === "BUY_NO"
            ? -rawEdge
            : action === "BUY_YES"
                ? rawEdge
                : Math.abs(rawEdge);

    const sizing = calculatePositionSize({
        action,

        probability,

        marketProbability,

        confidence: input.estimate.confidence,

        availableBalanceUsdc:
            input.config.availableBalanceUsdc,

        kellyFraction:
            input.config.kellyFraction,

        maxPositionUsdc:
            input.config.maxPositionUsdc,

        currentMarketExposureUsdc:
            input.config.currentMarketExposureUsdc,

        maximumMarketExposureUsdc:
            input.config
                .maximumMarketExposureUsdc,
    });

    const risk = evaluateRisk({
        action,

        probability,

        confidence: input.estimate.confidence,

        marketProbability,

        edge: selectedEdge,

        proposedAmountUsdc:
            sizing.amountUsdc,

        researchCostUsdc:
            input.research.costUsdc,

        config: input.config,
    });

    const approvedAction: AgentAction =
        risk.approved ? action : "PASS";

    const shouldExecute =
        approvedAction !== "PASS" &&
        input.config.dryRun !== true &&
        input.config.allowTrading !== false;

    return {
        action: approvedAction,

        probability,

        confidence:
            input.estimate.confidence,

        marketProbability,

        edge: rawEdge,

        amountUsdc:
            approvedAction === "PASS"
                ? 0
                : sizing.amountUsdc,

        reasoning: input.estimate.reasoning,

        keyFactors:
            input.estimate.keyFactors ?? [],

        risks: input.estimate.risks ?? [],

        researchCostUsdc:
            input.research.costUsdc,

        shouldExecute,

        riskChecks: risk.checks,

        metadata: {
            requestedAction: action,

            sizing: {
                fullKellyFraction:
                    sizing.fullKellyFraction,

                adjustedKellyFraction:
                    sizing.adjustedKellyFraction,

                reason: sizing.reason,
            },

            rejectedBy: risk.rejectedBy ?? [],

            dryRun: input.config.dryRun ?? false,
        },
    };
}