import {
    createClient,
    type SupabaseClient,
} from "@supabase/supabase-js";

import type {
    HistoricalAnalyzeInput,
    HistoricalComparable,
} from "../../../core/types";

import type {
    HistoricalSourceAdapter,
    HistoricalSourceResult,
} from "../../historical-provider";

export interface SupabaseHistoricalAdapterOptions {
    url: string;

    serviceRoleKey: string;

    /**
     * Table containing historical prediction-market events.
     *
     * Default:
     * historical_market_events
     */
    table?: string;

    /**
     * Maximum number of candidate rows fetched before
     * local similarity ranking is applied.
     */
    candidateLimit?: number;

    /**
     * Minimum similarity score required for a row
     * to be included in the final comparable list.
     */
    minimumSimilarityScore?: number;

    /**
     * Disable Supabase auth session handling because this
     * adapter is intended for server-side runtime usage.
     */
    disableAuthPersistence?: boolean;
}

interface HistoricalEventRow {
    id: string;

    title: string;

    description: string | null;

    category: string | null;

    tags: string[] | null;

    outcome: string | boolean | number | null;

    resolved_at: string | null;

    source_name: string | null;

    source_url: string | null;

    credibility_score: number | null;

    market_question: string | null;

    resolution_criteria: string | null;

    metadata: Record<string, unknown> | null;

    created_at?: string | null;
}

export class SupabaseHistoricalAdapter
    implements HistoricalSourceAdapter {
    readonly id = "supabase-historical";

    private readonly client: SupabaseClient;

    private readonly table: string;

    private readonly candidateLimit: number;

    private readonly minimumSimilarityScore: number;

    constructor(
        options: SupabaseHistoricalAdapterOptions,
    ) {
        validateOptions(options);

        this.table =
            options.table ??
            "historical_market_events";

        this.candidateLimit =
            options.candidateLimit ?? 100;

        this.minimumSimilarityScore =
            options.minimumSimilarityScore ?? 0.2;

        this.client = createClient(
            options.url,
            options.serviceRoleKey,
            {
                auth: {
                    persistSession:
                        options.disableAuthPersistence !== false
                            ? false
                            : true,

                    autoRefreshToken: false,

                    detectSessionInUrl: false,
                },

                realtime: {
                    params: {
                        eventsPerSecond: 1,
                    },
                },

                global: {
                    headers: {
                        "x-client-info":
                            "bruh-agent-runtime",
                    },
                },
            },
        );
    }

    async analyze(
        input: HistoricalAnalyzeInput,
    ): Promise<HistoricalSourceResult> {
        validateInput(input);

        try {
            const candidates =
                await this.fetchCandidates(input);

            const ranked = candidates
                .map((row) => ({
                    row,

                    similarityScore:
                        calculateSimilarityScore(
                            input,
                            row,
                        ),
                }))
                .filter(
                    ({ similarityScore }) =>
                        similarityScore >=
                        this.minimumSimilarityScore,
                )
                .sort(
                    (first, second) =>
                        second.similarityScore -
                        first.similarityScore,
                )
                .slice(0, input.limit);

            const comparables =
                ranked.map(
                    ({ row, similarityScore }) =>
                        mapHistoricalComparable(
                            row,
                            similarityScore,
                        ),
                );

            const outcomes = ranked
                .map(({ row }) =>
                    normalizeOutcome(row.outcome),
                )
                .filter(
                    (
                        outcome,
                    ): outcome is boolean =>
                        outcome !== null,
                );

            const baseRate =
                calculateBaseRate(outcomes);

            const confidenceInterval =
                calculateWilsonInterval(
                    outcomes.filter(Boolean).length,
                    outcomes.length,
                );

            return {
                provider: this.id,

                summary:
                    buildHistoricalSummary({
                        input,
                        comparables,
                        baseRate,
                        sampleSize: outcomes.length,
                    }),

                comparables,

                baseRate,

                sampleSize: outcomes.length,

                confidenceInterval,

                costUsdc: 0,
            };
        } catch (error) {
            if (
                error instanceof
                SupabaseHistoricalAdapterError
            ) {
                throw error;
            }

            throw normalizeSupabaseError(error);
        }
    }

    private async fetchCandidates(
        input: HistoricalAnalyzeInput,
    ): Promise<HistoricalEventRow[]> {
        /*
         * Start with categories when available because
         * category matching substantially improves recall.
         *
         * The local scoring stage performs the final
         * ranking and filtering.
         */

        const categories = normalizeStrings(
            input.categories ?? [],
        );

        let query = this.client
            .from(this.table)
            .select(
                [
                    "id",
                    "title",
                    "description",
                    "category",
                    "tags",
                    "outcome",
                    "resolved_at",
                    "source_name",
                    "source_url",
                    "credibility_score",
                    "market_question",
                    "resolution_criteria",
                    "metadata",
                    "created_at",
                ].join(","),
            )
            .not("outcome", "is", null)
            .order("resolved_at", {
                ascending: false,
                nullsFirst: false,
            })
            .limit(this.candidateLimit);

        /*
         * Apply a broad category filter only when categories
         * were supplied. The local similarity scorer still
         * verifies that the rows are relevant.
         */
        if (categories.length > 0) {
            query = query.in(
                "category",
                categories,
            );
        }

        const { data, error } = await query;

        if (error) {
            /*
             * A category filter may return nothing when old
             * rows use slightly different category names.
             *
             * Retry without the category restriction before
             * treating the request as failed.
             */
            if (categories.length > 0) {
                return this.fetchUnfilteredCandidates();
            }

            throw createQueryError(error);
        }

        if (
            (!data || data.length === 0) &&
            categories.length > 0
        ) {
            return this.fetchUnfilteredCandidates();
        }

        return normalizeRows(data);
    }

    private async fetchUnfilteredCandidates(): Promise<
        HistoricalEventRow[]
    > {
        const { data, error } = await this.client
            .from(this.table)
            .select(
                [
                    "id",
                    "title",
                    "description",
                    "category",
                    "tags",
                    "outcome",
                    "resolved_at",
                    "source_name",
                    "source_url",
                    "credibility_score",
                    "market_question",
                    "resolution_criteria",
                    "metadata",
                    "created_at",
                ].join(","),
            )
            .not("outcome", "is", null)
            .order("resolved_at", {
                ascending: false,
                nullsFirst: false,
            })
            .limit(this.candidateLimit);

        if (error) {
            throw createQueryError(error);
        }

        return normalizeRows(data);
    }
}

