import type {
    AgentManifest,
    CustomAgentProtocolVersion,
} from "@bruhmarket/agent-sdk";

import type {
    CustomAgentRunConfig,
    CustomAgentRunMarket,
} from "@bruhmarket/agent-sdk";



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

export interface AgentListingRecord {
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

    visibility:
    AgentListingVisibility;

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

export interface AgentVersionRecord {
    id: string;

    listing_id: string;

    version: string;

    manifest: AgentManifest;

    endpoint_url: string;

    protocol_version:
    CustomAgentProtocolVersion;

    signing_public_key?: string | null;

    release_notes?: string | null;

    checksum?: string | null;

    status: AgentVersionStatus;

    published_at?: string | null;

    created_at: string;
}

export interface AgentInstallationRecord {
    id: string;

    listing_id: string;

    version_id: string;

    user_address: string;

    agent_wallet_id?: string | null;

    enabled: boolean;

    auto_update: boolean;

    pinned_version?: string | null;

    configuration:
    Record<string, unknown>;

    permissions:
    Record<string, unknown>;

    installed_at: string;

    updated_at: string;
}

export interface CreateAgentListingDto {
    customAgentId: string;

    slug: string;

    name: string;

    shortDescription: string;

    longDescription?: string;

    categories?: string[];

    tags?: string[];

    iconUrl?: string;

    bannerUrl?: string;

    visibility?:
    AgentListingVisibility;
}

export interface PublishAgentVersionDto {
    version: string;

    releaseNotes?: string;
}

export interface InstallAgentDto {
    version?: string;

    agentWalletId?: string;

    autoUpdate?: boolean;

    configuration?: Record<
        string,
        unknown
    >;

    permissions?: Record<
        string,
        unknown
    >;
}

export interface RunInstalledAgentDto {
    market: CustomAgentRunMarket;

    config?: Partial<
        CustomAgentRunConfig
    >;

    context?: {
        previousRunIds?: string[];

        previousSummary?: string;

        metadata?: Record<
            string,
            unknown
        >;
    };

    wallet?: {
        agentId: string;

        address: `0x${string}`;

        availableBalanceUsdc: number;
    };
}
