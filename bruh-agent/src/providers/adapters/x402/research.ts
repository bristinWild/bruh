import {
    ResearchBudgetExceededError,
    ResearchProviderError,
    createResearchCacheKey,
    InMemoryResearchCache,
} from "../../research-provider";

/**
 * Generic request sent to an x402-compatible research service.
 */
export interface X402ResearchRequest {
    /**
     * Full paid-resource URL.
     */
    url: string;

    /**
     * The research question or topic.
     */
    query: string;

    /**
     * Maximum amount this request may spend.
     */
    budgetUsdc: number;

    /**
     * Optional HTTP method.
     */
    method?: "GET" | "POST";

    /**
     * Optional request body additions.
     */
    body?: Record<string, unknown>;

    /**
     * Additional request headers.
     */
    headers?: Record<string, string>;

    /**
     * Optional expected research category.
     */
    category?:
    | "news"
    | "historical"
    | "onchain"
    | "weather"
    | "sports"
    | "finance"
    | "oracle"
    | "custom";

    maximumSources?: number;

    minimumConfidence?: number;

    metadata?: Record<string, unknown>;
}

export interface X402ResearchSource {
    id?: string;

    title: string;

    provider: string;

    content: string;

    url?: string;

    publishedAt?: string;

    confidence?: number;

    priceUsdc?: number;

    metadata?: Record<string, unknown>;
}

export interface X402PaymentReceipt {
    /**
     * Payment protocol used.
     */
    protocol: "x402";

    /**
     * Network identifier, preferably CAIP-2.
     */
    network?: string;

    payer?: string;

    payee?: string;

    asset?: string;

    amountUsdc: number;

    transactionHash?: string;

    authorizationId?: string;

    facilitator?: string;

    paidAt: string;

    metadata?: Record<string, unknown>;
}

export interface X402ResearchReport {
    summary: string;

    confidence: number;

    provider: string;

    sources: X402ResearchSource[];

    totalCostUsdc: number;

    purchasedAt: string;

    receipt?: X402PaymentReceipt;

    raw?: unknown;

    metadata?: Record<string, unknown>;
}

/**
 * Payment requirement extracted from an HTTP 402 response.
 *
 * The adapter intentionally keeps this generic because different
 * x402 facilitators and settlement schemes may expose additional
 * fields.
 */
export interface X402PaymentRequirement {
    scheme?: string;

    network?: string;

    asset?: string;

    amount?: string;

    amountUsdc?: number;

    payTo?: string;

    resource?: string;

    description?: string;

    mimeType?: string;

    maxTimeoutSeconds?: number;

    facilitator?: string;

    raw: unknown;
}

export interface X402PaidFetchInput {
    url: string;

    method: "GET" | "POST";

    headers: Record<string, string>;

    body?: string;

    budgetUsdc: number;

    /**
     * The initial 402 requirement, when the adapter has already
     * performed the unpaid request.
     */
    paymentRequirement?: X402PaymentRequirement;
}

export interface X402PaidFetchResult {
    response: Response;

    receipt?: X402PaymentReceipt;
}

/**
 * Implement this interface inside bruh-backend.
 *
 * The implementation can use:
 *
 * - Circle CLI / Agent Wallets
 * - Circle Gateway Nanopayments
 * - an x402 v2 TypeScript client
 * - another compatible wallet executor
 *
 * bruh-agent never receives wallet secrets.
 */
export interface X402PaymentExecutor {
    readonly id: string;

    pay(
        input: X402PaidFetchInput,
    ): Promise<X402PaidFetchResult>;
}

export interface X402ServiceDescriptor {
    id?: string;

    name: string;

    description?: string;

    url: string;

    category?: string;

    priceUsdc?: number;

    confidence?: number;

    network?: string;

    metadata?: Record<string, unknown>;
}

export interface X402ServiceDiscovery {
    readonly id: string;

    search(input: {
        query: string;
        category?: string;
        maximumResults: number;
    }): Promise<X402ServiceDescriptor[]>;
}

export interface X402ResearchAdapterOptions {
    paymentExecutor: X402PaymentExecutor;

    /**
     * Optional discovery adapter, for example an x402 Bazaar
     * integration.
     */
    discovery?: X402ServiceDiscovery;

    timeoutMs?: number;

    cacheTtlMs?: number;

