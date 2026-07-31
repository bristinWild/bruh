import { tavily, type TavilyClient } from "@tavily/core";

import type {
    NewsItem,
    NewsSearchInput,
} from "../../../core/types";

import type {
    NewsSourceAdapter,
    NewsSourceResult,
} from "../../news-provider";

export interface TavilyNewsAdapterOptions {
    apiKey: string;

    /**
     * Tavily search depth.
     *
     * basic:
     * - lower cost
     * - faster
     *
     * advanced:
     * - higher relevance
     * - higher API-credit usage
     */
    searchDepth?: "basic" | "advanced";

    /**
     * Tavily request timeout in milliseconds.
     */
    timeoutMs?: number;

    /**
     * Maximum number of Tavily results requested.
     * Tavily currently supports up to 20.
     */
    maximumResults?: number;

    /**
     * Number of content chunks requested per source.
     */
    chunksPerSource?: 1 | 2 | 3;

    /**
     * Domains to prioritize exclusively.
     */
    includeDomains?: string[];

    /**
     * Domains that must not appear.
     */
    excludeDomains?: string[];

    /**
     * Ask Tavily to produce a generated summary.
     */
    includeAnswer?: boolean;

    /**
     * Optional request attribution.
     */
    sessionId?: string;
    humanId?: string;
}

interface TavilySearchResult {
    title?: string;
    url?: string;
    content?: string;
    score?: number;
    publishedDate?: string;
}

interface TavilySearchResponse {
    answer?: string;
    results?: TavilySearchResult[];
    requestId?: string;
    responseTime?: number;
    usage?: {
        credits?: number;
    };
}

export class TavilyNewsAdapter
    implements NewsSourceAdapter {
    readonly id = "tavily";

    private readonly client: TavilyClient;

    private readonly searchDepth:
        | "basic"
        | "advanced";

    private readonly timeoutMs: number;

    private readonly maximumResults: number;

    private readonly chunksPerSource: 1 | 2 | 3;

    private readonly includeDomains?: string[];

    private readonly excludeDomains?: string[];

    private readonly includeAnswer: boolean;

    constructor(
        options: TavilyNewsAdapterOptions,
    ) {
        validateOptions(options);

        this.client = tavily({
            apiKey: options.apiKey,
            sessionId: options.sessionId,
            humanId: options.humanId,
        });

        this.searchDepth =
            options.searchDepth ?? "advanced";

        this.timeoutMs =
            options.timeoutMs ?? 15_000;

        this.maximumResults =
            options.maximumResults ?? 10;

        this.chunksPerSource =
            options.chunksPerSource ?? 3;

        this.includeDomains =
            normalizeDomains(options.includeDomains);

        this.excludeDomains =
            normalizeDomains(options.excludeDomains);

        this.includeAnswer =
            options.includeAnswer ?? true;
    }

    async search(
        input: NewsSearchInput,
    ): Promise<NewsSourceResult> {
        validateInput(input);

        const maximumResults = Math.min(
            input.limit,
            this.maximumResults,
            20,
        );

        const query = buildSearchQuery(input);

        const startDate = createStartDate(
            input.lookbackHours,
        );

        try {
            const response =
                (await this.client.search(query, {
                    topic: "news",

                    searchDepth: this.searchDepth,

                    maxResults: maximumResults,

                    chunksPerSource:
                        this.chunksPerSource,

                    includeAnswer:
                        this.includeAnswer,

                    includeRawContent: false,

                    includeImages: false,

                    includeFavicon: false,

                    includeUsage: true,

                    startDate,

                    includeDomains:
                        this.includeDomains,

                    excludeDomains:
                        this.excludeDomains,

                    timeout:
                        millisecondsToSeconds(
                            this.timeoutMs,
                        ),
                })) as TavilySearchResponse;

            const items = (response.results ?? [])
                .map((result) =>
                    mapTavilyResult(result),
                )
                .filter(
                    (item): item is NewsItem =>
                        item !== null,
                );

            return {
                provider: this.id,

                summary:
                    response.answer?.trim() ||
                    buildFallbackSummary(items),

                items,

                /**
                 * Tavily reports credit usage, not USDC cost.
                 * Keep actual USDC cost at zero until this
                 * adapter is called through your x402 layer
                 * or you implement a credit-to-cost mapping.
                 */
                costUsdc: 0,
            };
        } catch (error) {
            throw normalizeTavilyError(error);
        }
    }
}

export class TavilyNewsAdapterError extends Error {
    readonly code: string;

    readonly status?: number;

    readonly retryable: boolean;

    readonly cause?: unknown;