export class SupabaseHistoricalAdapterError
    extends Error {
    readonly code: string;

    readonly details?: string;

    readonly hint?: string;

    readonly status?: number;

    readonly retryable: boolean;

    readonly cause?: unknown;

    constructor({
        code,
        message,
        details,
        hint,
        status,
        retryable = false,
        cause,
    }: {
        code: string;
        message: string;
        details?: string;
        hint?: string;
        status?: number;
        retryable?: boolean;
        cause?: unknown;
    }) {
        super(message);

        this.name =
            "SupabaseHistoricalAdapterError";

        this.code = code;

        this.details = details;

        this.hint = hint;

        this.status = status;

        this.retryable = retryable;

        this.cause = cause;
    }
}

function validateOptions(
    options: SupabaseHistoricalAdapterOptions,
): void {
    if (!options.url?.trim()) {
        throw new SupabaseHistoricalAdapterError({
            code: "MISSING_SUPABASE_URL",

            message:
                "SupabaseHistoricalAdapter requires a Supabase URL.",
        });
    }

    if (!isValidUrl(options.url)) {
        throw new SupabaseHistoricalAdapterError({
            code: "INVALID_SUPABASE_URL",

            message:
                "SupabaseHistoricalAdapter received an invalid Supabase URL.",
        });
    }

    if (!options.serviceRoleKey?.trim()) {
        throw new SupabaseHistoricalAdapterError({
            code:
                "MISSING_SUPABASE_SERVICE_ROLE_KEY",

            message:
                "SupabaseHistoricalAdapter requires a service-role key.",
        });
    }

    if (
        options.candidateLimit !== undefined &&
        (!Number.isInteger(
            options.candidateLimit,
        ) ||
            options.candidateLimit <= 0 ||
            options.candidateLimit > 1_000)
    ) {
        throw new SupabaseHistoricalAdapterError({
            code:
                "INVALID_SUPABASE_CANDIDATE_LIMIT",

            message:
                "candidateLimit must be an integer between 1 and 1000.",
        });
    }

    if (
        options.minimumSimilarityScore !==
        undefined &&
        (!Number.isFinite(
            options.minimumSimilarityScore,
        ) ||
            options.minimumSimilarityScore < 0 ||
            options.minimumSimilarityScore > 1)
    ) {
        throw new SupabaseHistoricalAdapterError({
            code:
                "INVALID_MINIMUM_SIMILARITY_SCORE",

            message:
                "minimumSimilarityScore must be between 0 and 1.",
        });
    }
}

