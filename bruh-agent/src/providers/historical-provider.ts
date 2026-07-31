import type {
    HistoricalAnalyzeInput, HistoricalAnalyzeResult,
    HistoricalComparable,
    HistoricalProvider,
} from "../core/types";
import {
    clamp,
    createResearchCacheKey,
    enforceResearchBudget,
    InMemoryResearchCache,
    normalizeCredibilityScore,
    ResearchProviderError,
    type ResearchProviderOptions,
    withTimeout,
} from "./research-provider";

export interface HistoricalSourceResult {
    summary?: string;
    comparables: HistoricalComparable[];
    baseRate?: number;
    sampleSize?: number;
    confidenceInterval?: {
        lower: number;
        upper: number;
    };
    costUsdc?: number;
    provider?: string;
}

export interface HistoricalSourceAdapter {
    readonly id: string;

    analyze(
        input: HistoricalAnalyzeInput,
    ): Promise<HistoricalSourceResult>;
}

export interface HistoricalProviderOptions
    extends ResearchProviderOptions {
    adapters: HistoricalSourceAdapter[];
    minimumSimilarityScore?: number;
}

export class DefaultHistoricalProvider
    implements HistoricalProvider {
    private readonly adapters: HistoricalSourceAdapter[];

    private readonly timeoutMs: number;

    private readonly cacheTtlMs: number;

    private readonly maximumCostUsdc?: number;

    private readonly minimumSimilarityScore: number;

    private readonly cache =
        new InMemoryResearchCache();

    constructor(
        options: HistoricalProviderOptions,
    ) {
        if (options.adapters.length === 0) {
            throw new Error(
                "DefaultHistoricalProvider requires at least one historical adapter.",
            );
        }

        this.adapters = options.adapters;

        this.timeoutMs =
            options.timeoutMs ?? 20_000;

        this.cacheTtlMs =
            options.cacheTtlMs ?? 30 * 60_000;

        this.maximumCostUsdc =
            options.maximumCostUsdc;

        this.minimumSimilarityScore =
            options.minimumSimilarityScore ?? 0;
    }

    async analyze(
        input: HistoricalAnalyzeInput,
    ): Promise<HistoricalAnalyzeResult> {
        validateHistoricalInput(input);

        const cacheKey = createResearchCacheKey(
            "historical",
            input,
        );

        const cached =
            this.cache.get<HistoricalAnalyzeResult>(
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
                        "historical",
                    ),
                ),
            );

        const results = settledResults
            .filter(
                (
                    result,
                ): result is PromiseFulfilledResult<HistoricalSourceResult> =>
                    result.status === "fulfilled",
            )
            .map((result) => result.value);

        if (results.length === 0) {
            throw new ResearchProviderError({
                provider: "historical",
                code:
                    "ALL_HISTORICAL_ADAPTERS_FAILED",
                message:
                    "Every configured historical adapter failed.",
            });
        }

        const comparables =
            deduplicateComparables(
                results
                    .flatMap(
                        (result) => result.comparables,
                    )
                    .map(normalizeComparable)
                    .filter(
                        (comparable) =>
                            (comparable.similarityScore ??
                                0.5) >=
                            this.minimumSimilarityScore,
                    ),
            )
                .sort(
                    (first, second) =>
                        (second.similarityScore ?? 0) -
                        (first.similarityScore ?? 0),
                )
                .slice(0, input.limit);

        const baseRate =
            calculateCombinedBaseRate(
                results,
                comparables,
            );

        const sampleSize =
            results.reduce(
                (total, result) =>
                    total +
                    (result.sampleSize ??
                        result.comparables.length),
                0,
            );

        const confidenceInterval =
            combineConfidenceIntervals(
                results,
                baseRate,
                sampleSize,
            );

        const costUsdc = results.reduce(
            (total, result) =>
                total + (result.costUsdc ?? 0),
            0,
        );

        enforceResearchBudget({
            provider: "historical",
            costUsdc,
            maximumCostUsdc:
                this.maximumCostUsdc,
        });

        const response: HistoricalAnalyzeResult =
        {
            summary: buildHistoricalSummary(
                results,
                comparables,
                baseRate,
            ),

            comparables,

            baseRate,

            sampleSize,

            confidenceInterval,

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

function validateHistoricalInput(
    input: HistoricalAnalyzeInput,
): void {
    if (!input.question.trim()) {
        throw new ResearchProviderError({
            provider: "historical",
            code: "INVALID_HISTORICAL_QUERY",
            message:
                "Historical analysis requires a market question.",
        });
    }

    if (
        !Number.isInteger(input.limit) ||
        input.limit <= 0
    ) {
        throw new ResearchProviderError({
            provider: "historical",
            code: "INVALID_HISTORICAL_LIMIT",
            message:
                "Historical analysis limit must be a positive integer.",
        });
    }
}

function normalizeComparable(
    comparable: HistoricalComparable,
): HistoricalComparable {
    return {
        ...comparable,

        title: comparable.title.trim(),

        summary: comparable.summary.trim(),

        source: comparable.source.trim(),

        credibilityScore:
            normalizeCredibilityScore(
                comparable.credibilityScore,
            ),

        similarityScore:
            comparable.similarityScore ===
                undefined
                ? undefined
                : clamp(
                    comparable.similarityScore,
                    0,
                    1,
                ),
    };
}

function deduplicateComparables(
    comparables: HistoricalComparable[],
): HistoricalComparable[] {
    const seen = new Set<string>();

    return comparables.filter((item) => {
        const key =
            item.url?.toLowerCase() ??
            `${item.source}:${item.title}:${item.date ?? ""}`
                .toLowerCase()
                .trim();

        if (seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    });
}

function calculateCombinedBaseRate(
    results: HistoricalSourceResult[],
    comparables: HistoricalComparable[],
): number {
    const explicitBaseRates = results
        .map((result) => result.baseRate)
        .filter(
            (rate): rate is number =>
                typeof rate === "number" &&
                Number.isFinite(rate),
        );

    if (explicitBaseRates.length > 0) {
        const weightedTotal = results.reduce(
            (total, result) => {
                if (
                    typeof result.baseRate !== "number"
                ) {
                    return total;
                }

                const weight =
                    result.sampleSize ??
                    result.comparables.length ??
                    1;

                return (
                    total + result.baseRate * weight
                );
            },
            0,
        );

        const totalWeight = results.reduce(
            (total, result) => {
                if (
                    typeof result.baseRate !== "number"
                ) {
                    return total;
                }

                return (
                    total +
                    (result.sampleSize ??
                        result.comparables.length ??
                        1)
                );
            },
            0,
        );

        return clamp(
            weightedTotal /
            Math.max(totalWeight, 1),
            0.01,
            0.99,
        );
    }

    const knownOutcomes = comparables
        .map((item) =>
            parseHistoricalOutcome(item.outcome),
        )
        .filter(
            (outcome): outcome is boolean =>
                outcome !== null,
        );

    if (knownOutcomes.length === 0) {
        return 0.5;
    }

    const positiveCount =
        knownOutcomes.filter(Boolean).length;

    return clamp(
        positiveCount / knownOutcomes.length,
        0.01,
        0.99,
    );
}

function parseHistoricalOutcome(
    outcome: string | undefined,
): boolean | null {
    if (!outcome) {
        return null;
    }

    const normalized =
        outcome.toLowerCase().trim();

    if (
        ["yes", "true", "positive", "1"].includes(
            normalized,
        )
    ) {
        return true;
    }

    if (
        ["no", "false", "negative", "0"].includes(
            normalized,
        )
    ) {
        return false;
    }

    return null;
}

function combineConfidenceIntervals(
    results: HistoricalSourceResult[],
    baseRate: number,
    sampleSize: number,
): {
    lower: number;
    upper: number;
} {
    const explicitIntervals = results
        .map(
            (result) =>
                result.confidenceInterval,
        )
        .filter(
            (
                interval,
            ): interval is {
                lower: number;
                upper: number;
            } => Boolean(interval),
        );

    if (explicitIntervals.length > 0) {
        return {
            lower: clamp(
                Math.min(
                    ...explicitIntervals.map(
                        (interval) => interval.lower,
                    ),
                ),
                0,
                1,
            ),

            upper: clamp(
                Math.max(
                    ...explicitIntervals.map(
                        (interval) => interval.upper,
                    ),
                ),
                0,
                1,
            ),
        };
    }

    const safeSampleSize =
        Math.max(sampleSize, 1);

    const standardError = Math.sqrt(
        (baseRate * (1 - baseRate)) /
        safeSampleSize,
    );

    return {
        lower: clamp(
            baseRate - 1.96 * standardError,
            0,
            1,
        ),

        upper: clamp(
            baseRate + 1.96 * standardError,
            0,
            1,
        ),
    };
}

function buildHistoricalSummary(
    results: HistoricalSourceResult[],
    comparables: HistoricalComparable[],
    baseRate: number,
): string {
    const suppliedSummaries = results
        .map((result) => result.summary)
        .filter(
            (summary): summary is string =>
                Boolean(summary?.trim()),
        );

    if (suppliedSummaries.length > 0) {
        return suppliedSummaries.join("\n\n");
    }

    return (
        `Found ${comparables.length} relevant ` +
        `historical comparables with an estimated ` +
        `base rate of ${(baseRate * 100).toFixed(
            1,
        )}%.`
    );
}