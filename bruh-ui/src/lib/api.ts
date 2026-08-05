

import type {
    AgentRun,
    RunAgentResponse,
    AgentAutonomyConfig,
    UpdateAgentAutonomyConfig,
    ExecutionPlan,
} from "@/components/dashboard/dashboard.types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";


export type AgentListingVisibility =
    | "private"
    | "unlisted"
    | "public";

export type AgentListingVerificationStatus =
    | "pending"
    | "verified"
    | "rejected";

export type AgentVersionStatus =
    | "draft"
    | "published"
    | "deprecated"
    | "disabled";

export interface AgentManifest {
    id: string;
    name: string;
    version: string;
    description: string;
    source: string;
    difficulty: string;

    author?: {
        name: string;
        url?: string;
    };

    categories: string[];
    capabilities: string[];

    permissions: {
        canResearch: boolean;
        canPurchaseResearch: boolean;
        canTrade: boolean;
        canAccessHistoricalData: boolean;
        canAccessOnchainData: boolean;
        canUseExternalApis: boolean;
        maximumTradeUsdc: number;
    };
}

export interface AgentListing {
    id: string;
    custom_agent_id: string;
    publisher_address: string;
    slug: string;
    name: string;
    short_description: string;
    long_description?: string | null;
    categories: string[];
    tags: string[];
    icon_url?: string | null;
    banner_url?: string | null;
    visibility: AgentListingVisibility;
    verification_status:
    AgentListingVerificationStatus;
    latest_version?: string | null;
    installation_count: number;
    average_rating?: number | null;
    rating_count: number;
    active: boolean;
    created_at: string;
    updated_at: string;
}

export interface AgentVersion {
    id: string;
    listing_id: string;
    version: string;
    manifest: AgentManifest;
    endpoint_url: string;
    protocol_version: string;
    signing_public_key?: string | null;
    release_notes?: string | null;
    checksum?: string | null;
    status:
    | "draft"
    | "published"
    | "deprecated"
    | "disabled";
    published_at?: string | null;
    created_at: string;
}

export interface AgentInstallation {
    id: string;
    listing_id: string;
    version_id: string;
    user_address: string;
    agent_wallet_id?: string | null;
    enabled: boolean;
    auto_update: boolean;
    pinned_version?: string | null;
    configuration: Record<string, unknown>;
    permissions: Record<string, unknown>;
    installed_at: string;
    updated_at: string;
}

export interface InstalledAgent {
    installation: AgentInstallation;
    listing: AgentListing;
    version: AgentVersion;
}

export interface PublicAgentListingResponse {
    listing: AgentListing;
    versions: AgentVersion[];
}

export interface InstallAgentInput {
    version?: string;
    agentWalletId?: string;
    autoUpdate?: boolean;
    configuration?: Record<string, unknown>;
    permissions?: Record<string, unknown>;
}

export interface InstalledAgentMarket {
    id: string;
    address: string;
    question: string;
    yesPrice: number;
    noPrice: number;
    open: boolean;
    resolved: boolean;
    network: string;
    description?: string;
    resolutionCriteria?: string;
    closesAt?: string;
}

export interface RunInstalledAgentInput {
    market: InstalledAgentMarket;

    config?: {
        edgeThreshold?: number;
        kellyFraction?: number;
        maxPositionUsdc?: number;
        researchBudgetUsdc?: number;
        maxResearchSources?: number;
        minimumConfidence?: number;
    };

    context?: {
        previousRunIds?: string[];
        previousSummary?: string;
        metadata?: Record<string, unknown>;
    };

    wallet?: {
        agentId: string;
        address: `0x${string}`;
        availableBalanceUsdc: number;
    };
}

export interface InstalledAgentRunResult {
    runId: string;
    customAgentId: string;
    installationId?: string;
    requestId: string;
    dryRun: true;
    status: "passed";
    durationMs: number;
    persisted: true;

    response: {
        protocolVersion: string;
        requestId: string;

        agent: {
            id: string;
            version: string;
        };

        status: string;

        research?: {
            summary: string;
            evidence: unknown[];
            costUsdc: number;
        };

        estimate: {
            probability: number;
            confidence: number;
            reasoning: string;
            keyFactors: string[];
            risks: string[];
            recommendedAction:
            | "BUY_YES"
            | "BUY_NO"
            | "PASS";
        };

        completedAt: string;
        metadata?: Record<string, unknown>;
    };