    constructor({
        code,
        message,
        status,
        retryable = false,
        cause,
    }: {
        code: string;
        message: string;
        status?: number;
        retryable?: boolean;
        cause?: unknown;
    }) {
        super(message);

        this.name = "TavilyNewsAdapterError";

        this.code = code;

        this.status = status;

        this.retryable = retryable;

        this.cause = cause;
    }
}

function validateOptions(
    options: TavilyNewsAdapterOptions,
): void {
    if (!options.apiKey?.trim()) {
        throw new TavilyNewsAdapterError({
            code: "MISSING_TAVILY_API_KEY",
            message:
                "TavilyNewsAdapter requires a non-empty API key.",
        });
    }

    if (
        options.timeoutMs !== undefined &&
        (!Number.isFinite(options.timeoutMs) ||
            options.timeoutMs <= 0)
    ) {
        throw new TavilyNewsAdapterError({
            code: "INVALID_TAVILY_TIMEOUT",
            message:
                "Tavily timeoutMs must be greater than zero.",
        });
    }

    if (
        options.maximumResults !== undefined &&
        (!Number.isInteger(
            options.maximumResults,
        ) ||
            options.maximumResults <= 0 ||
            options.maximumResults > 20)
    ) {
        throw new TavilyNewsAdapterError({
            code: "INVALID_TAVILY_MAX_RESULTS",
            message:
                "Tavily maximumResults must be an integer between 1 and 20.",
        });
    }
}

function validateInput(
    input: NewsSearchInput,
): void {
    if (!input.query?.trim()) {
        throw new TavilyNewsAdapterError({
            code: "INVALID_TAVILY_QUERY",
            message:
                "Tavily news search requires a query.",
        });
    }

    if (
        !Number.isInteger(input.limit) ||
        input.limit <= 0
    ) {
        throw new TavilyNewsAdapterError({
            code: "INVALID_TAVILY_LIMIT",
            message:
                "Tavily news search limit must be a positive integer.",
        });
    }

    if (
        !Number.isFinite(
            input.lookbackHours,
        ) ||
        input.lookbackHours <= 0
    ) {
        throw new TavilyNewsAdapterError({
            code: "INVALID_TAVILY_LOOKBACK",
            message:
                "Tavily lookbackHours must be greater than zero.",
        });
    }
}

function buildSearchQuery(
    input: NewsSearchInput,
): string {
    const parts = [
        input.query.trim(),
    ];

    if (input.description?.trim()) {
        parts.push(input.description.trim());
    }

    if (input.categories?.length) {
        parts.push(
            `Categories: ${input.categories.join(", ")}`,
        );
    }

    parts.push(
        "Find the most recent credible reports, official announcements, primary sources, and market-moving developments.",
    );

    return parts.join("\n\n");
}

function createStartDate(
    lookbackHours: number,
): string {
    const startDate = new Date(
        Date.now() -
        lookbackHours *
        60 *
        60 *
        1_000,
    );

    return startDate
        .toISOString()
        .slice(0, 10);
}

function millisecondsToSeconds(
    milliseconds: number,
): number {
    return Math.max(
        1,
        Math.min(
            60,
            Math.ceil(milliseconds / 1_000),
        ),
    );
}

function mapTavilyResult(
    result: TavilySearchResult,
): NewsItem | null {
    const title = result.title?.trim();
    const content = result.content?.trim();
    const url = result.url?.trim();

    if (!title || !content) {
        return null;
    }

    const source = resolveSourceName(
        url,
    );

    return {
        title,

        summary: content,

        source,

        url,

        publishedAt:
            normalizePublishedDate(
                result.publishedDate,
            ),

        credibilityScore:
            calculateCredibilityScore({
                relevanceScore:
                    result.score,

                url,

                publishedAt:
                    result.publishedDate,
            }),

        sentiment: "neutral",

        isPrimarySource:
            isLikelyPrimarySource(url),
    };
}

function resolveSourceName(
    url: string | undefined,
): string {
    if (!url) {
        return "Unknown source";
    }

    try {
        return new URL(url).hostname.replace(
            /^www\./,
            "",
        );
    } catch {
        return "Unknown source";
    }
}

function normalizePublishedDate(
    value: string | undefined,
): string | undefined {
    if (!value) {
        return undefined;
    }

    const parsed = Date.parse(value);

    if (!Number.isFinite(parsed)) {
        return value;
    }

    return new Date(parsed).toISOString();
}

function calculateCredibilityScore({
    relevanceScore,
    url,
    publishedAt,
}: {
    relevanceScore?: number;
    url?: string;
    publishedAt?: string;
}): number {
    let score = clamp(
        relevanceScore ?? 0.5,
        0,
        1,
    );

    if (isLikelyPrimarySource(url)) {
        score += 0.12;
    }

    if (isRecognizedInstitution(url)) {
        score += 0.08;
    }

    if (isRecent(publishedAt)) {
        score += 0.04;
    }

    return clamp(score, 0, 1);
}

