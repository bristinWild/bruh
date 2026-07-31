import type {
    OnchainAnalyzeInput,
    OnchainSignal,
} from "../../../core/types";

import type {
    OnchainSourceAdapter,
    OnchainSourceResult,
} from "../../onchain-provider";

export interface DuneOnchainAdapterOptions {
    apiKey: string;

    /**
     * Usually:
     * https://api.dune.com/api/v1
     */
    baseUrl?: string;

    /**
     * Overall timeout for each query execution.
     */
    timeoutMs?: number;

    /**
     * Delay between execution-status checks.
     */
    pollingIntervalMs?: number;

    /**
     * Dune execution performance tier.
     */
    performance?: "medium" | "large";

    /**
     * Saved Dune query IDs.
     */
    queryIds: {
        whaleTransfers?: number;
        exchangeFlows?: number;
        bridgeFlows?: number;
        stakingFlows?: number;
    };
}

type DuneQueryKind =
    | "whale-transfers"
    | "exchange-flows"
    | "bridge-flows"
    | "staking-flows";

interface DuneExecuteResponse {
    execution_id?: string;
    state?: string;
}

interface DuneExecutionStatusResponse {
    execution_id?: string;
    query_id?: number;
    state?: string;
    submitted_at?: string;
    execution_started_at?: string;
    execution_ended_at?: string;
    error?: string | null;
    expires_at?: string;
}

interface DuneResultResponse {
    execution_id?: string;
    query_id?: number;
    state?: string;
    result?: {
        rows?: Array<Record<string, unknown>>;
        metadata?: {
            column_names?: string[];
            row_count?: number;
            result_set_bytes?: number;
            total_row_count?: number;
            datapoint_count?: number;
        };
    };
    error?: string | null;
}

interface ExecutedDuneQuery {
    kind: DuneQueryKind;
    queryId: number;
    executionId: string;
    rows: Array<Record<string, unknown>>;
}

