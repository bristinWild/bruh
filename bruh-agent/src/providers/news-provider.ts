import type {
    NewsItem,
    NewsProvider,
    NewsSearchInput,
    NewsSearchResult,
} from "../core/types";
import {
    createResearchCacheKey,
    enforceResearchBudget,
    InMemoryResearchCache,
    normalizeCredibilityScore,
    ResearchProviderError,
    type ResearchProviderOptions,
    withTimeout,
} from "./research-provider";

export interface NewsSourceResult {
    items: NewsItem[];
    summary?: string;
    costUsdc?: number;
    provider?: string;
}

export interface NewsSourceAdapter {
    readonly id: string;

    search(
        input: NewsSearchInput,
    ): Promise<NewsSourceResult>;
}

export interface NewsProviderOptions
    extends ResearchProviderOptions {
    adapters: NewsSourceAdapter[];
    minimumCredibilityScore?: number;
}

export class DefaultNewsProvider
    implements NewsProvider {
    private readonly adapters: NewsSourceAdapter[];

    private readonly timeoutMs: number;

    private readonly cacheTtlMs: number;

    private readonly maximumCostUsdc?: number;

    private readonly minimumCredibilityScore: number;

    private readonly cache =
        new InMemoryResearchCache();

    constructor(
        options: NewsProviderOptions,
    ) {
        if (options.adapters.length === 0) {
            throw new Error(
                "DefaultNewsProvider requires at least one news adapter.",
            );
        }

        this.adapters = options.adapters;

        this.timeoutMs =
            options.timeoutMs ?? 15_000;

        this.cacheTtlMs =
            options.cacheTtlMs ?? 5 * 60_000;

        this.maximumCostUsdc =
            options.maximumCostUsdc;

        this.minimumCredibilityScore =
            options.minimumCredibilityScore ?? 0;
    }

    async search(
        input: NewsSearchInput,
    ): Promise<NewsSearchResult> {
        validateNewsInput(input);

        const cacheKey = createResearchCacheKey(
            "news",
            input,
        );

        const cached =
            this.cache.get<NewsSearchResult>(
                cacheKey,
            );

        if (cached) {
            return cached;
        }

        const settledResults =
            await Promise.allSettled(
                this.adapters.map((adapter) =>
                    withTimeout(
                        adapter.search(input),
                        this.timeoutMs,
                        "news",
                    ),
                ),
            );

        const successfulResults =
            settledResults
                .filter(
                    (
                        result,
                    ): result is PromiseFulfilledResult<NewsSourceResult> =>
                        result.status === "fulfilled",
                )
                .map((result) => result.value);

        if (successfulResults.length === 0) {
            const firstFailure =
                settledResults.find(
                    (result) =>
                        result.status === "rejected",
                );

            throw new ResearchProviderError({
                provider: "news",
                code: "ALL_NEWS_ADAPTERS_FAILED",
                message:
                    "Every configured news adapter failed.",
                cause:
                    firstFailure?.status === "rejected"
                        ? firstFailure.reason
                        : undefined,
            });
        }

        const items = deduplicateNewsItems(
            successfulResults
                .flatMap((result) => result.items)
                .map(normalizeNewsItem)
                .filter(
                    (item) =>
                        (item.credibilityScore ?? 0.5) >=
                        this.minimumCredibilityScore,
                ),
        )
            .sort(sortNewsItems)
            .slice(0, input.limit);

        const costUsdc = successfulResults.reduce(
            (total, result) =>
                total + (result.costUsdc ?? 0),
            0,
        );

        enforceResearchBudget({
            provider: "news",
            costUsdc,
            maximumCostUsdc:
                this.maximumCostUsdc,
        });

        const response: NewsSearchResult = {
            summary:
                buildNewsSummary(
                    successfulResults,
                    items,
                ),

            items,

            costUsdc,

            provider: successfulResults
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

function validateNewsInput(
    input: NewsSearchInput,
): void {
    if (!input.query.trim()) {
        throw new ResearchProviderError({
            provider: "news",
            code: "INVALID_NEWS_QUERY",
            message:
                "News search requires a query.",
        });
    }

    if (
        !Number.isInteger(input.limit) ||
        input.limit <= 0
    ) {
        throw new ResearchProviderError({
            provider: "news",
            code: "INVALID_NEWS_LIMIT",
            message:
                "News search limit must be a positive integer.",
        });
    }

    if (input.lookbackHours <= 0) {
        throw new ResearchProviderError({
            provider: "news",
            code: "INVALID_NEWS_LOOKBACK",
            message:
                "News lookbackHours must be greater than zero.",
        });
    }
}

function normalizeNewsItem(
    item: NewsItem,
): NewsItem {
    return {
        ...item,

        title: item.title.trim(),

        summary: item.summary.trim(),

        source: item.source.trim(),

        credibilityScore:
            normalizeCredibilityScore(
                item.credibilityScore,
            ),

        sentiment:
            item.sentiment ?? "neutral",

        isPrimarySource:
            item.isPrimarySource ?? false,
    };
}

function deduplicateNewsItems(
    items: NewsItem[],
): NewsItem[] {
    const seen = new Set<string>();

    return items.filter((item) => {
        const key =
            item.url?.toLowerCase() ??
            `${item.source}:${item.title}`
                .toLowerCase()
                .trim();

        if (seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    });
}

function sortNewsItems(
    first: NewsItem,
    second: NewsItem,
): number {
    const firstPrimary =
        first.isPrimarySource ? 1 : 0;

    const secondPrimary =
        second.isPrimarySource ? 1 : 0;

    if (firstPrimary !== secondPrimary) {
        return secondPrimary - firstPrimary;
    }

    const firstCredibility =
        first.credibilityScore ?? 0.5;

    const secondCredibility =
        second.credibilityScore ?? 0.5;

    if (
        firstCredibility !== secondCredibility
    ) {
        return (
            secondCredibility -
            firstCredibility
        );
    }

    const firstTime = first.publishedAt
        ? Date.parse(first.publishedAt)
        : 0;

    const secondTime = second.publishedAt
        ? Date.parse(second.publishedAt)
        : 0;

    return secondTime - firstTime;
}

function buildNewsSummary(
    results: NewsSourceResult[],
    items: NewsItem[],
): string {
    const summaries = results
        .map((result) => result.summary)
        .filter(
            (summary): summary is string =>
                Boolean(summary?.trim()),
        );

    if (summaries.length > 0) {
        return summaries.join("\n\n");
    }

    if (items.length === 0) {
        return "No relevant news evidence was found.";
    }

    return (
        `Collected ${items.length} relevant news ` +
        `items from ${new Set(
            items.map((item) => item.source),
        ).size} sources.`
    );
}