    maximumPaymentUsdc?: number;

    maximumSources?: number;

    minimumConfidence?: number;

    /**
     * When enabled, perform the initial unpaid request ourselves.
     * If it returns 402, pass the parsed requirement to the executor.
     */
    performInitialRequest?: boolean;
}

export class X402ResearchAdapter {
    readonly id = "x402-research";

    private readonly paymentExecutor: X402PaymentExecutor;

    private readonly discovery?: X402ServiceDiscovery;

    private readonly timeoutMs: number;

    private readonly cacheTtlMs: number;

    private readonly maximumPaymentUsdc: number;

    private readonly maximumSources: number;

    private readonly minimumConfidence: number;

    private readonly performInitialRequest: boolean;

    private readonly cache = new InMemoryResearchCache();

    constructor(
        options: X402ResearchAdapterOptions,
    ) {
        validateOptions(options);

        this.paymentExecutor =
            options.paymentExecutor;

        this.discovery = options.discovery;

        this.timeoutMs =
            options.timeoutMs ?? 20_000;

        this.cacheTtlMs =
            options.cacheTtlMs ?? 5 * 60_000;

        this.maximumPaymentUsdc =
            options.maximumPaymentUsdc ?? 0.05;

        this.maximumSources =
            options.maximumSources ?? 10;

        this.minimumConfidence =
            options.minimumConfidence ?? 0;

        this.performInitialRequest =
            options.performInitialRequest ?? true;
    }

    /**
     * Purchase research from a specific x402 URL.
     */
    async purchaseResearch(
        request: X402ResearchRequest,
    ): Promise<X402ResearchReport> {
        validateRequest(request);

        const allowedBudget = Math.min(
            request.budgetUsdc,
            this.maximumPaymentUsdc,
        );

        if (allowedBudget <= 0) {
            throw new ResearchBudgetExceededError({
                provider: "custom",
                attemptedCostUsdc:
                    request.budgetUsdc,
                maximumCostUsdc:
                    this.maximumPaymentUsdc,
            });
        }

        const cacheKey = createResearchCacheKey(
            "custom",
            {
                url: request.url,
                query: request.query,
                category: request.category,
                body: request.body,
            },
        );

        const cached =
            this.cache.get<X402ResearchReport>(
                cacheKey,
            );

        if (cached) {
            return {
                ...cached,

                metadata: {
                    ...(cached.metadata ?? {}),
                    cached: true,
                },
            };
        }

        const method =
            request.method ?? "POST";

        const body =
            method === "POST"
                ? JSON.stringify({
                    query: request.query,

                    category:
                        request.category,

                    maximumSources:
                        request.maximumSources ??
                        this.maximumSources,

                    minimumConfidence:
                        request.minimumConfidence ??
                        this.minimumConfidence,

                    ...request.body,

                    metadata:
                        request.metadata,
                })
                : undefined;

        const headers: Record<string, string> = {
            Accept: "application/json",

            ...(body
                ? {
                    "Content-Type":
                        "application/json",
                }
                : {}),

            ...(request.headers ?? {}),
        };

        const result =
            this.performInitialRequest
                ? await this.performNegotiatedRequest({
                    url: request.url,
                    method,
                    headers,
                    body,
                    budgetUsdc: allowedBudget,
                })
                : await this.paymentExecutor.pay({
                    url: request.url,
                    method,
                    headers,
                    body,
                    budgetUsdc: allowedBudget,
                });

        const report =
            await parseResearchResponse({
                response: result.response,
                receipt: result.receipt,
                fallbackProvider:
                    this.paymentExecutor.id,
            });

        if (
            report.totalCostUsdc >
            allowedBudget
        ) {
            throw new ResearchBudgetExceededError({
                provider: "custom",
                attemptedCostUsdc:
                    report.totalCostUsdc,
                maximumCostUsdc:
                    allowedBudget,
            });
        }

        const filteredReport = {
            ...report,

            sources: report.sources
                .filter(
                    (source) =>
                        (source.confidence ?? 0.5) >=
                        (request.minimumConfidence ??
                            this.minimumConfidence),
                )
                .slice(
                    0,
                    request.maximumSources ??
                    this.maximumSources,
                ),

            metadata: {
                ...(report.metadata ?? {}),

                cached: false,

                paymentExecutor:
                    this.paymentExecutor.id,
            },
        };

        this.cache.set(
            cacheKey,
            filteredReport,
            this.cacheTtlMs,
        );

        return filteredReport;
    }