    decision: {
        action:
        | "BUY_YES"
        | "BUY_NO"
        | "PASS";

        probability: number;
        confidence: number;
        marketProbability: number;
        edge: number;
        amountUsdc: number;
        reasoning: string;
        keyFactors: string[];
        risks: string[];
        researchCostUsdc: number;
        shouldExecute: boolean;

        riskChecks: Array<{
            id: string;
            passed: boolean;
            message: string;
            value?: number;
            limit?: number;
        }>;

        metadata?: Record<string, unknown>;
    };

    executionPlan: ExecutionPlan;
}

export interface RunInstalledAgentInput {
    market: InstalledAgentMarket;

    config?: {
        edgeThreshold?: number;
        kellyFraction?: number;
        maxPositionUsdc?: number;
        researchBudgetUsdc?: number;
        maxResearchSources?: number;
        minimumConfidence?: number;
    };

    context?: {
        previousRunIds?: string[];
        previousSummary?: string;
        metadata?: Record<string, unknown>;
    };

    wallet?: {
        agentId: string;
        address: `0x${string}`;
        availableBalanceUsdc: number;
    };
}

export interface PublicMarket {
    id: string;
    address: `0x${string}`;
    question: string;
    closeTime: string;
    closeTimeUnix: number;
    createdAt: string;
    creator: `0x${string}`;
    oracle: `0x${string}`;
    outcome:
    | "UNRESOLVED"
    | "YES"
    | "NO"
    | "INVALID";
    yesPrice: number;
    noPrice: number;
    collateralUsdc: number;
    totalSharesYes: number;
    totalSharesNo: number;
    feeBps: number;
    open: boolean;
    resolved: boolean;
    network: "eip155:5042002";
}

// export interface InstalledAgentRunResult {
//     runId: string;
//     customAgentId: string;
//     installationId?: string;
//     requestId: string;
//     dryRun: true;
//     status: "passed";
//     durationMs: number;
//     persisted: true;

//     decision: {
//         action:
//         | "BUY_YES"
//         | "BUY_NO"
//         | "PASS";

//         probability: number;
//         confidence: number;
//         marketProbability: number;
//         edge: number;
//         amountUsdc: number;
//         reasoning: string;
//         keyFactors: string[];
//         risks: string[];
//         researchCostUsdc: number;
//         shouldExecute: boolean;
//     };

//     executionPlan: {
//         status: string;
//     };

//     response: {
//         protocolVersion: string;
//         requestId: string;
//         status: string;
//     };
// }

export async function getNonce(): Promise<string> {
    const res = await fetch(`${API_URL}/auth/nonce`);
    const data = await res.json();
    return data.message;
}

