import type {
    AgentManifest,
    CustomAgentProtocolVersion,
} from "@bruhmarket/agent-sdk";

export type CustomAgentVerificationStatus =
    | "pending"
    | "verified"
    | "failed";

export interface CustomAgentRecord {
    id: string;

    owner_address: string;

    manifest: AgentManifest;

    endpoint_url: string;

    protocol_version:
    CustomAgentProtocolVersion;

    signing_public_key?: string | null;

    verification_status:
    CustomAgentVerificationStatus;

    active: boolean;

    last_verified_at?: string | null;

    last_error?: string | null;

    created_at: string;

    updated_at: string;
}

export interface RegisterCustomAgentDto {
    manifest: AgentManifest;

    endpointUrl: string;

    signingPublicKey?: string;
}

export interface UpdateCustomAgentDto {
    manifest?: AgentManifest;

    endpointUrl?: string;

    signingPublicKey?: string | null;

    active?: boolean;
}