function validateInput(
    input: HistoricalAnalyzeInput,
): void {
    if (!input.question?.trim()) {
        throw new SupabaseHistoricalAdapterError({
            code: "INVALID_HISTORICAL_QUESTION",

            message:
                "Historical analysis requires a market question.",
        });
    }

    if (
        !Number.isInteger(input.limit) ||
        input.limit <= 0
    ) {
        throw new SupabaseHistoricalAdapterError({
            code: "INVALID_HISTORICAL_LIMIT",

            message:
                "Historical analysis limit must be a positive integer.",
        });
    }
}

function normalizeRows(
    data: unknown,
): HistoricalEventRow[] {
    if (!Array.isArray(data)) {
        return [];
    }

    return data
        .filter(isHistoricalEventRow)
        .map((row) => ({
            ...row,

            title: row.title.trim(),

            description:
                row.description?.trim() ?? null,

            category:
                row.category?.trim().toLowerCase() ??
                null,

            tags: normalizeStrings(
                row.tags ?? [],
            ),

            source_name:
                row.source_name?.trim() ?? null,

            source_url:
                row.source_url?.trim() ?? null,

            market_question:
                row.market_question?.trim() ?? null,

            resolution_criteria:
                row.resolution_criteria?.trim() ??
                null,
        }));
}

function isHistoricalEventRow(
    value: unknown,
): value is HistoricalEventRow {
    if (
        typeof value !== "object" ||
        value === null
    ) {
        return false;
    }

    const row =
        value as Record<string, unknown>;

    return (
        typeof row.id === "string" &&
        typeof row.title === "string"
    );
}

function calculateSimilarityScore(
    input: HistoricalAnalyzeInput,
    row: HistoricalEventRow,
): number {
    const queryText = [
        input.question,
        input.description ?? "",
        input.resolutionCriteria ?? "",
        ...(input.categories ?? []),
    ].join(" ");

    const rowText = [
        row.title,
        row.description ?? "",
        row.market_question ?? "",
        row.resolution_criteria ?? "",
        row.category ?? "",
        ...(row.tags ?? []),
    ].join(" ");

    const queryTokens =
        tokenize(queryText);

    const rowTokens =
        tokenize(rowText);

    const lexicalScore =
        calculateJaccardSimilarity(
            queryTokens,
            rowTokens,
        );

    const categoryScore =
        calculateCategorySimilarity(
            input.categories ?? [],
            row,
        );

    const resolutionScore =
        calculateResolutionSimilarity(
            input.resolutionCriteria,
            row.resolution_criteria,
        );

    const recencyScore =
        calculateRecencyScore(
            row.resolved_at ??
            row.created_at ??
            undefined,
        );

    const credibilityScore = clamp(
        row.credibility_score ?? 0.5,
        0,
        1,
    );

    return clamp(
        lexicalScore * 0.45 +
        categoryScore * 0.2 +
        resolutionScore * 0.15 +
        recencyScore * 0.05 +
        credibilityScore * 0.15,
        0,
        1,
    );
}

function calculateCategorySimilarity(
    inputCategories: string[],
    row: HistoricalEventRow,
): number {
    const requested =
        new Set(
            normalizeStrings(inputCategories),
        );

    if (requested.size === 0) {
        return 0.5;
    }

    const candidate =
        new Set(
            normalizeStrings([
                row.category ?? "",
                ...(row.tags ?? []),
            ]),
        );

    if (candidate.size === 0) {
        return 0;
    }

    let matches = 0;

    for (const category of requested) {
        if (candidate.has(category)) {
            matches += 1;
        }
    }

    return matches / requested.size;
}