export class DuneOnchainAdapter
    implements OnchainSourceAdapter {
    readonly id = "dune-onchain";

    private readonly apiKey: string;
    private readonly baseUrl: string;
    private readonly timeoutMs: number;
    private readonly pollingIntervalMs: number;
    private readonly performance:
        | "medium"
        | "large";
    private readonly queryIds:
        DuneOnchainAdapterOptions["queryIds"];

    constructor(
        options: DuneOnchainAdapterOptions,
    ) {
        validateOptions(options);

        this.apiKey = options.apiKey.trim();

        this.baseUrl = (
            options.baseUrl ??
            "https://api.dune.com/api/v1"
        ).replace(/\/+$/, "");

        this.timeoutMs =
            options.timeoutMs ?? 30_000;

        this.pollingIntervalMs =
            options.pollingIntervalMs ?? 1_500;

        this.performance =
            options.performance ?? "medium";

        this.queryIds = options.queryIds;
    }

    async analyze(
        input: OnchainAnalyzeInput,
    ): Promise<OnchainSourceResult> {
        validateInput(input);

        const configuredQueries =
            this.getConfiguredQueries();

        if (configuredQueries.length === 0) {
            throw new DuneOnchainAdapterError({
                code: "NO_DUNE_QUERIES_CONFIGURED",
                message:
                    "DuneOnchainAdapter requires at least one configured query ID.",
            });
        }

        const parameters =
            buildDuneQueryParameters(input);

        const settled =
            await Promise.allSettled(
                configuredQueries.map(
                    async ({ kind, queryId }) => {
                        return this.executeAndFetch({
                            kind,
                            queryId,
                            parameters,
                        });
                    },
                ),
            );

        const successful = settled
            .filter(
                (
                    result,
                ): result is PromiseFulfilledResult<ExecutedDuneQuery> =>
                    result.status === "fulfilled",
            )
            .map((result) => result.value);

        if (successful.length === 0) {
            const firstFailure = settled.find(
                (result) =>
                    result.status === "rejected",
            );

            throw new DuneOnchainAdapterError({
                code: "ALL_DUNE_QUERIES_FAILED",
                message:
                    "All configured Dune queries failed.",
                cause:
                    firstFailure?.status ===
                        "rejected"
                        ? firstFailure.reason
                        : undefined,
            });
        }

        const signals = successful
            .flatMap((query) =>
                query.rows
                    .map((row) =>
                        mapRowToSignal(
                            query.kind,
                            row,
                        ),
                    )
                    .filter(
                        (
                            signal,
                        ): signal is OnchainSignal =>
                            signal !== null,
                    ),
            )
            .filter((signal) =>
                passesInputFilters(signal, input),
            )
            .sort(sortSignals)
            .slice(0, input.limit);

        const netExchangeFlowUsd =
            calculateNetFlow(
                successful,
                "exchange-flows",
            );

        const netBridgeFlowUsd =
            calculateNetFlow(
                successful,
                "bridge-flows",
            );

        const accumulationScore =
            calculateAccumulationScore({
                signals,
                netExchangeFlowUsd,
                netBridgeFlowUsd,
            });

        return {
            provider: this.id,

            summary: buildSummary({
                signals,
                netExchangeFlowUsd,
                netBridgeFlowUsd,
                accumulationScore,
                successfulQueries:
                    successful.length,
                totalQueries:
                    configuredQueries.length,
            }),

            signals,

            netExchangeFlowUsd,

            netBridgeFlowUsd,

            accumulationScore,

            costUsdc: 0,
        };
    }

    private getConfiguredQueries(): Array<{
        kind: DuneQueryKind;
        queryId: number;
    }> {
        const queries: Array<{
            kind: DuneQueryKind;
            queryId: number;
        }> = [];

        if (this.queryIds.whaleTransfers) {
            queries.push({
                kind: "whale-transfers",
                queryId:
                    this.queryIds.whaleTransfers,
            });
        }

        if (this.queryIds.exchangeFlows) {
            queries.push({
                kind: "exchange-flows",
                queryId:
                    this.queryIds.exchangeFlows,
            });
        }

        if (this.queryIds.bridgeFlows) {
            queries.push({
                kind: "bridge-flows",
                queryId:
                    this.queryIds.bridgeFlows,
            });
        }

        if (this.queryIds.stakingFlows) {
            queries.push({
                kind: "staking-flows",
                queryId:
                    this.queryIds.stakingFlows,
            });
        }

        return queries;
    }

    private async executeAndFetch({
        kind,
        queryId,
        parameters,
    }: {
        kind: DuneQueryKind;
        queryId: number;
        parameters: Record<string, unknown>;
    }): Promise<ExecutedDuneQuery> {
        const executionId =
            await this.executeQuery(
                queryId,
                parameters,
            );

        await this.waitForExecution(
            executionId,
        );

        const rows =
            await this.getExecutionResult(
                executionId,
            );

        return {
            kind,
            queryId,
            executionId,
            rows,
        };
    }

    private async executeQuery(
        queryId: number,
        parameters: Record<
            string,
            unknown
        >,
    ): Promise<string> {
        const response =
            await this.request<DuneExecuteResponse>(
                `/query/${queryId}/execute`,
                {
                    method: "POST",

                    body: JSON.stringify({
                        query_parameters: parameters,

                        performance:
                            this.performance,
                    }),
                },
            );

        if (!response.execution_id) {
            throw new DuneOnchainAdapterError({
                code:
                    "MISSING_DUNE_EXECUTION_ID",

                message:
                    `Dune did not return an execution ID for query ${queryId}.`,
            });
        }

        return response.execution_id;
    }

    private async waitForExecution(
        executionId: string,
    ): Promise<void> {
        const deadline =
            Date.now() + this.timeoutMs;

        while (Date.now() < deadline) {
            const status =
                await this.request<DuneExecutionStatusResponse>(
                    `/execution/${executionId}/status`,
                    {
                        method: "GET",
                    },
                );

            const normalizedState =
                normalizeExecutionState(
                    status.state,
                );

            if (
                normalizedState === "completed"
            ) {
                return;
            }

            if (
                normalizedState === "failed" ||
                normalizedState === "canceled"
            ) {
                throw new DuneOnchainAdapterError({
                    code:
                        normalizedState === "failed"
                            ? "DUNE_EXECUTION_FAILED"
                            : "DUNE_EXECUTION_CANCELED",

                    message:
                        status.error ??
                        `Dune execution ${executionId} ${normalizedState}.`,
                });
            }

            await delay(
                this.pollingIntervalMs,
            );
        }

        throw new DuneOnchainAdapterError({
            code:
                "DUNE_EXECUTION_TIMEOUT",

            message:
                `Dune execution ${executionId} did not complete within ${this.timeoutMs}ms.`,

            retryable: true,
        });
    }

    private async getExecutionResult(
        executionId: string,
    ): Promise<Array<Record<string, unknown>>> {
        const response =
            await this.request<DuneResultResponse>(
                `/execution/${executionId}/results`,
                {
                    method: "GET",
                },
            );

        if (response.error) {
            throw new DuneOnchainAdapterError({
                code:
                    "DUNE_RESULT_ERROR",

                message: response.error,
            });
        }

        const rows =
            response.result?.rows;

        if (!Array.isArray(rows)) {
            return [];
        }

        return rows.filter(isRecord);
    }

    private async request<T>(
        path: string,
        init: RequestInit,
    ): Promise<T> {
        const controller =
            new AbortController();

        const timeout = setTimeout(() => {
            controller.abort();
        }, this.timeoutMs);

        try {
            const response = await fetch(
                `${this.baseUrl}${path}`,
                {
                    ...init,

                    headers: {
                        "Content-Type":
                            "application/json",

                        "X-Dune-API-Key":
                            this.apiKey,

                        ...(init.headers ?? {}),
                    },

                    signal: controller.signal,
                },
            );

            const text =
                await response.text();

            const body =
                text.trim().length > 0
                    ? safeParseJson(text)
                    : {};

            if (!response.ok) {
                throw new DuneOnchainAdapterError({
                    code:
                        resolveHttpErrorCode(
                            response.status,
                        ),

                    message:
                        readErrorMessage(body) ??
                        `Dune API request failed with status ${response.status}.`,

                    status: response.status,

                    retryable:
                        isRetryableStatus(
                            response.status,
                        ),

                    cause: body,
                });
            }

            return body as T;
        } catch (error) {
            if (
                error instanceof
                DuneOnchainAdapterError
            ) {
                throw error;
            }

            if (
                error instanceof Error &&
                error.name === "AbortError"
            ) {
                throw new DuneOnchainAdapterError({
                    code:
                        "DUNE_REQUEST_TIMEOUT",

                    message:
                        "Dune API request timed out.",

                    retryable: true,

                    cause: error,
                });
            }

            throw normalizeDuneError(error);
        } finally {
            clearTimeout(timeout);
        }
    }
}

