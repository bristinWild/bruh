import type {
    OnchainAnalyzeInput,
    OnchainAnalyzeResult,
    OnchainProvider,
    OnchainSignal,
} from "../core/types";
import {
    clamp,
    createResearchCacheKey,
    enforceResearchBudget,
    InMemoryResearchCache,
    ResearchProviderError,
    type ResearchProviderOptions,
    withTimeout,
} from "./research-provider";

export interface OnchainSourceResult {
    summary?: string;
    signals: OnchainSignal[];
    netExchangeFlowUsd?: number;
    netBridgeFlowUsd?: number;
    accumulationScore?: number;
    costUsdc?: number;
    provider?: string;
}

export interface OnchainSourceAdapter {
    readonly id: string;

    analyze(
        input: OnchainAnalyzeInput,
    ): Promise<OnchainSourceResult>;
}

export interface OnchainProviderOptions
    extends ResearchProviderOptions {
    adapters: OnchainSourceAdapter[];
    minimumConfidenceScore?: number;
}

export class DefaultOnchainProvider
    implements OnchainProvider {
    private readonly adapters: OnchainSourceAdapter[];

    private readonly timeoutMs: number;

    private readonly cacheTtlMs: number;

    private readonly maximumCostUsdc?: number;

    private readonly minimumConfidenceScore: number;

    private readonly cache =
        new InMemoryResearchCache();

    constructor(
        options: OnchainProviderOptions,
    ) {
        if (options.adapters.length === 0) {
            throw new Error(
                "DefaultOnchainProvider requires at least one onchain adapter.",
            );
        }

        this.adapters = options.adapters;

        this.timeoutMs =
            options.timeoutMs ?? 20_000;

        this.cacheTtlMs =
            options.cacheTtlMs ?? 2 * 60_000;

        this.maximumCostUsdc =
            options.maximumCostUsdc;

        this.minimumConfidenceScore =
            options.minimumConfidenceScore ?? 0;
    }

    async analyze(
        input: OnchainAnalyzeInput,
    ): Promise<OnchainAnalyzeResult> {
        validateOnchainInput(input);

        const cacheKey = createResearchCacheKey(
            "onchain",
            input,
        );

        const cached =
            this.cache.get<OnchainAnalyzeResult>(
                cacheKey,
            );

        if (cached) {
            return cached;
        }

        const settledResults =
            await Promise.allSettled(
                this.adapters.map((adapter) =>
                    withTimeout(
                        adapter.analyze(input),
                        this.timeoutMs,
                        "onchain",
                    ),
                ),
            );

        const results = settledResults
            .filter(
                (
                    result,
                ): result is PromiseFulfilledResult<OnchainSourceResult> =>
                    result.status === "fulfilled",
            )
            .map((result) => result.value);

        if (results.length === 0) {
            throw new ResearchProviderError({
                provider: "onchain",
                code:
                    "ALL_ONCHAIN_ADAPTERS_FAILED",
                message:
                    "Every configured onchain adapter failed.",
            });
        }

        const signals = deduplicateSignals(
            results
                .flatMap((result) => result.signals)
                .map(normalizeOnchainSignal)
                .filter(
                    (signal) =>
                        (signal.confidenceScore ??
                            0.5) >=
                        this.minimumConfidenceScore,
                ),
        )
            .sort(sortOnchainSignals)
            .slice(0, input.limit);

        const netExchangeFlowUsd =
            sumOptionalNumbers(
                results.map(
                    (result) =>
                        result.netExchangeFlowUsd,
                ),
            );

        const netBridgeFlowUsd =
            sumOptionalNumbers(
                results.map(
                    (result) =>
                        result.netBridgeFlowUsd,
                ),
            );

        const accumulationScore =
            weightedAverage(
                results
                    .filter(
                        (result) =>
                            typeof result.accumulationScore ===
                            "number",
                    )
                    .map((result) => ({
                        value:
                            result.accumulationScore ?? 0,
                        weight:
                            result.signals.length || 1,
                    })),
            );

        const costUsdc = results.reduce(
            (total, result) =>
                total + (result.costUsdc ?? 0),
            0,
        );

        enforceResearchBudget({
            provider: "onchain",
            costUsdc,
            maximumCostUsdc:
                this.maximumCostUsdc,
        });

        const response: OnchainAnalyzeResult = {
            summary: buildOnchainSummary({
                results,
                signals,
                netExchangeFlowUsd,
                netBridgeFlowUsd,
                accumulationScore,
            }),

            signals,

            netExchangeFlowUsd,

            netBridgeFlowUsd,

            accumulationScore,

            costUsdc,

            provider: results
                .map(
                    (result) =>
                        result.provider ?? "unknown",
                )
                .join(","),
        };

        this.cache.set(
            cacheKey,
            response,
            this.cacheTtlMs,
        );

        return response;
    }
}