    /**
     * Discover candidate x402 services and purchase research
     * from the best candidate that fits the budget.
     */
    async discoverAndPurchase(
        request: Omit<
            X402ResearchRequest,
            "url"
        >,
    ): Promise<X402ResearchReport> {
        if (!this.discovery) {
            throw new X402ResearchAdapterError({
                code:
                    "X402_DISCOVERY_NOT_CONFIGURED",

                message:
                    "No x402 service discovery adapter is configured.",
            });
        }

        const services =
            await this.discovery.search({
                query: request.query,

                category:
                    request.category,

                maximumResults: 10,
            });

        const eligible = services
            .filter((service) => {
                const price =
                    service.priceUsdc ?? 0;

                return (
                    price <= request.budgetUsdc &&
                    price <=
                    this.maximumPaymentUsdc
                );
            })
            .sort(compareServices);

        if (eligible.length === 0) {
            throw new X402ResearchAdapterError({
                code:
                    "NO_AFFORDABLE_X402_SERVICE",

                message:
                    "No discovered x402 research service fits the configured budget.",
            });
        }

        const failures: unknown[] = [];

        for (const service of eligible) {
            try {
                return await this.purchaseResearch({
                    ...request,

                    url: service.url,

                    metadata: {
                        ...(request.metadata ?? {}),

                        discoveredService: {
                            id: service.id,

                            name: service.name,

                            discoveryProvider:
                                this.discovery.id,
                        },
                    },
                });
            } catch (error) {
                failures.push(error);
            }
        }

        throw new X402ResearchAdapterError({
            code:
                "ALL_X402_SERVICES_FAILED",

            message:
                "Every eligible x402 research service failed.",

            cause: failures,
        });
    }

    private async performNegotiatedRequest(
        input: X402PaidFetchInput,
    ): Promise<X402PaidFetchResult> {
        const initialResponse =
            await fetchWithTimeout(
                input.url,
                {
                    method: input.method,

                    headers: input.headers,

                    body: input.body,
                },
                this.timeoutMs,
            );

        /**
         * Free endpoint: return immediately without payment.
         */
        if (
            initialResponse.status !== 402
        ) {
            return {
                response: initialResponse,

                receipt: {
                    protocol: "x402",

                    amountUsdc: 0,

                    paidAt:
                        new Date().toISOString(),

                    metadata: {
                        paymentRequired: false,
                    },
                },
            };
        }

        const requirement =
            await parsePaymentRequirement(
                initialResponse,
            );

        const requiredAmount =
            resolveRequiredAmountUsdc(
                requirement,
            );

        if (
            requiredAmount !== undefined &&
            requiredAmount >
            input.budgetUsdc
        ) {
            throw new ResearchBudgetExceededError({
                provider: "custom",

                attemptedCostUsdc:
                    requiredAmount,

                maximumCostUsdc:
                    input.budgetUsdc,
            });
        }

        return this.paymentExecutor.pay({
            ...input,

            paymentRequirement:
                requirement,
        });
    }
}

export class X402ResearchAdapterError
    extends Error {
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

        this.name =
            "X402ResearchAdapterError";

        this.code = code;

        this.status = status;

        this.retryable = retryable;

        this.cause = cause;
    }
}

async function parsePaymentRequirement(
    response: Response,
): Promise<X402PaymentRequirement> {
    const paymentRequiredHeader =
        response.headers.get(
            "PAYMENT-REQUIRED",
        ) ??
        response.headers.get(
            "payment-required",
        );

    let body: unknown;

    try {
        body = await response
            .clone()
            .json();
    } catch {
        body = undefined;
    }

    if (paymentRequiredHeader) {
        const parsedHeader =
            parsePossibleJsonOrBase64(
                paymentRequiredHeader,
            );

        return normalizePaymentRequirement(
            parsedHeader,
        );
    }

    if (body !== undefined) {
        return normalizePaymentRequirement(
            body,
        );
    }

    throw new X402ResearchAdapterError({
        code:
            "MISSING_X402_PAYMENT_REQUIREMENT",

        message:
            "The service returned HTTP 402 without a PAYMENT-REQUIRED header or payment requirement body.",

        status: 402,
    });
}