export async function verifySignature(
    address: string,
    signature: string,
    message: string
): Promise<string> {
    const res = await fetch(`${API_URL}/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, signature, message }),
    });
    const data = await res.json();
    return data.token;
}

export async function createAgentWallet(token: string, strategy: string, agentName: string): Promise<any> {
    const res = await fetch(`${API_URL}/wallets`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ strategy, agentName }),
    });
    return res.json();
}

export async function getMyWallets(token: string): Promise<any[]> {
    const res = await fetch(`${API_URL}/wallets`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.json();
}


export async function getRuns(
    token: string,
    walletId: string,
) {
    const res = await fetch(
        `${API_URL}/agents/${walletId}/runs`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        },
    );

    if (!res.ok) {
        throw new Error(await res.text());
    }

    return res.json();
}

export async function runAgent(
    token: string,
    walletId: string,
    marketAddress: string,
    autoExecute = false,
): Promise<RunAgentResponse> {
    const response = await fetch(
        `${API_URL}/agents/${walletId}/run`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                marketAddress,
                autoExecute,
            }),
        },
    );

    return readApiResponse<RunAgentResponse>(
        response,
    );
}

export async function getAgentRuns(
    token: string,
    walletId: string,
    limit = 30,
): Promise<AgentRun[]> {
    const response = await fetch(
        `${API_URL}/agents/${walletId}/runs?limit=${limit}`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        },
    );

    const data =
        await readApiResponse<unknown>(
            response,
        );

    return Array.isArray(data)
        ? (data as AgentRun[])
        : [];
}

export async function getAgentRun(
    token: string,
    runId: string,
): Promise<AgentRun> {
    const response = await fetch(
        `${API_URL}/agents/runs/${runId}`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        },
    );

    return readApiResponse<AgentRun>(
        response,
    );
}

async function readApiResponse<T>(
    response: Response,
): Promise<T> {
    const text =
        await response.text();

    let data: any =
        null;

    if (text) {
        try {
            data =
                JSON.parse(text);
        } catch {
            data =
                text;
        }
    }

    if (!response.ok) {
        const message =
            typeof data?.message ===
                "string"
                ? data.message
                : typeof data ===
                    "string"
                    ? data
                    : `Request failed with status ${response.status}`;

        throw new Error(
            message,
        );
    }

    return data as T;
}

export async function getAgentAutonomy(
    token: string,
    walletId: string,
): Promise<AgentAutonomyConfig> {
    const response = await fetch(
        `${API_URL}/agents/${walletId}/autonomy`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        },
    );

    const data = await response.json();

    if (!response.ok) {
        const payload =
            await response.json();

        throw {
            code:
                payload.code,
            message:
                payload.message,
        };
    }

    return data as AgentAutonomyConfig;
}

export async function updateAgentAutonomy(
    token: string,
    walletId: string,
    config: UpdateAgentAutonomyConfig,
): Promise<unknown> {
    const response = await fetch(
        `${API_URL}/agents/${walletId}/autonomy`,
        {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(config),
        },
    );

    const data = await response.json();

    if (!response.ok) {
        const payload =
            await response.json();

        throw {
            code:
                payload.code,
            message:
                payload.message,
        };
    }
    return data;
}




export async function uninstallAgent(
    token: string,
    installationId: string,
): Promise<{
    deleted: true;
}> {
    const response =
        await fetch(
            `${API_URL}/agent-registry/installations/${installationId}`,
            {
                method:
                    "DELETE",

                headers: {
                    Authorization:
                        `Bearer ${token}`,
                },
            },
        );

    return readApiResponse<{
        deleted: true;
    }>(response);
}

export async function setAgentInstallationEnabled(
    token: string,
    installationId: string,
    enabled: boolean,
): Promise<AgentInstallation> {
    const response =
        await fetch(
            `${API_URL}/agent-registry/installations/${installationId}/enabled`,
            {
                method:
                    "PATCH",

                headers: {
                    "Content-Type":
                        "application/json",

                    Authorization:
                        `Bearer ${token}`,
                },

                body:
                    JSON.stringify({
                        enabled,
                    }),
            },
        );

    return readApiResponse<
        AgentInstallation
    >(response);
}

export async function upgradeAgentInstallation(
    token: string,
    installationId: string,
    version?: string,
): Promise<AgentInstallation> {
    const response =
        await fetch(
            `${API_URL}/agent-registry/installations/${installationId}/upgrade`,
            {
                method:
                    "POST",

                headers: {
                    "Content-Type":
                        "application/json",

                    Authorization:
                        `Bearer ${token}`,
                },

                body:
                    JSON.stringify({
                        version,
                    }),
            },
        );

    return readApiResponse<
        AgentInstallation
    >(response);
}

// export async function runInstalledAgent(
//     token: string,
//     installationId: string,
//     input: RunInstalledAgentInput,
// ): Promise<InstalledAgentRunResult> {
//     const response =
//         await fetch(
//             `${API_URL}/agent-registry/installations/${installationId}/run`,
//             {
//                 method:
//                     "POST",

//                 headers: {
//                     "Content-Type":
//                         "application/json",

//                     Authorization:
//                         `Bearer ${token}`,
//                 },

//                 body:
//                     JSON.stringify(
//                         input,
//                     ),
//             },
//         );

//     return readApiResponse<
//         InstalledAgentRunResult
//     >(response);
// }

export async function getPublicAgentListings(
    options?: {
        category?: string;
        tag?: string;
        search?: string;
        limit?: number;
        offset?: number;
    },
): Promise<AgentListing[]> {
    const params =
        new URLSearchParams();

    if (options?.category) {
        params.set(
            "category",
            options.category,
        );
    }

    if (options?.tag) {
        params.set(
            "tag",
            options.tag,
        );
    }

    if (options?.search) {
        params.set(
            "search",
            options.search,
        );
    }

    if (options?.limit !== undefined) {
        params.set(
            "limit",
            String(options.limit),
        );
    }

    if (options?.offset !== undefined) {
        params.set(
            "offset",
            String(options.offset),
        );
    }

    const query =
        params.toString();

    const response =
        await fetch(
            `${API_URL}/agent-registry${query ? `?${query}` : ""
            }`,
            {
                cache: "no-store",
            },
        );

    const data =
        await readApiResponse<unknown>(
            response,
        );

    return Array.isArray(data)
        ? (data as AgentListing[])
        : [];
}

export async function getMyAgentInstallations(
    token: string,
): Promise<InstalledAgent[]> {
    const response =
        await fetch(
            `${API_URL}/agent-registry/installations/mine`,
            {
                headers: {
                    Authorization:
                        `Bearer ${token}`,
                },
                cache: "no-store",
            },
        );

    const data =
        await readApiResponse<unknown>(
            response,
        );

    return Array.isArray(data)
        ? (data as InstalledAgent[])
        : [];
}

export async function installAgent(
    token: string,
    listingId: string,
    input: InstallAgentInput = {},
): Promise<AgentInstallation> {
    const response =
        await fetch(
            `${API_URL}/agent-registry/${listingId}/install`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json",

                    Authorization:
                        `Bearer ${token}`,
                },

                body:
                    JSON.stringify(input),
            },
        );

    return readApiResponse<
        AgentInstallation
    >(response);
}

export async function getPublicAgentListing(
    slug: string,
): Promise<PublicAgentListingResponse> {
    const response = await fetch(
        `${API_URL}/agent-registry/public/${encodeURIComponent(slug)}`,
        {
            cache: "no-store",
        },
    );

    return readApiResponse<PublicAgentListingResponse>(
        response,
    );
}

// export async function runInstalledAgent(
//     token: string,
//     installationId: string,
//     body: {
//         market: {
//             id: string;
//             address: string;
//             question: string;
//             yesPrice: number;
//             noPrice: number;
//             open: boolean;
//             resolved: boolean;
//             network: string;
//         };
//     },
// ) {
//     const response = await fetch(
//         `${API_URL}/agent-registry/installations/${installationId}/run`,
//         {
//             method: "POST",
//             headers: {
//                 Authorization: `Bearer ${token}`,
//                 "Content-Type": "application/json",
//             },
//             body: JSON.stringify(body),
//         },
//     );

//     return readApiResponse(response);
// }

export async function runInstalledAgent(
    token: string,
    installationId: string,
    input: RunInstalledAgentInput,
): Promise<InstalledAgentRunResult> {
    const response =
        await fetch(
            `${API_URL}/agent-registry/installations/${installationId}/run`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json",

                    Authorization:
                        `Bearer ${token}`,
                },

                body:
                    JSON.stringify(input),
            },
        );

    return readApiResponse<
        InstalledAgentRunResult
    >(response);
}

export async function getInstalledAgentRuns(
    token: string,
    installationId: string,
    limit = 30,
): Promise<AgentRun[]> {
    const response =
        await fetch(
            `${API_URL}/agent-registry/installations/${installationId}/runs?limit=${limit}`,
            {
                headers: {
                    Authorization:
                        `Bearer ${token}`,
                },

                cache:
                    "no-store",
            },
        );

    const data =
        await readApiResponse<unknown>(
            response,
        );

    return Array.isArray(data)
        ? data as AgentRun[]
        : [];
}

export function getApiErrorMessage(error: unknown): string {
    if (!(error instanceof Error)) {
        return "Something went wrong.";
    }

    const message = error.message;

    if (message.includes("AGENT_OFFLINE")) {
        return "The agent is currently offline.";
    }

    if (message.includes("AGENT_TIMEOUT")) {
        return "The agent took too long to respond.";
    }

    if (message.includes("AGENT_VERSION_MISMATCH")) {
        return "The installed agent version doesn't match the deployed version.";
    }

    if (message.includes("INVALID_PROTOCOL")) {
        return "The agent returned an invalid protocol response.";
    }

    if (message.includes("INSTALLATION_DISABLED")) {
        return "This agent is currently disabled.";
    }

    if (
        message.includes("Failed to fetch") ||
        message.includes("NetworkError")
    ) {
        return "Unable to reach the server.";
    }

    if (message.includes("500")) {
        return "The server encountered an unexpected error.";
    }

    return message;
}

export async function getPublicMarkets(
    limit = 100,
): Promise<PublicMarket[]> {
    const response = await fetch(
        `${API_URL}/markets?limit=${limit}`,
        {
            cache: "no-store",
        },
    );

    const data =
        await readApiResponse<unknown>(
            response,
        );

    return Array.isArray(data)
        ? (data as PublicMarket[])
        : [];
}

export async function getPublicMarket(
    address: string,
): Promise<PublicMarket> {
    const response = await fetch(
        `${API_URL}/markets/${address}`,
        {
            cache: "no-store",
        },
    );

    return readApiResponse<PublicMarket>(
        response,
    );
}