function isLikelyPrimarySource(
    url: string | undefined,
): boolean {
    if (!url) {
        return false;
    }

    const hostname =
        getHostname(url);

    return [
        ".gov",
        ".gov.uk",
        ".europa.eu",
        "sec.gov",
        "federalreserve.gov",
        "whitehouse.gov",
        "openai.com",
        "anthropic.com",
        "circle.com",
        "ethereum.org",
        "bitcoin.org",
    ].some((domain) =>
        hostname.endsWith(domain),
    );
}

function isRecognizedInstitution(
    url: string | undefined,
): boolean {
    if (!url) {
        return false;
    }

    const hostname =
        getHostname(url);

    return [
        "reuters.com",
        "apnews.com",
        "bloomberg.com",
        "ft.com",
        "wsj.com",
        "bbc.com",
        "bbc.co.uk",
        "cnbc.com",
        "coindesk.com",
        "theblock.co",
    ].some((domain) =>
        hostname.endsWith(domain),
    );
}

function getHostname(url: string): string {
    try {
        return new URL(url).hostname
            .toLowerCase()
            .replace(/^www\./, "");
    } catch {
        return "";
    }
}

function isRecent(
    publishedAt: string | undefined,
): boolean {
    if (!publishedAt) {
        return false;
    }

    const timestamp = Date.parse(
        publishedAt,
    );

    if (!Number.isFinite(timestamp)) {
        return false;
    }

    const ageHours =
        (Date.now() - timestamp) /
        (60 * 60 * 1_000);

    return (
        ageHours >= 0 &&
        ageHours <= 48
    );
}

function normalizeDomains(
    domains: string[] | undefined,
): string[] | undefined {
    if (!domains?.length) {
        return undefined;
    }

    const normalized = [
        ...new Set(
            domains
                .map((domain) =>
                    domain
                        .trim()
                        .toLowerCase()
                        .replace(/^https?:\/\//, "")
                        .replace(/^www\./, "")
                        .replace(/\/.*$/, ""),
                )
                .filter(Boolean),
        ),
    ];

    return normalized.length > 0
        ? normalized
        : undefined;
}

function buildFallbackSummary(
    items: NewsItem[],
): string {
    if (items.length === 0) {
        return "Tavily did not return any relevant recent news results.";
    }

    const primarySources =
        items.filter(
            (item) =>
                item.isPrimarySource,
        ).length;

    return (
        `Tavily returned ${items.length} recent news results, ` +
        `including ${primarySources} likely primary sources.`
    );
}

function normalizeTavilyError(
    error: unknown,
): TavilyNewsAdapterError {
    if (
        error instanceof
        TavilyNewsAdapterError
    ) {
        return error;
    }

    if (
        typeof error === "object" &&
        error !== null
    ) {
        const record =
            error as Record<
                string,
                unknown
            >;

        const status =
            typeof record.status === "number"
                ? record.status
                : typeof record.statusCode ===
                    "number"
                    ? record.statusCode
                    : undefined;

        const message =
            typeof record.message ===
                "string"
                ? record.message
                : "Tavily search request failed.";

        return new TavilyNewsAdapterError({
            code:
                resolveTavilyErrorCode(status),

            message,

            status,

            retryable:
                isRetryableStatus(status),

            cause: error,
        });
    }

    if (error instanceof Error) {
        return new TavilyNewsAdapterError({
            code: "TAVILY_REQUEST_FAILED",

            message: error.message,

            cause: error,
        });
    }

    return new TavilyNewsAdapterError({
        code: "UNKNOWN_TAVILY_ERROR",

        message:
            "An unknown Tavily request error occurred.",

        cause: error,
    });
}

function resolveTavilyErrorCode(
    status: number | undefined,
): string {
    switch (status) {
        case 400:
            return "TAVILY_BAD_REQUEST";

        case 401:
            return "TAVILY_UNAUTHORIZED";

        case 403:
            return "TAVILY_FORBIDDEN";

        case 408:
            return "TAVILY_TIMEOUT";

        case 422:
            return "TAVILY_VALIDATION_ERROR";

        case 429:
            return "TAVILY_RATE_LIMITED";

        case 500:
        case 502:
        case 503:
        case 504:
            return "TAVILY_SERVER_ERROR";

        default:
            return "TAVILY_API_ERROR";
    }
}

function isRetryableStatus(
    status: number | undefined,
): boolean {
    return (
        status === 408 ||
        status === 429 ||
        status === 500 ||
        status === 502 ||
        status === 503 ||
        status === 504
    );
}

function clamp(
    value: number,
    minimum: number,
    maximum: number,
): number {
    return Math.min(
        Math.max(value, minimum),
        maximum,
    );
}