function validateOnchainInput(
    input: OnchainAnalyzeInput,
): void {
    if (!input.question.trim()) {
        throw new ResearchProviderError({
            provider: "onchain",
            code: "INVALID_ONCHAIN_QUERY",
            message:
                "Onchain analysis requires a market question.",
        });
    }

    if (
        input.minimumTransferUsd < 0 ||
        !Number.isFinite(
            input.minimumTransferUsd,
        )
    ) {
        throw new ResearchProviderError({
            provider: "onchain",
            code:
                "INVALID_MINIMUM_TRANSFER_VALUE",
            message:
                "minimumTransferUsd must be a non-negative number.",
        });
    }

    if (
        !Number.isInteger(input.limit) ||
        input.limit <= 0
    ) {
        throw new ResearchProviderError({
            provider: "onchain",
            code: "INVALID_ONCHAIN_LIMIT",
            message:
                "Onchain analysis limit must be a positive integer.",
        });
    }
}

function normalizeOnchainSignal(
    signal: OnchainSignal,
): OnchainSignal {
    return {
        ...signal,

        type: signal.type.trim(),

        title: signal.title.trim(),

        summary: signal.summary.trim(),

        provider: signal.provider.trim(),

        confidenceScore:
            signal.confidenceScore === undefined
                ? undefined
                : clamp(
                    signal.confidenceScore,
                    0,
                    1,
                ),

        direction:
            signal.direction ?? "neutral",
    };
}

function deduplicateSignals(
    signals: OnchainSignal[],
): OnchainSignal[] {
    const seen = new Set<string>();

    return signals.filter((signal) => {
        const key =
            signal.transactionHash
                ?.toLowerCase()
                .trim() ??
            [
                signal.provider,
                signal.chain,
                signal.walletAddress,
                signal.type,
                signal.timestamp,
            ]
                .join(":")
                .toLowerCase();

        if (seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    });
}

function sortOnchainSignals(
    first: OnchainSignal,
    second: OnchainSignal,
): number {
    const firstConfidence =
        first.confidenceScore ?? 0.5;

    const secondConfidence =
        second.confidenceScore ?? 0.5;

    if (
        firstConfidence !== secondConfidence
    ) {
        return (
            secondConfidence -
            firstConfidence
        );
    }

    return (
        (second.valueUsd ?? 0) -
        (first.valueUsd ?? 0)
    );
}

function sumOptionalNumbers(
    numbers: Array<number | undefined>,
): number | undefined {
    const values = numbers.filter(
        (number): number is number =>
            typeof number === "number" &&
            Number.isFinite(number),
    );

    if (values.length === 0) {
        return undefined;
    }

    return values.reduce(
        (total, value) => total + value,
        0,
    );
}

function weightedAverage(
    values: Array<{
        value: number;
        weight: number;
    }>,
): number | undefined {
    if (values.length === 0) {
        return undefined;
    }

    const totalWeight = values.reduce(
        (total, item) =>
            total + item.weight,
        0,
    );

    if (totalWeight <= 0) {
        return undefined;
    }

    return clamp(
        values.reduce(
            (total, item) =>
                total + item.value * item.weight,
            0,
        ) / totalWeight,
        -1,
        1,
    );
}

function buildOnchainSummary({
    results,
    signals,
    netExchangeFlowUsd,
    netBridgeFlowUsd,
    accumulationScore,
}: {
    results: OnchainSourceResult[];
    signals: OnchainSignal[];
    netExchangeFlowUsd?: number;
    netBridgeFlowUsd?: number;
    accumulationScore?: number;
}): string {
    const suppliedSummaries = results
        .map((result) => result.summary)
        .filter(
            (summary): summary is string =>
                Boolean(summary?.trim()),
        );

    if (suppliedSummaries.length > 0) {
        return suppliedSummaries.join("\n\n");
    }

    const parts = [
        `Collected ${signals.length} onchain signals.`,
    ];

    if (
        netExchangeFlowUsd !== undefined
    ) {
        parts.push(
            `Net exchange flow: ${netExchangeFlowUsd.toFixed(
                2,
            )} USD.`,
        );
    }

    if (netBridgeFlowUsd !== undefined) {
        parts.push(
            `Net bridge flow: ${netBridgeFlowUsd.toFixed(
                2,
            )} USD.`,
        );
    }

    if (accumulationScore !== undefined) {
        parts.push(
            `Accumulation score: ${accumulationScore.toFixed(
                3,
            )}.`,
        );
    }

    return parts.join(" ");
}