export class DuneOnchainAdapterError
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
            "DuneOnchainAdapterError";

        this.code = code;

        this.status = status;

        this.retryable = retryable;

        this.cause = cause;
    }
}

function validateOptions(
    options: DuneOnchainAdapterOptions,
): void {
    if (!options.apiKey?.trim()) {
        throw new DuneOnchainAdapterError({
            code: "MISSING_DUNE_API_KEY",

            message:
                "DuneOnchainAdapter requires a Dune API key.",
        });
    }

    if (
        options.baseUrl &&
        !isValidUrl(options.baseUrl)
    ) {
        throw new DuneOnchainAdapterError({
            code: "INVALID_DUNE_BASE_URL",

            message:
                "DuneOnchainAdapter received an invalid base URL.",
        });
    }

    if (
        options.timeoutMs !== undefined &&
        (!Number.isFinite(
            options.timeoutMs,
        ) ||
            options.timeoutMs <= 0)
    ) {
        throw new DuneOnchainAdapterError({
            code: "INVALID_DUNE_TIMEOUT",

            message:
                "Dune timeoutMs must be greater than zero.",
        });
    }

    if (
        options.pollingIntervalMs !==
        undefined &&
        (!Number.isFinite(
            options.pollingIntervalMs,
        ) ||
            options.pollingIntervalMs <= 0)
    ) {
        throw new DuneOnchainAdapterError({
            code:
                "INVALID_DUNE_POLL_INTERVAL",

            message:
                "Dune pollingIntervalMs must be greater than zero.",
        });
    }

    for (const [
        name,
        queryId,
    ] of Object.entries(
        options.queryIds,
    )) {
        if (
            queryId !== undefined &&
            (!Number.isInteger(queryId) ||
                queryId <= 0)
        ) {
            throw new DuneOnchainAdapterError({
                code:
                    "INVALID_DUNE_QUERY_ID",

                message:
                    `${name} query ID must be a positive integer.`,
            });
        }
    }
}

