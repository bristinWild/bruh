import { Injectable, Logger } from "@nestjs/common";
import { randomUUID, } from "node:crypto";
import { CircleService, } from "../circle.service";
import { validateExecutionPlan, } from "./execution.validator";
import { withRetry, } from "./retry";
import type { ExecutePlanInput, ExecutionAdapter, ExecutionReceipt, } from "./execution.types";


@Injectable()
export class CircleMarketExecutor
    implements ExecutionAdapter {
    readonly id =
        "circle-market-executor";

    private readonly logger =
        new Logger(
            CircleMarketExecutor.name,
        );

    constructor(
        private readonly circle:
            CircleService,
    ) { }

    async execute(
        input: ExecutePlanInput,
    ): Promise<ExecutionReceipt> {
        validateExecutionPlan(
            input.plan,
        );

        if (
            input.plan.action !== "BUY_YES" &&
            input.plan.action !== "BUY_NO"
        ) {
            throw new Error(
                "Only BUY_YES and BUY_NO plans can be executed.",
            );
        }

        const action:
            "BUY_YES" | "BUY_NO" =
            input.plan.action;

            const side:
    "YES" | "NO" =
    action === "BUY_YES"
        ? "YES"
        : "NO";

        const submittedAt =
            new Date().toISOString();

        const tokenDecimals =
            input.tokenDecimals ?? 6;

        const amountAtomic =
            toAtomicUnits(
                input.plan.amountUsdc,
                tokenDecimals,
            );

        const isYes =
            input.plan.action ===
            "BUY_YES";

        let approvalTransactionId:
            | string
            | undefined;

        let approvalTransactionHash:
            | string
            | undefined;

        let tradeTransactionId:
            | string
            | undefined;

        let attempts = 0;

        try {
            const approvalSubmission =
                await withRetry(
                    async (attempt) => {
                        attempts += 1;

                        this.logger.log(
                            `Submitting USDC approval for execution plan ${input.plan.id}; attempt ${attempt}.`,
                        );

                        const response =
                            await this.circle
                                .executeContractCall(
                                    input.circleWalletId,

                                    input.usdcAddress,

                                    "approve(address,uint256)",

                                    [
                                        input.marketAddress,

                                        amountAtomic,
                                    ],
                                );

                        if (!response?.id) {
                            throw new Error(
                                "Circle did not return an approval transaction ID.",
                            );
                        }

                        return response;
                    },
                    {
                        maximumAttempts: 3,

                        initialDelayMs: 500,

                        maximumDelayMs: 3_000,

                        multiplier: 2,

                        shouldRetry:
                            isRetryableSubmissionError,
                    },
                );

            approvalTransactionId =
                approvalSubmission.value.id;

            if (!approvalTransactionId) {
                throw new Error(
                    "Approval transaction ID missing.",
                );
            }

            const approvalResult =
                await this.circle.waitForTransactionResult(
                    approvalTransactionId,
                );

            approvalTransactionHash =
                approvalResult.txHash;

            const tradeSubmission =
                await withRetry(
                    async (attempt) => {
                        attempts += 1;

                        this.logger.log(
                            `Submitting market purchase for execution plan ${input.plan.id}; attempt ${attempt}.`,
                        );

                        const response =
                            await this.circle
                                .executeContractCall(
                                    input.circleWalletId,

                                    input.marketAddress,

                                    "buy(bool,uint256,uint256)",

                                    [
                                        isYes,

                                        amountAtomic,

                                        (
                                            input.minimumSharesOut ??
                                            0n
                                        ).toString(),
                                    ],
                                );

                        if (!response?.id) {
                            throw new Error(
                                "Circle did not return a trade transaction ID.",
                            );
                        }

                        return response;
                    },
                    {
                        maximumAttempts: 3,

                        initialDelayMs: 500,

                        maximumDelayMs: 3_000,

                        multiplier: 2,

                        shouldRetry:
                            isRetryableSubmissionError,
                    },
                );

            tradeTransactionId =
                tradeSubmission.value.id;

            if (!tradeTransactionId) {
                throw new Error(
                    "Trade transaction ID missing.",
                );
            }

            const tradeResult =
                await this.circle.waitForTransactionResult(
                    tradeTransactionId,
                );

            return {
                id: randomUUID(),

                executionPlanId:
                    input.plan.id,

                runId:
                    input.plan.runId,

                ...(input.plan.agentId
                    ? {
                        agentId:
                            input.plan
                                .agentId,
                    }
                    : {}),

                profileId:
                    input.plan.profileId,

                marketId:
                    input.plan.marketId,

                circleWalletId:
                    input.circleWalletId,

                ...(input.plan.walletAddress
                    ? {
                        walletAddress:
                            input.plan
                                .walletAddress,
                    }
                    : {}),

                network:
                    input.plan.network,

                action,

               side,

                amountUsdc:
                    input.plan.amountUsdc,

                amountAtomic,

                approvalTransactionId,

                ...(approvalTransactionHash
                    ? {
                        approvalTransactionHash,
                    }
                    : {}),

                tradeTransactionId,

                ...(tradeResult.txHash
                    ? {
                        tradeTransactionHash:
                            tradeResult
                                .txHash,
                    }
                    : {}),

                status: "confirmed",

                attempts,

                submittedAt,

                confirmedAt:
                    new Date()
                        .toISOString(),

                metadata: {
                    executor: this.id,

                    marketAddress:
                        input.marketAddress,

                    usdcAddress:
                        input.usdcAddress,
                },
            };
        } catch (error) {
            this.logger.error(
                `Execution plan ${input.plan.id} failed.`,

                error instanceof Error
                    ? error.stack
                    : String(error),
            );

            return {
                id: randomUUID(),

                executionPlanId:
                    input.plan.id,

                runId:
                    input.plan.runId,

                ...(input.plan.agentId
                    ? {
                        agentId:
                            input.plan
                                .agentId,
                    }
                    : {}),

                profileId:
                    input.plan.profileId,

                marketId:
                    input.plan.marketId,

                circleWalletId:
                    input.circleWalletId,

                ...(input.plan.walletAddress
                    ? {
                        walletAddress:
                            input.plan
                                .walletAddress,
                    }
                    : {}),

                network:
                    input.plan.network,

                action,

               side,

                amountUsdc:
                    input.plan.amountUsdc,

                amountAtomic,

                ...(approvalTransactionId
                    ? {
                        approvalTransactionId,
                    }
                    : {}),

                ...(approvalTransactionHash
                    ? {
                        approvalTransactionHash,
                    }
                    : {}),

                ...(tradeTransactionId
                    ? {
                        tradeTransactionId,
                    }
                    : {}),

                status: "failed",

                attempts,

                submittedAt,

                failedAt:
                    new Date()
                        .toISOString(),

                errorCode:
                    resolveExecutionErrorCode(
                        error,
                    ),

                errorMessage:
                    error instanceof Error
                        ? error.message
                        : "Unknown execution error.",

                metadata: {
                    executor: this.id,

                    marketAddress:
                        input.marketAddress,

                    usdcAddress:
                        input.usdcAddress,
                },
            };
        }
    }
}