function normalizePaymentRequirement(
    value: unknown,
): X402PaymentRequirement {
    const record =
        isRecord(value)
            ? value
            : {};

    const requirement =
        findRequirementRecord(record);

    return {
        scheme:
            readString(requirement, [
                "scheme",
            ]),

        network:
            readString(requirement, [
                "network",
            ]),

        asset:
            readString(requirement, [
                "asset",
                "currency",
            ]),

        amount:
            readString(requirement, [
                "amount",
                "maxAmountRequired",
                "max_amount_required",
            ]),

        amountUsdc:
            readNumber(requirement, [
                "amountUsdc",
                "amount_usdc",
                "priceUsdc",
                "price_usdc",
            ]),

        payTo:
            readString(requirement, [
                "payTo",
                "pay_to",
                "recipient",
            ]),

        resource:
            readString(requirement, [
                "resource",
                "url",
            ]),

        description:
            readString(requirement, [
                "description",
            ]),

        mimeType:
            readString(requirement, [
                "mimeType",
                "mime_type",
            ]),

        maxTimeoutSeconds:
            readNumber(requirement, [
                "maxTimeoutSeconds",
                "max_timeout_seconds",
            ]),

        facilitator:
            readString(requirement, [
                "facilitator",
                "facilitatorUrl",
                "facilitator_url",
            ]),

        raw: value,
    };
}

function findRequirementRecord(
    root: Record<string, unknown>,
): Record<string, unknown> {
    const candidates = [
        root,

        root.paymentRequirements,

        root.payment_requirements,

        root.accepts,

        root.requirements,
    ];

    for (const candidate of candidates) {
        if (isRecord(candidate)) {
            return candidate;
        }

        if (
            Array.isArray(candidate) &&
            candidate.length > 0 &&
            isRecord(candidate[0])
        ) {
            return candidate[0];
        }
    }

    return root;
}

function resolveRequiredAmountUsdc(
    requirement: X402PaymentRequirement,
): number | undefined {
    if (
        requirement.amountUsdc !== undefined
    ) {
        return requirement.amountUsdc;
    }

    if (!requirement.amount) {
        return undefined;
    }

    const parsed = Number(
        requirement.amount,
    );

    if (!Number.isFinite(parsed)) {
        return undefined;
    }

    /**
     * x402 schemes may represent token quantities in atomic units.
     * We only automatically convert when the asset appears to be
     * USDC and the number is clearly integral.
     */
    if (
        requirement.asset
            ?.toUpperCase()
            .includes("USDC") &&
        Number.isInteger(parsed) &&
        parsed >= 1
    ) {
        return parsed / 1_000_000;
    }

    return parsed;
}

async function parseResearchResponse({
    response,
    receipt,
    fallbackProvider,
}: {
    response: Response;
    receipt?: X402PaymentReceipt;
    fallbackProvider: string;
}): Promise<X402ResearchReport> {
    const rawText =
        await response.text();

    if (!response.ok) {
        throw new X402ResearchAdapterError({
            code:
                resolveResponseErrorCode(
                    response.status,
                ),

            message:
                `x402 research service failed with status ${response.status}: ${rawText.slice(
                    0,
                    300,
                )}`,

            status:
                response.status,

            retryable:
                isRetryableStatus(
                    response.status,
                ),
        });
    }

    let raw: unknown;

    try {
        raw = rawText
            ? JSON.parse(rawText)
            : {};
    } catch {
        raw = {
            summary: rawText,
        };
    }

    const record =
        isRecord(raw)
            ? raw
            : {};

    const sources =
        normalizeResearchSources(
            record.sources ??
            record.evidence ??
            record.results,
            fallbackProvider,
        );

    const summary =
        readString(record, [
            "summary",
            "answer",
            "report",
            "content",
        ]) ??
        sources
            .map((source) => source.content)
            .join("\n\n") ??
        "Paid research completed.";

    const confidence =
        clamp(
            readNumber(record, [
                "confidence",
                "confidenceScore",
                "confidence_score",
            ]) ??
            calculateAverageConfidence(
                sources,
            ) ??
            0.5,
            0,
            1,
        );

    const totalCostUsdc =
        receipt?.amountUsdc ??
        readNumber(record, [
            "totalCostUsdc",
            "total_cost_usdc",
            "costUsdc",
            "cost_usdc",
            "priceUsdc",
            "price_usdc",
        ]) ??
        0;

    return {
        summary,

        confidence,

        provider:
            readString(record, [
                "provider",
                "providerName",
                "provider_name",
            ]) ??
            fallbackProvider,

        sources,

        totalCostUsdc,

        purchasedAt:
            receipt?.paidAt ??
            new Date().toISOString(),

        receipt,

        raw,

        metadata:
            isRecord(record.metadata)
                ? record.metadata
                : undefined,
    };
}