function validateInput(
    input: OnchainAnalyzeInput,
): void {
    if (!input.question?.trim()) {
        throw new DuneOnchainAdapterError({
            code:
                "INVALID_ONCHAIN_QUESTION",

            message:
                "Dune onchain analysis requires a market question.",
        });
    }

    if (
        !Number.isInteger(input.limit) ||
        input.limit <= 0
    ) {
        throw new DuneOnchainAdapterError({
            code:
                "INVALID_ONCHAIN_LIMIT",

            message:
                "Dune onchain result limit must be a positive integer.",
        });
    }

    if (
        !Number.isFinite(
            input.lookbackHours,
        ) ||
        input.lookbackHours <= 0
    ) {
        throw new DuneOnchainAdapterError({
            code:
                "INVALID_ONCHAIN_LOOKBACK",

            message:
                "lookbackHours must be greater than zero.",
        });
    }

    if (
        !Number.isFinite(
            input.minimumTransferUsd,
        ) ||
        input.minimumTransferUsd < 0
    ) {
        throw new DuneOnchainAdapterError({
            code:
                "INVALID_MINIMUM_TRANSFER",

            message:
                "minimumTransferUsd must be non-negative.",
        });
    }
}

function buildDuneQueryParameters(
    input: OnchainAnalyzeInput,
): Record<string, unknown> {
    return {
        lookback_hours:
            input.lookbackHours,

        minimum_transfer_usd:
            input.minimumTransferUsd,

        assets:
            input.assets.join(","),

        chains:
            input.chains.join(","),

        limit: input.limit,
    };
}

function mapRowToSignal(
    kind: DuneQueryKind,
    row: Record<string, unknown>,
): OnchainSignal | null {
    const timestamp = readString(
        row,
        [
            "timestamp",
            "block_time",
            "event_time",
            "transfer_time",
            "created_at",
        ],
    );

    const transactionHash =
        readString(row, [
            "tx_hash",
            "transaction_hash",
            "hash",
        ]);

    const walletAddress =
        readString(row, [
            "wallet_address",
            "address",
            "from_address",
            "account",
        ]);

    const walletLabel =
        readString(row, [
            "wallet_label",
            "label",
            "entity_name",
            "counterparty_label",
        ]);

    const chain = readString(
        row,
        ["chain", "blockchain"],
    );

    const asset = readString(
        row,
        [
            "asset",
            "symbol",
            "token_symbol",
        ],
    );

    const valueUsd = readNumber(
        row,
        [
            "value_usd",
            "amount_usd",
            "usd_value",
            "transfer_value_usd",
        ],
    );

    const rawDirection =
        readString(row, [
            "direction",
            "flow_direction",
            "transfer_direction",
        ]);

    const direction =
        normalizeDirection(
            rawDirection,
            row,
            kind,
        );

    const confidenceScore =
        normalizeConfidence(
            readNumber(row, [
                "confidence",
                "confidence_score",
                "score",
            ]),
        );

    const title =
        buildSignalTitle({
            kind,
            asset,
            walletLabel,
            direction,
            valueUsd,
        });

    const summary =
        buildSignalSummary({
            kind,
            chain,
            asset,
            walletAddress,
            walletLabel,
            direction,
            valueUsd,
        });

    if (
        !title ||
        !summary
    ) {
        return null;
    }

    return {
        type: kind,

        title,

        summary,

        provider: "dune",

        explorerUrl:
            buildExplorerUrl({
                chain,
                transactionHash,
            }),

        timestamp,

        confidenceScore,

        chain,

        asset,

        walletAddress,

        walletLabel,

        transactionHash,

        valueUsd,

        direction,
    };
}