function toAtomicUnits(
    amount: number,
    decimals: number,
): string {
    if (
        !Number.isFinite(amount) ||
        amount <= 0
    ) {
        throw new Error(
            "USDC amount must be greater than zero.",
        );
    }

    if (
        !Number.isInteger(decimals) ||
        decimals < 0
    ) {
        throw new Error(
            "Token decimals must be a non-negative integer.",
        );
    }

    const fixed =
        amount.toFixed(decimals);

    const [
        whole,
        fraction = "",
    ] = fixed.split(".");

    const atomic =
        `${whole}${fraction.padEnd(
            decimals,
            "0",
        )}`.replace(/^0+(?=\d)/, "");

    return BigInt(
        atomic || "0",
    ).toString();
}

function isRetryableSubmissionError(
    error: unknown,
): boolean {
    if (!(error instanceof Error)) {
        return false;
    }

    const message =
        error.message.toLowerCase();

    return (
        message.includes("timeout") ||
        message.includes("network") ||
        message.includes("socket") ||
        message.includes("rate") ||
        message.includes("429") ||
        message.includes("500") ||
        message.includes("502") ||
        message.includes("503") ||
        message.includes("504")
    );
}

function resolveExecutionErrorCode(
    error: unknown,
): string {
    if (!(error instanceof Error)) {
        return "UNKNOWN_EXECUTION_ERROR";
    }

    const message =
        error.message.toLowerCase();

    if (
        message.includes("expired")
    ) {
        return "EXECUTION_PLAN_EXPIRED";
    }

    if (
        message.includes("balance")
    ) {
        return "INSUFFICIENT_BALANCE";
    }

    if (
        message.includes("approval")
    ) {
        return "USDC_APPROVAL_FAILED";
    }

    if (
        message.includes("timeout") ||
        message.includes(
            "did not confirm",
        )
    ) {
        return "CIRCLE_TRANSACTION_TIMEOUT";
    }

    if (
        message.includes("denied")
    ) {
        return "CIRCLE_TRANSACTION_DENIED";
    }

    if (
        message.includes("cancelled")
    ) {
        return "CIRCLE_TRANSACTION_CANCELLED";
    }

    return "CIRCLE_EXECUTION_FAILED";
}