function calculateResolutionSimilarity(
    requested:
        | string
        | undefined,
    candidate:
        | string
        | null,
): number {
    if (
        !requested?.trim() ||
        !candidate?.trim()
    ) {
        return 0.5;
    }

    return calculateJaccardSimilarity(
        tokenize(requested),
        tokenize(candidate),
    );
}

function calculateRecencyScore(
    date: string | undefined,
): number {
    if (!date) {
        return 0.25;
    }

    const timestamp = Date.parse(date);

    if (!Number.isFinite(timestamp)) {
        return 0.25;
    }

    const ageDays =
        Math.max(
            0,
            Date.now() - timestamp,
        ) /
        (1_000 * 60 * 60 * 24);

    if (ageDays <= 30) return 1;

    if (ageDays <= 180) return 0.8;

    if (ageDays <= 365) return 0.65;

    if (ageDays <= 3 * 365) return 0.45;

    return 0.3;
}

function tokenize(
    value: string,
): Set<string> {
    const stopWords = new Set([
        "a",
        "an",
        "and",
        "are",
        "as",
        "at",
        "be",
        "before",
        "by",
        "for",
        "from",
        "has",
        "in",
        "is",
        "it",
        "of",
        "on",
        "or",
        "that",
        "the",
        "this",
        "to",
        "was",
        "will",
        "with",
    ]);

    const tokens = value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(
            (token) =>
                token.length > 1 &&
                !stopWords.has(token),
        );

    return new Set(tokens);
}

function calculateJaccardSimilarity(
    first: Set<string>,
    second: Set<string>,
): number {
    if (
        first.size === 0 ||
        second.size === 0
    ) {
        return 0;
    }

    let intersection = 0;

    for (const item of first) {
        if (second.has(item)) {
            intersection += 1;
        }
    }

    const union =
        first.size +
        second.size -
        intersection;

    return union > 0
        ? intersection / union
        : 0;
}

function mapHistoricalComparable(
    row: HistoricalEventRow,
    similarityScore: number,
): HistoricalComparable {
    return {
        title: row.title,

        summary:
            row.description ??
            row.market_question ??
            "No historical description supplied.",

        source:
            row.source_name ??
            "Bruh historical dataset",

        url:
            row.source_url ?? undefined,

        date:
            row.resolved_at ??
            row.created_at ??
            undefined,

        outcome:
            formatOutcome(row.outcome),

        credibilityScore: clamp(
            row.credibility_score ?? 0.5,
            0,
            1,
        ),

        similarityScore,

        category:
            row.category ?? undefined,
    };
}

function normalizeOutcome(
    value: HistoricalEventRow["outcome"],
): boolean | null {
    if (typeof value === "boolean") {
        return value;
    }

    if (typeof value === "number") {
        if (value === 1) return true;

        if (value === 0) return false;

        return null;
    }

    if (typeof value !== "string") {
        return null;
    }

    const normalized =
        value.trim().toLowerCase();

    if (
        [
            "yes",
            "true",
            "positive",
            "resolved_yes",
            "1",
            "won",
        ].includes(normalized)
    ) {
        return true;
    }

    if (
        [
            "no",
            "false",
            "negative",
            "resolved_no",
            "0",
            "lost",
        ].includes(normalized)
    ) {
        return false;
    }

    return null;
}

function formatOutcome(
    value: HistoricalEventRow["outcome"],
): string | undefined {
    const normalized =
        normalizeOutcome(value);

    if (normalized === true) return "YES";

    if (normalized === false) return "NO";

    if (typeof value === "string") {
        return value;
    }

    return undefined;
}

function calculateBaseRate(
    outcomes: boolean[],
): number {
    if (outcomes.length === 0) {
        return 0.5;
    }

    const yesCount =
        outcomes.filter(Boolean).length;

    /*
     * Laplace smoothing avoids returning hard 0 or 1
     * from a very small historical sample.
     */
    return clamp(
        (yesCount + 1) /
        (outcomes.length + 2),
        0.01,
        0.99,
    );
}