function passesInputFilters(
    signal: OnchainSignal,
    input: OnchainAnalyzeInput,
): boolean {
    if (
        typeof signal.valueUsd ===
        "number" &&
        signal.valueUsd <
        input.minimumTransferUsd
    ) {
        return false;
    }

    if (
        input.assets.length > 0 &&
        signal.asset &&
        !input.assets.some(
            (asset) =>
                asset.toLowerCase() ===
                signal.asset?.toLowerCase(),
        )
    ) {
        return false;
    }

    if (
        input.chains.length > 0 &&
        signal.chain &&
        !input.chains.some(
            (chain) =>
                chain.toLowerCase() ===
                signal.chain?.toLowerCase(),
        )
    ) {
        return false;
    }

    return true;
}

function calculateNetFlow(
    queries: ExecutedDuneQuery[],
    kind: DuneQueryKind,
): number | undefined {
    const rows = queries
        .filter(
            (query) =>
                query.kind === kind,
        )
        .flatMap(
            (query) => query.rows,
        );

    if (rows.length === 0) {
        return undefined;
    }

    const explicitNetFlow =
        rows
            .map((row) =>
                readNumber(row, [
                    "net_flow_usd",
                    "net_usd",
                    "net_value_usd",
                ]),
            )
            .filter(
                (
                    value,
                ): value is number =>
                    value !== undefined,
            );

    if (
        explicitNetFlow.length > 0
    ) {
        return explicitNetFlow.reduce(
            (total, value) =>
                total + value,
            0,
        );
    }

    let net = 0;
    let found = false;

    for (const row of rows) {
        const valueUsd =
            readNumber(row, [
                "value_usd",
                "amount_usd",
                "usd_value",
            ]);

        if (
            valueUsd === undefined
        ) {
            continue;
        }

        const direction =
            normalizeDirection(
                readString(row, [
                    "direction",
                    "flow_direction",
                ]),
                row,
                kind,
            );

        found = true;

        if (direction === "inflow") {
            net += valueUsd;
        } else if (
            direction === "outflow"
        ) {
            net -= valueUsd;
        }
    }

    return found ? net : undefined;
}

function calculateAccumulationScore({
    signals,
    netExchangeFlowUsd,
    netBridgeFlowUsd,
}: {
    signals: OnchainSignal[];
    netExchangeFlowUsd?: number;
    netBridgeFlowUsd?: number;
}): number | undefined {
    if (signals.length === 0) {
        return undefined;
    }

    let score = 0;
    let weight = 0;

    for (const signal of signals) {
        const signalWeight = Math.max(
            1,
            Math.log10(
                Math.max(
                    signal.valueUsd ?? 1,
                    1,
                ),
            ),
        );

        if (
            signal.direction === "outflow"
        ) {
            score += signalWeight;
        } else if (
            signal.direction === "inflow"
        ) {
            score -= signalWeight;
        }

        weight += signalWeight;
    }

    if (
        netExchangeFlowUsd !== undefined
    ) {
        score +=
            netExchangeFlowUsd < 0
                ? 2
                : netExchangeFlowUsd > 0
                    ? -2
                    : 0;

        weight += 2;
    }

    if (
        netBridgeFlowUsd !== undefined
    ) {
        score +=
            netBridgeFlowUsd > 0
                ? 1
                : netBridgeFlowUsd < 0
                    ? -1
                    : 0;

        weight += 1;
    }

    if (weight === 0) {
        return 0;
    }

    return clamp(
        score / weight,
        -1,
        1,
    );
}

