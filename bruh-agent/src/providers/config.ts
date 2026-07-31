export interface AnthropicProviderConfig {
    apiKey: string;
    model: string;
    baseUrl: string;
    timeoutMs: number;
    maxTokens: number;
    temperature: number;
}

export interface TavilyProviderConfig {
    apiKey: string;
    baseUrl: string;
    timeoutMs: number;
    searchDepth: "basic" | "advanced";
    maximumResults: number;
}

export interface SupabaseProviderConfig {
    url: string;
    serviceRoleKey: string;
    historicalEventsTable: string;
}

export interface DuneProviderConfig {
    apiKey: string;
    baseUrl: string;
    timeoutMs: number;

    /**
     * Optional pre-created Dune query IDs.
     * These can be supplied later through environment variables.
     */
    queryIds: {
        whaleTransfers?: number;
        exchangeFlows?: number;
        bridgeFlows?: number;
        stakingFlows?: number;
    };
}

export interface X402ProviderConfig {
    enabled: boolean;
    facilitatorUrl?: string;
    network: string;
    maximumPaymentUsdc: number;
    timeoutMs: number;
}

export interface BruhProviderConfig {
    anthropic: AnthropicProviderConfig;
    tavily: TavilyProviderConfig;
    supabase: SupabaseProviderConfig;
    dune: DuneProviderConfig;
    x402: X402ProviderConfig;
}

export class ProviderConfigurationError extends Error {
    readonly variable?: string;

    constructor(message: string, variable?: string) {
        super(message);

        this.name = "ProviderConfigurationError";
        this.variable = variable;
    }
}

export function loadProviderConfig(
    environment: NodeJS.ProcessEnv = process.env,
): BruhProviderConfig {
    return {
        anthropic: {
            apiKey: requireEnvironmentVariable(
                environment,
                "ANTHROPIC_API_KEY",
            ),

            model:
                environment.ANTHROPIC_MODEL ??
                "claude-sonnet-4-6",

            baseUrl:
                environment.ANTHROPIC_BASE_URL ??
                "https://api.anthropic.com",

            timeoutMs: parsePositiveInteger(
                environment.ANTHROPIC_TIMEOUT_MS,
                30_000,
                "ANTHROPIC_TIMEOUT_MS",
            ),

            maxTokens: parsePositiveInteger(
                environment.ANTHROPIC_MAX_TOKENS,
                1_200,
                "ANTHROPIC_MAX_TOKENS",
            ),

            temperature: parseNumberInRange(
                environment.ANTHROPIC_TEMPERATURE,
                0.2,
                0,
                1,
                "ANTHROPIC_TEMPERATURE",
            ),
        },

        tavily: {
            apiKey: requireEnvironmentVariable(
                environment,
                "TAVILY_API_KEY",
            ),

            baseUrl:
                environment.TAVILY_BASE_URL ??
                "https://api.tavily.com",

            timeoutMs: parsePositiveInteger(
                environment.TAVILY_TIMEOUT_MS,
                15_000,
                "TAVILY_TIMEOUT_MS",
            ),

            searchDepth:
                environment.TAVILY_SEARCH_DEPTH === "advanced"
                    ? "advanced"
                    : "basic",

            maximumResults: parsePositiveInteger(
                environment.TAVILY_MAX_RESULTS,
                10,
                "TAVILY_MAX_RESULTS",
            ),
        },

        supabase: {
            url: requireEnvironmentVariable(
                environment,
                "SUPABASE_URL",
            ),

            serviceRoleKey: requireEnvironmentVariable(
                environment,
                "SUPABASE_SERVICE_ROLE_KEY",
            ),

            historicalEventsTable:
                environment.SUPABASE_HISTORICAL_EVENTS_TABLE ??
                "historical_market_events",
        },

        dune: {
            apiKey: requireEnvironmentVariable(
                environment,
                "DUNE_API_KEY",
            ),

            baseUrl:
                environment.DUNE_BASE_URL ??
                "https://api.dune.com/api/v1",

            timeoutMs: parsePositiveInteger(
                environment.DUNE_TIMEOUT_MS,
                30_000,
                "DUNE_TIMEOUT_MS",
            ),

            queryIds: {
                whaleTransfers: parseOptionalPositiveInteger(
                    environment.DUNE_WHALE_TRANSFERS_QUERY_ID,
                    "DUNE_WHALE_TRANSFERS_QUERY_ID",
                ),

                exchangeFlows: parseOptionalPositiveInteger(
                    environment.DUNE_EXCHANGE_FLOWS_QUERY_ID,
                    "DUNE_EXCHANGE_FLOWS_QUERY_ID",
                ),

                bridgeFlows: parseOptionalPositiveInteger(
                    environment.DUNE_BRIDGE_FLOWS_QUERY_ID,
                    "DUNE_BRIDGE_FLOWS_QUERY_ID",
                ),

                stakingFlows: parseOptionalPositiveInteger(
                    environment.DUNE_STAKING_FLOWS_QUERY_ID,
                    "DUNE_STAKING_FLOWS_QUERY_ID",
                ),
            },
        },

        x402: {
            enabled: parseBoolean(
                environment.X402_ENABLED,
                false,
            ),

            facilitatorUrl:
                environment.X402_FACILITATOR_URL,

            network:
                environment.X402_NETWORK ??
                "eip155:5042002",

            maximumPaymentUsdc: parseNonNegativeNumber(
                environment.X402_MAX_PAYMENT_USDC,
                0.05,
                "X402_MAX_PAYMENT_USDC",
            ),

            timeoutMs: parsePositiveInteger(
                environment.X402_TIMEOUT_MS,
                20_000,
                "X402_TIMEOUT_MS",
            ),
        },
    };
}