function normalizeResearchSources(
    value: unknown,
    fallbackProvider: string,
): X402ResearchSource[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map(
            (
                item,
                index,
            ): X402ResearchSource | null => {
                if (typeof item === "string") {
                    return {
                        id: String(index),

                        title:
                            `Research source ${index + 1}`,

                        provider:
                            fallbackProvider,

                        content: item,
                    };
                }

                if (!isRecord(item)) {
                    return null;
                }

                const content =
                    readString(item, [
                        "content",
                        "summary",
                        "text",
                        "answer",
                    ]);

                if (!content) {
                    return null;
                }

                return {
                    id:
                        readString(item, [
                            "id",
                        ]) ??
                        String(index),

                    title:
                        readString(item, [
                            "title",
                            "name",
                        ]) ??
                        `Research source ${index + 1}`,

                    provider:
                        readString(item, [
                            "provider",
                            "source",
                        ]) ??
                        fallbackProvider,

                    content,

                    url:
                        readString(item, [
                            "url",
                            "sourceUrl",
                            "source_url",
                        ]),

                    publishedAt:
                        readString(item, [
                            "publishedAt",
                            "published_at",
                            "date",
                        ]),

                    confidence:
                        normalizeOptionalScore(
                            readNumber(item, [
                                "confidence",
                                "confidenceScore",
                                "confidence_score",
                            ]),
                        ),

                    priceUsdc:
                        readNumber(item, [
                            "priceUsdc",
                            "price_usdc",
                            "costUsdc",
                            "cost_usdc",
                        ]),

                    metadata:
                        isRecord(item.metadata)
                            ? item.metadata
                            : undefined,
                };
            },
        )
        .filter(
            (
                source,
            ): source is X402ResearchSource =>
                source !== null,
        );
}

function compareServices(
    first: X402ServiceDescriptor,
    second: X402ServiceDescriptor,
): number {
    const firstConfidence =
        first.confidence ?? 0.5;

    const secondConfidence =
        second.confidence ?? 0.5;

    const firstPrice =
        first.priceUsdc ?? 0;

    const secondPrice =
        second.priceUsdc ?? 0;

    /**
     * Prefer higher confidence per USDC.
     */
    const firstValue =
        firstConfidence /
        Math.max(firstPrice, 0.000001);

    const secondValue =
        secondConfidence /
        Math.max(secondPrice, 0.000001);

    return secondValue - firstValue;
}

function validateOptions(
    options: X402ResearchAdapterOptions,
): void {
    if (!options.paymentExecutor) {
        throw new X402ResearchAdapterError({
            code:
                "MISSING_X402_PAYMENT_EXECUTOR",

            message:
                "X402ResearchAdapter requires a payment executor.",
        });
    }

    if (
        options.timeoutMs !== undefined &&
        (!Number.isFinite(
            options.timeoutMs,
        ) ||
            options.timeoutMs <= 0)
    ) {
        throw new X402ResearchAdapterError({
            code:
                "INVALID_X402_TIMEOUT",

            message:
                "x402 timeoutMs must be greater than zero.",
        });
    }

    if (
        options.maximumPaymentUsdc !==
        undefined &&
        (!Number.isFinite(
            options.maximumPaymentUsdc,
        ) ||
            options.maximumPaymentUsdc < 0)
    ) {
        throw new X402ResearchAdapterError({
            code:
                "INVALID_X402_MAX_PAYMENT",

            message:
                "maximumPaymentUsdc must be non-negative.",
        });
    }
}

