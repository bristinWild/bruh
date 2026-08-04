import type { AgentAction, AgentRuntimeConfig, RiskCheckResult, RiskEvaluation, } from "./types";

export interface RiskEvaluationInput {
    action: AgentAction;

    probability: number;

    confidence: number;

    marketProbability: number;

    edge: number;

    proposedAmountUsdc: number;

    researchCostUsdc: number;

    config: AgentRuntimeConfig;
}

function createCheck(
    id: string,
    passed: boolean,
    message: string,
    value?: number,
    limit?: number,
): RiskCheckResult {
    return {
        id,
        passed,
        message,
        value,
        limit,
    };
}

export function evaluateRisk(
    input: RiskEvaluationInput,
): RiskEvaluation {
    const checks: RiskCheckResult[] = [];

    checks.push(
        createCheck(
            "trading-enabled",
            input.config.allowTrading !== false,
            input.config.allowTrading === false
                ? "Trading is disabled for this agent."
                : "Trading is enabled.",
        ),
    );

    checks.push(
        createCheck(
            "valid-probability",
            input.probability > 0 &&
            input.probability < 1,
            "The probability estimate must be between 0 and 1.",
            input.probability,
        ),
    );

    checks.push(
        createCheck(
            "minimum-confidence",
            input.confidence >=
            (input.config.minimumConfidence ?? 0),
            input.confidence >=
                (input.config.minimumConfidence ?? 0)
                ? "Confidence meets the configured minimum."
                : "Confidence is below the configured minimum.",
            input.confidence,
            input.config.minimumConfidence ?? 0,
        ),
    );

    if (input.action !== "PASS") {
        checks.push(
            createCheck(
                "minimum-edge",
                Math.abs(input.edge) >=
                input.config.edgeThreshold,
                Math.abs(input.edge) >=
                    input.config.edgeThreshold
                    ? "The estimated edge meets the threshold."
                    : "The estimated edge is below the threshold.",
                Math.abs(input.edge),
                input.config.edgeThreshold,
            ),
        );

        checks.push(
            createCheck(
                "positive-position",
                input.proposedAmountUsdc > 0,
                input.proposedAmountUsdc > 0
                    ? "The proposed position is greater than zero."
                    : "The proposed position is zero.",
                input.proposedAmountUsdc,
            ),
        );

        checks.push(
            createCheck(
                "position-limit",
                input.proposedAmountUsdc <=
                input.config.maxPositionUsdc,
                input.proposedAmountUsdc <=
                    input.config.maxPositionUsdc
                    ? "The position is within the configured limit."
                    : "The position exceeds the configured maximum.",
                input.proposedAmountUsdc,
                input.config.maxPositionUsdc,
            ),
        );

        checks.push(
            createCheck(
                "available-balance",
                input.proposedAmountUsdc <=
                input.config.availableBalanceUsdc,
                input.proposedAmountUsdc <=
                    input.config.availableBalanceUsdc
                    ? "The agent has enough available balance."
                    : "The proposed position exceeds the available balance.",
                input.proposedAmountUsdc,
                input.config.availableBalanceUsdc,
            ),
        );
    }

    checks.push(
        createCheck(
            "research-budget",
            input.researchCostUsdc <=
            input.config.researchBudgetUsdc,
            input.researchCostUsdc <=
                input.config.researchBudgetUsdc
                ? "Research spending is within budget."
                : "Research spending exceeds the configured budget.",
            input.researchCostUsdc,
            input.config.researchBudgetUsdc,
        ),
    );

    if (
        typeof input.config.maxDailyLossUsdc ===
        "number"
    ) {
        const dailyProfitLoss =
            input.config.dailyProfitLossUsdc ?? 0;

        checks.push(
            createCheck(
                "daily-loss-limit",
                dailyProfitLoss >
                -input.config.maxDailyLossUsdc,
                dailyProfitLoss >
                    -input.config.maxDailyLossUsdc
                    ? "The agent remains within its daily loss limit."
                    : "The daily loss limit has been reached.",
                dailyProfitLoss,
                -input.config.maxDailyLossUsdc,
            ),
        );
    }

    if (
        input.action !== "PASS" &&
        typeof input.config
            .maximumMarketExposureUsdc === "number"
    ) {
        const projectedExposure =
            (input.config.currentMarketExposureUsdc ??
                0) + input.proposedAmountUsdc;

        checks.push(
            createCheck(
                "market-exposure-limit",
                projectedExposure <=
                input.config
                    .maximumMarketExposureUsdc,
                projectedExposure <=
                    input.config
                        .maximumMarketExposureUsdc
                    ? "Projected market exposure is within the configured limit."
                    : "Projected market exposure exceeds the configured limit.",
                projectedExposure,
                input.config.maximumMarketExposureUsdc,
            ),
        );
    }

    const failedChecks = checks.filter(
        (check) => !check.passed,
    );

    return {
        approved: failedChecks.length === 0,

        checks,

        rejectedBy: failedChecks.map(
            (check) => check.id,
        ),
    };
}