function buildSummary({
    signals,
    netExchangeFlowUsd,
    netBridgeFlowUsd,
    accumulationScore,
    successfulQueries,
    totalQueries,
}: {
    signals: OnchainSignal[];
    netExchangeFlowUsd?: number;
    netBridgeFlowUsd?: number;
    accumulationScore?: number;
    successfulQueries: number;
    totalQueries: number;
}): string {
    const parts = [
        `Dune returned ${signals.length} relevant onchain signals.`,
        `${successfulQueries} of ${totalQueries} configured queries completed successfully.`,
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

    if (
        netBridgeFlowUsd !== undefined
    ) {
        parts.push(
            `Net bridge flow: ${netBridgeFlowUsd.toFixed(
                2,
            )} USD.`,
        );
    }

    if (
        accumulationScore !== undefined
    ) {
        parts.push(
            `Accumulation score: ${accumulationScore.toFixed(
                3,
            )}.`,
        );
    }

    return parts.join(" ");
}

function normalizeExecutionState(
    state: string | undefined,
):
    | "pending"
    | "executing"
    | "completed"
    | "failed"
    | "canceled"
    | "unknown" {
    switch (
    state?.trim().toUpperCase()
    ) {
        case "QUERY_STATE_PENDING":
        case "PENDING":
            return "pending";

        case "QUERY_STATE_EXECUTING":
        case "EXECUTING":
            return "executing";

        case "QUERY_STATE_COMPLETED":
        case "COMPLETED":
        case "SUCCESS":
            return "completed";

        case "QUERY_STATE_FAILED":
        case "FAILED":
            return "failed";

        case "QUERY_STATE_CANCELED":
        case "CANCELED":
        case "CANCELLED":
            return "canceled";

        default:
            return "unknown";
    }
}

function normalizeDirection(
    rawDirection: string | undefined,
    row: Record<string, unknown>,
    kind: DuneQueryKind,
): "inflow" | "outflow" | "neutral" {
    const normalized =
        rawDirection
            ?.trim()
            .toLowerCase();

    if (
        normalized &&
        [
            "in",
            "inflow",
            "deposit",
            "to_exchange",
            "stake",
            "staked",
        ].includes(normalized)
    ) {
        return "inflow";
    }

    if (
        normalized &&
        [
            "out",
            "outflow",
            "withdrawal",
            "from_exchange",
            "unstake",
            "unstaked",
        ].includes(normalized)
    ) {
        return "outflow";
    }

    const inflow =
        readNumber(row, [
            "inflow_usd",
            "deposit_usd",
        ]);

    const outflow =
        readNumber(row, [
            "outflow_usd",
            "withdrawal_usd",
        ]);

    if (
        inflow !== undefined ||
        outflow !== undefined
    ) {
        if (
            (inflow ?? 0) >
            (outflow ?? 0)
        ) {
            return "inflow";
        }

        if (
            (outflow ?? 0) >
            (inflow ?? 0)
        ) {
            return "outflow";
        }
    }

    if (
        kind === "staking-flows"
    ) {
        const eventType =
            readString(row, [
                "event_type",
                "action",
            ])
                ?.toLowerCase();

        if (
            eventType?.includes("stake") &&
            !eventType.includes("unstake")
        ) {
            return "inflow";
        }

        if (
            eventType?.includes("unstake")
        ) {
            return "outflow";
        }
    }

    return "neutral";
}

function buildSignalTitle({
    kind,
    asset,
    walletLabel,
    direction,
    valueUsd,
}: {
    kind: DuneQueryKind;
    asset?: string;
    walletLabel?: string;
    direction:
    | "inflow"
    | "outflow"
    | "neutral";
    valueUsd?: number;
}): string {
    const formattedValue =
        valueUsd !== undefined
            ? formatUsd(valueUsd)
            : "large";

    const subject =
        walletLabel ??
        asset ??
        "wallet";

    switch (kind) {
        case "whale-transfers":
            return `${subject} moved ${formattedValue}`;

        case "exchange-flows":
            return `${subject} exchange ${direction}`;

        case "bridge-flows":
            return `${subject} bridge ${direction}`;

        case "staking-flows":
            return `${subject} staking activity`;

        default:
            return "Onchain activity";
    }
}

function buildSignalSummary({
    kind,
    chain,
    asset,
    walletAddress,
    walletLabel,
    direction,
    valueUsd,
}: {
    kind: DuneQueryKind;
    chain?: string;
    asset?: string;
    walletAddress?: string;
    walletLabel?: string;
    direction:
    | "inflow"
    | "outflow"
    | "neutral";
    valueUsd?: number;
}): string {
    const details = [
        walletLabel ??
        walletAddress ??
        "An observed wallet",

        kind.replace(/-/g, " "),

        direction,

        valueUsd !== undefined
            ? formatUsd(valueUsd)
            : undefined,

        asset,

        chain
            ? `on ${chain}`
            : undefined,
    ].filter(Boolean);

    return details.join(" ");
}

function buildExplorerUrl({
    chain,
    transactionHash,
}: {
    chain?: string;
    transactionHash?: string;
}): string | undefined {
    if (!transactionHash) {
        return undefined;
    }

    switch (
    chain?.toLowerCase()
    ) {
        case "ethereum":
            return `https://etherscan.io/tx/${transactionHash}`;

        case "arbitrum":
            return `https://arbiscan.io/tx/${transactionHash}`;

        case "optimism":
            return `https://optimistic.etherscan.io/tx/${transactionHash}`;

        case "base":
            return `https://basescan.org/tx/${transactionHash}`;

        case "polygon":
            return `https://polygonscan.com/tx/${transactionHash}`;

        default:
            return undefined;
    }
}

function sortSignals(
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

function readString(
    row: Record<string, unknown>,
    keys: string[],
): string | undefined {
    for (const key of keys) {
        const value = row[key];

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
    row: Record<string, unknown>,
    keys: string[],
): number | undefined {
    for (const key of keys) {
        const value = row[key];

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

function normalizeConfidence(
    value: number | undefined,
): number | undefined {
    if (value === undefined) {
        return undefined;
    }

    return clamp(value, 0, 1);
}

function safeParseJson(
    value: string,
): unknown {
    try {
        return JSON.parse(value);
    } catch {
        return {
            raw: value,
        };
    }
}

function readErrorMessage(
    value: unknown,
): string | undefined {
    if (!isRecord(value)) {
        return undefined;
    }

    const possibleMessages = [
        value.error,
        value.message,
        value.error_message,
    ];

    for (const message of possibleMessages) {
        if (
            typeof message === "string" &&
            message.trim()
        ) {
            return message;
        }
    }

    return undefined;
}

function normalizeDuneError(
    error: unknown,
): DuneOnchainAdapterError {
    if (
        error instanceof
        DuneOnchainAdapterError
    ) {
        return error;
    }

    if (error instanceof Error) {
        return new DuneOnchainAdapterError({
            code: "DUNE_REQUEST_FAILED",

            message: error.message,

            cause: error,
        });
    }

    return new DuneOnchainAdapterError({
        code: "UNKNOWN_DUNE_ERROR",

        message:
            "An unknown Dune API error occurred.",

        cause: error,
    });
}

function resolveHttpErrorCode(
    status: number,
): string {
    switch (status) {
        case 400:
            return "DUNE_BAD_REQUEST";

        case 401:
            return "DUNE_UNAUTHORIZED";

        case 403:
            return "DUNE_FORBIDDEN";

        case 404:
            return "DUNE_NOT_FOUND";

        case 408:
            return "DUNE_TIMEOUT";

        case 429:
            return "DUNE_RATE_LIMITED";

        case 500:
        case 502:
        case 503:
        case 504:
            return "DUNE_SERVER_ERROR";

        default:
            return "DUNE_API_ERROR";
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

function passesFiniteNumber(
    value: unknown,
): value is number {
    return (
        typeof value === "number" &&
        Number.isFinite(value)
    );
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

function formatUsd(
    value: number,
): string {
    return new Intl.NumberFormat(
        "en-US",
        {
            style: "currency",
            currency: "USD",
            notation: "compact",
            maximumFractionDigits: 2,
        },
    ).format(value);
}

function delay(
    milliseconds: number,
): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
    });
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