function validateRequest(
    request: X402ResearchRequest,
): void {
    if (!request.url?.trim()) {
        throw new X402ResearchAdapterError({
            code:
                "MISSING_X402_RESEARCH_URL",

            message:
                "x402 research requires a service URL.",
        });
    }

    try {
        new URL(request.url);
    } catch {
        throw new X402ResearchAdapterError({
            code:
                "INVALID_X402_RESEARCH_URL",

            message:
                "x402 research received an invalid service URL.",
        });
    }

    if (!request.query?.trim()) {
        throw new X402ResearchAdapterError({
            code:
                "MISSING_X402_RESEARCH_QUERY",

            message:
                "x402 research requires a query.",
        });
    }

    if (
        !Number.isFinite(
            request.budgetUsdc,
        ) ||
        request.budgetUsdc < 0
    ) {
        throw new X402ResearchAdapterError({
            code:
                "INVALID_X402_RESEARCH_BUDGET",

            message:
                "x402 research budget must be non-negative.",
        });
    }
}

async function fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number,
): Promise<Response> {
    const controller =
        new AbortController();

    const timeout =
        setTimeout(
            () => controller.abort(),
            timeoutMs,
        );

    try {
        return await fetch(url, {
            ...init,

            signal:
                controller.signal,
        });
    } catch (error) {
        if (
            error instanceof Error &&
            error.name === "AbortError"
        ) {
            throw new X402ResearchAdapterError({
                code:
                    "X402_REQUEST_TIMEOUT",

                message:
                    `x402 request timed out after ${timeoutMs}ms.`,

                retryable: true,

                cause: error,
            });
        }

        throw new X402ResearchAdapterError({
            code:
                "X402_REQUEST_FAILED",

            message:
                error instanceof Error
                    ? error.message
                    : "x402 request failed.",

            retryable: true,

            cause: error,
        });
    } finally {
        clearTimeout(timeout);
    }
}

function parsePossibleJsonOrBase64(
    value: string,
): unknown {
    try {
        return JSON.parse(value);
    } catch {
        // Continue.
    }

    try {
        const decoded =
            Buffer.from(
                value,
                "base64",
            ).toString("utf8");

        return JSON.parse(decoded);
    } catch {
        return {
            raw: value,
        };
    }
}

function calculateAverageConfidence(
    sources: X402ResearchSource[],
): number | undefined {
    const values = sources
        .map(
            (source) =>
                source.confidence,
        )
        .filter(
            (
                value,
            ): value is number =>
                value !== undefined,
        );

    if (values.length === 0) {
        return undefined;
    }

    return (
        values.reduce(
            (total, value) =>
                total + value,
            0,
        ) / values.length
    );
}

function normalizeOptionalScore(
    value: number | undefined,
): number | undefined {
    return value === undefined
        ? undefined
        : clamp(value, 0, 1);
}

function readString(
    record: Record<string, unknown>,
    keys: string[],
): string | undefined {
    for (const key of keys) {
        const value = record[key];

        if (
            typeof value === "string" &&
            value.trim()
        ) {
            return value.trim();
        }
    }

    return undefined;
}

function readNumber(
    record: Record<string, unknown>,
    keys: string[],
): number | undefined {
    for (const key of keys) {
        const value = record[key];

        if (
            typeof value === "number" &&
            Number.isFinite(value)
        ) {
            return value;
        }

        if (
            typeof value === "string" &&
            value.trim()
        ) {
            const parsed = Number(value);

            if (Number.isFinite(parsed)) {
                return parsed;
            }
        }
    }

    return undefined;
}

function isRecord(
    value: unknown,
): value is Record<string, unknown> {
    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
    );
}

function resolveResponseErrorCode(
    status: number,
): string {
    switch (status) {
        case 400:
            return "X402_BAD_REQUEST";

        case 401:
            return "X402_UNAUTHORIZED";

        case 402:
            return "X402_PAYMENT_FAILED";

        case 403:
            return "X402_FORBIDDEN";

        case 404:
            return "X402_SERVICE_NOT_FOUND";

        case 408:
            return "X402_TIMEOUT";

        case 429:
            return "X402_RATE_LIMITED";

        case 500:
        case 502:
        case 503:
        case 504:
            return "X402_SERVICE_ERROR";

        default:
            return "X402_RESPONSE_ERROR";
    }
}

function isRetryableStatus(
    status: number,
): boolean {
    return [
        408,
        409,
        425,
        429,
        500,
        502,
        503,
        504,
    ].includes(status);
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