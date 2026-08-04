export const CUSTOM_AGENT_PROTOCOL_VERSION =
    "2026-08-01" as const;

export type CustomAgentProtocolVersion =
    typeof CUSTOM_AGENT_PROTOCOL_VERSION;

export type CustomAgentAction =
    | "BUY_YES"
    | "BUY_NO"
    | "PASS";

export interface CustomAgentRunMarket {
    id: string;

    address?: `0x${string}`;

    question: string;

    description?: string;

    resolutionCriteria?: string;

    yesPrice: number;

    noPrice: number;

    open: boolean;

    resolved: boolean;

    closesAt?: string;

    network: string;

    metadata?: Record<
        string,
        unknown
    >;
}

export interface CustomAgentRunPermissions {
    canResearch: boolean;

    canPurchaseResearch: boolean;

    canTrade: boolean;

    canAccessHistoricalData: boolean;

    canAccessOnchainData: boolean;

    canUseExternalApis: boolean;

    maximumTradeUsdc: number;
}

export interface CustomAgentRunConfig {
    edgeThreshold: number;

    kellyFraction: number;

    maxPositionUsdc: number;

    researchBudgetUsdc: number;

    maxResearchSources: number;

    minimumConfidence: number;

    dryRun: boolean;
}

export interface CustomAgentRunRequest {
    protocolVersion:
    CustomAgentProtocolVersion;

    requestId: string;

    issuedAt: string;

    expiresAt: string;

    agent: {
        id: string;

        version: string;
    };

    market: CustomAgentRunMarket;

    permissions:
    CustomAgentRunPermissions;

    config: CustomAgentRunConfig;

    context?: {
        previousRunIds?: string[];

        previousSummary?: string;

        metadata?: Record<
            string,
            unknown
        >;
    };

    metadata?: Record<
        string,
        unknown
    >;
}

export interface CustomAgentEvidence {
    type:
    | "news"
    | "historical"
    | "onchain"
    | "market"
    | "custom";

    title: string;

    summary?: string;

    source: string;

    url?: string;

    publishedAt?: string;

    credibilityScore?: number;

    metadata?: Record<
        string,
        unknown
    >;
}

export interface CustomAgentResearchOutput {
    summary: string;

    evidence: CustomAgentEvidence[];

    costUsdc: number;

    metadata?: Record<
        string,
        unknown
    >;
}

export interface CustomAgentEstimateOutput {
    probability: number;

    confidence: number;

    reasoning: string;

    keyFactors: string[];

    risks: string[];

    recommendedAction:
    CustomAgentAction;

    metadata?: Record<
        string,
        unknown
    >;
}

export interface CustomAgentRunResponse {
    protocolVersion:
    CustomAgentProtocolVersion;

    requestId: string;

    agent: {
        id: string;

        version: string;
    };

    status: "completed";

    research?:
    CustomAgentResearchOutput;

    estimate:
    CustomAgentEstimateOutput;

    completedAt: string;

    metadata?: Record<
        string,
        unknown
    >;
}

export interface CustomAgentErrorResponse {
    protocolVersion:
    CustomAgentProtocolVersion;

    requestId: string;

    status: "failed";

    error: {
        code: string;

        message: string;

        retryable: boolean;

        details?: Record<
            string,
            unknown
        >;
    };

    completedAt: string;
}

export type CustomAgentResponse =
    | CustomAgentRunResponse
    | CustomAgentErrorResponse;

export interface CustomAgentHealthResponse {
    protocolVersion:
    CustomAgentProtocolVersion;

    status:
    | "healthy"
    | "degraded"
    | "unavailable";

    agent: {
        id: string;

        name: string;

        version: string;
    };

    checkedAt: string;
}

export class CustomAgentProtocolError
    extends Error {
    readonly code: string;

    constructor(input: {
        code: string;

        message: string;

        cause?: unknown;
    }) {
        super(input.message);

        this.name =
            "CustomAgentProtocolError";

        this.code =
            input.code;

        if (
            input.cause !==
            undefined
        ) {
            this.cause =
                input.cause;
        }
    }
}