function requireEnvironmentVariable(
    environment: NodeJS.ProcessEnv,
    variable: string,
): string {
    const value = environment[variable]?.trim();

    if (!value) {
        throw new ProviderConfigurationError(
            `Missing required environment variable: ${variable}`,
            variable,
        );
    }

    return value;
}

function parsePositiveInteger(
    value: string | undefined,
    fallback: number,
    variable: string,
): number {
    if (value === undefined || value.trim() === "") {
        return fallback;
    }

    const parsed = Number(value);

    if (
        !Number.isInteger(parsed) ||
        parsed <= 0
    ) {
        throw new ProviderConfigurationError(
            `${variable} must be a positive integer.`,
            variable,
        );
    }

    return parsed;
}

function parseOptionalPositiveInteger(
    value: string | undefined,
    variable: string,
): number | undefined {
    if (value === undefined || value.trim() === "") {
        return undefined;
    }

    return parsePositiveInteger(
        value,
        1,
        variable,
    );
}

function parseNumberInRange(
    value: string | undefined,
    fallback: number,
    minimum: number,
    maximum: number,
    variable: string,
): number {
    if (value === undefined || value.trim() === "") {
        return fallback;
    }

    const parsed = Number(value);

    if (
        !Number.isFinite(parsed) ||
        parsed < minimum ||
        parsed > maximum
    ) {
        throw new ProviderConfigurationError(
            `${variable} must be between ${minimum} and ${maximum}.`,
            variable,
        );
    }

    return parsed;
}

function parseNonNegativeNumber(
    value: string | undefined,
    fallback: number,
    variable: string,
): number {
    if (value === undefined || value.trim() === "") {
        return fallback;
    }

    const parsed = Number(value);

    if (
        !Number.isFinite(parsed) ||
        parsed < 0
    ) {
        throw new ProviderConfigurationError(
            `${variable} must be a non-negative number.`,
            variable,
        );
    }

    return parsed;
}

function parseBoolean(
    value: string | undefined,
    fallback: boolean,
): boolean {
    if (value === undefined || value.trim() === "") {
        return fallback;
    }

    const normalized = value
        .trim()
        .toLowerCase();

    if (
        ["true", "1", "yes", "on"].includes(normalized)
    ) {
        return true;
    }

    if (
        ["false", "0", "no", "off"].includes(normalized)
    ) {
        return false;
    }

    return fallback;
}