function calculateWilsonInterval(
    positiveCount: number,
    sampleSize: number,
): {
    lower: number;
    upper: number;
} {
    if (sampleSize <= 0) {
        return {
            lower: 0.05,
            upper: 0.95,
        };
    }

    const z = 1.96;

    const proportion =
        positiveCount / sampleSize;

    const denominator =
        1 + (z * z) / sampleSize;

    const center =
        proportion +
        (z * z) /
        (2 * sampleSize);

    const margin =
        z *
        Math.sqrt(
            (proportion *
                (1 - proportion)) /
            sampleSize +
            (z * z) /
            (4 *
                sampleSize *
                sampleSize),
        );

    return {
        lower: clamp(
            (center - margin) /
            denominator,
            0,
            1,
        ),

        upper: clamp(
            (center + margin) /
            denominator,
            0,
            1,
        ),
    };
}

function buildHistoricalSummary({
    input,
    comparables,
    baseRate,
    sampleSize,
}: {
    input: HistoricalAnalyzeInput;
    comparables: HistoricalComparable[];
    baseRate: number;
    sampleSize: number;
}): string {
    if (comparables.length === 0) {
        return (
            `No sufficiently similar resolved historical events were found for ` +
            `"${input.question}". The neutral prior of 50% should be treated with low confidence.`
        );
    }

    return (
        `Found ${comparables.length} comparable historical events. ` +
        `${sampleSize} contained usable binary outcomes, producing a smoothed ` +
        `YES base rate of ${(baseRate * 100).toFixed(1)}%.`
    );
}

function normalizeStrings(
    values: string[],
): string[] {
    return [
        ...new Set(
            values
                .map((value) =>
                    value
                        .trim()
                        .toLowerCase(),
                )
                .filter(Boolean),
        ),
    ];
}

function createQueryError(
    error: {
        message: string;
        code?: string;
        details?: string;
        hint?: string;
    },
): SupabaseHistoricalAdapterError {
    return new SupabaseHistoricalAdapterError({
        code:
            error.code ??
            "SUPABASE_HISTORICAL_QUERY_FAILED",

        message:
            error.message ||
            "Supabase historical query failed.",

        details:
            error.details,

        hint:
            error.hint,

        retryable: isRetryableCode(
            error.code,
        ),

        cause: error,
    });
}

function normalizeSupabaseError(
    error: unknown,
): SupabaseHistoricalAdapterError {
    if (
        error instanceof
        SupabaseHistoricalAdapterError
    ) {
        return error;
    }

    if (
        typeof error === "object" &&
        error !== null
    ) {
        const record =
            error as Record<string, unknown>;

        return new SupabaseHistoricalAdapterError({
            code:
                typeof record.code === "string"
                    ? record.code
                    : "SUPABASE_HISTORICAL_REQUEST_FAILED",

            message:
                typeof record.message === "string"
                    ? record.message
                    : "Supabase historical request failed.",

            details:
                typeof record.details === "string"
                    ? record.details
                    : undefined,

            hint:
                typeof record.hint === "string"
                    ? record.hint
                    : undefined,

            status:
                typeof record.status === "number"
                    ? record.status
                    : undefined,

            retryable: false,

            cause: error,
        });
    }

    if (error instanceof Error) {
        return new SupabaseHistoricalAdapterError({
            code:
                "SUPABASE_HISTORICAL_REQUEST_FAILED",

            message: error.message,

            cause: error,
        });
    }

    return new SupabaseHistoricalAdapterError({
        code:
            "UNKNOWN_SUPABASE_HISTORICAL_ERROR",

        message:
            "An unknown Supabase historical adapter error occurred.",

        cause: error,
    });
}

function isRetryableCode(
    code: string | undefined,
): boolean {
    return [
        "08000",
        "08003",
        "08006",
        "08001",
        "08004",
        "53300",
        "57P01",
        "57P02",
        "57P03",
    ].includes(code ?? "");
}

function isValidUrl(
    value: string,
): boolean {
    try {
        new URL(value);
        return true;
    } catch {
        return false;
    }
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