import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from "@nestjs/common";

import {
    validateAgentManifest,
    type AgentManifest,
} from "@bruhmarket/agent-sdk";

import {
    SupabaseService,
} from "../supabase.service";

import type {
    CustomAgentRecord,
    RegisterCustomAgentDto,
    UpdateCustomAgentDto,
} from "./custom-agent.types";

import {
    CUSTOM_AGENT_PROTOCOL_VERSION,
    type CustomAgentHealthResponse,
} from "@bruhmarket/agent-sdk";

@Injectable()
export class CustomAgentService {
    constructor(
        private readonly supabase:
            SupabaseService,
    ) { }

    async register(input: {
        ownerAddress: string;
        dto: RegisterCustomAgentDto;
    }): Promise<CustomAgentRecord> {
        this.assertValidManifest(
            input.dto.manifest,
        );

        const endpointUrl =
            this.normalizeEndpointUrl(
                input.dto.endpointUrl,
            );

        const now =
            new Date().toISOString();

        const {
            data,
            error,
        } =
            await this.supabase.db
                .from("custom_agents")
                .insert({
                    owner_address:
                        input.ownerAddress
                            .toLowerCase(),

                    manifest:
                        input.dto.manifest,

                    endpoint_url:
                        endpointUrl,

                    protocol_version:
                        CUSTOM_AGENT_PROTOCOL_VERSION,

                    signing_public_key:
                        input.dto
                            .signingPublicKey ??
                        null,

                    verification_status:
                        "pending",

                    active:
                        false,

                    created_at:
                        now,

                    updated_at:
                        now,
                })
                .select("*")
                .single();

        if (error || !data) {
            throw new Error(
                `Failed to register custom agent: ${error?.message}`,
            );
        }

        return data as CustomAgentRecord;
    }

    async listOwned(
        ownerAddress: string,
    ): Promise<CustomAgentRecord[]> {
        const {
            data,
            error,
        } =
            await this.supabase.db
                .from("custom_agents")
                .select("*")
                .eq(
                    "owner_address",
                    ownerAddress.toLowerCase(),
                )
                .order(
                    "created_at",
                    {
                        ascending: false,
                    },
                );

        if (error) {
            throw new Error(
                `Failed to load custom agents: ${error.message}`,
            );
        }

        return (
            data ?? []
        ) as CustomAgentRecord[];
    }

    async getOwned(input: {
        id: string;
        ownerAddress: string;
    }): Promise<CustomAgentRecord> {
        const agent =
            await this.getById(
                input.id,
            );

        if (
            agent.owner_address
                .toLowerCase() !==
            input.ownerAddress
                .toLowerCase()
        ) {
            throw new ForbiddenException(
                "You do not own this custom agent.",
            );
        }

        return agent;
    }

    async update(input: {
        id: string;
        ownerAddress: string;
        dto: UpdateCustomAgentDto;
    }): Promise<CustomAgentRecord> {
        const existing =
            await this.getOwned({
                id:
                    input.id,

                ownerAddress:
                    input.ownerAddress,
            });

        const updates: Record<
            string,
            unknown
        > = {
            updated_at:
                new Date()
                    .toISOString(),
        };

        if (
            input.dto.manifest !==
            undefined
        ) {
            this.assertValidManifest(
                input.dto.manifest,
            );

            updates.manifest =
                input.dto.manifest;

            updates.verification_status =
                "pending";

            updates.active =
                false;
        }

        if (
            input.dto.endpointUrl !==
            undefined
        ) {
            updates.endpoint_url =
                this.normalizeEndpointUrl(
                    input.dto.endpointUrl,
                );

            updates.verification_status =
                "pending";

            updates.active =
                false;
        }

        if (
            input.dto
                .signingPublicKey !==
            undefined
        ) {
            updates.signing_public_key =
                input.dto
                    .signingPublicKey;

            updates.verification_status =
                "pending";

            updates.active =
                false;
        }

        if (
            input.dto.active !==
            undefined
        ) {
            if (
                input.dto.active &&
                existing
                    .verification_status !==
                "verified"
            ) {
                throw new BadRequestException(
                    "The custom agent must be verified before it can be activated.",
                );
            }

            updates.active =
                input.dto.active;
        }

        const {
            data,
            error,
        } =
            await this.supabase.db
                .from("custom_agents")
                .update(updates)
                .eq(
                    "id",
                    input.id,
                )
                .select("*")
                .single();

        if (error || !data) {
            throw new Error(
                `Failed to update custom agent: ${error?.message}`,
            );
        }

        return data as CustomAgentRecord;
    }

    async remove(input: {
        id: string;
        ownerAddress: string;
    }): Promise<{
        deleted: true;
    }> {
        await this.getOwned(input);

        const {
            error,
        } =
            await this.supabase.db
                .from("custom_agents")
                .delete()
                .eq(
                    "id",
                    input.id,
                );

        if (error) {
            throw new Error(
                `Failed to delete custom agent: ${error.message}`,
            );
        }

        return {
            deleted: true,
        };
    }

    async getById(
        id: string,
    ): Promise<CustomAgentRecord> {
        const {
            data,
            error,
        } =
            await this.supabase.db
                .from("custom_agents")
                .select("*")
                .eq(
                    "id",
                    id,
                )
                .single();

        if (error || !data) {
            throw new NotFoundException(
                "Custom agent was not found.",
            );
        }

        return data as CustomAgentRecord;
    }

    async verify(input: {
        id: string;
        ownerAddress: string;
    }): Promise<CustomAgentRecord> {
        const agent =
            await this.getOwned(input);

        const healthUrl =
            `${agent.endpoint_url}/v1/health`;

        const controller =
            new AbortController();

        const timeout =
            setTimeout(
                () =>
                    controller.abort(),
                10_000,
            );

        try {
            const response =
                await fetch(
                    healthUrl,
                    {
                        method:
                            "GET",

                        headers: {
                            Accept:
                                "application/json",
                        },

                        signal:
                            controller.signal,
                    },
                );

            if (!response.ok) {
                throw new Error(
                    `Health endpoint returned HTTP ${response.status}.`,
                );
            }

            const body =
                await response.json() as
                CustomAgentHealthResponse;

            if (
                body.protocolVersion !==
                CUSTOM_AGENT_PROTOCOL_VERSION
            ) {
                throw new Error(
                    `Unsupported protocol version: ${body.protocolVersion}.`,
                );
            }

            if (
                body.status !==
                "healthy"
            ) {
                throw new Error(
                    `Agent health status is ${body.status}.`,
                );
            }

            const manifest =
                agent.manifest;

            if (
                body.agent.id !==
                manifest.id
            ) {
                throw new Error(
                    `Health response agent id "${body.agent.id}" does not match manifest id "${manifest.id}".`,
                );
            }

            if (
                body.agent.version !==
                manifest.version
            ) {
                throw new Error(
                    `Health response agent version "${body.agent.version}" does not match manifest version "${manifest.version}".`,
                );
            }

            const now =
                new Date()
                    .toISOString();

            const {
                data,
                error,
            } =
                await this.supabase.db
                    .from(
                        "custom_agents",
                    )
                    .update({
                        verification_status:
                            "verified",

                        last_verified_at:
                            now,

                        last_error:
                            null,

                        updated_at:
                            now,
                    })
                    .eq(
                        "id",
                        agent.id,
                    )
                    .select("*")
                    .single();

            if (
                error ||
                !data
            ) {
                throw new Error(
                    `Failed to persist verification: ${error?.message}`,
                );
            }

            return data as CustomAgentRecord;
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Unknown verification error.";

            const now =
                new Date()
                    .toISOString();

            await this.supabase.db
                .from(
                    "custom_agents",
                )
                .update({
                    verification_status:
                        "failed",

                    active:
                        false,

                    last_verified_at:
                        now,

                    last_error:
                        message,

                    updated_at:
                        now,
                })
                .eq(
                    "id",
                    agent.id,
                );

            throw new BadRequestException({
                message:
                    "Custom agent verification failed.",

                error:
                    message,
            });
        } finally {
            clearTimeout(timeout);
        }
    }

    private assertValidManifest(
        manifest: AgentManifest,
    ): void {
        const result =
            validateAgentManifest(
                manifest,
            );

        if (!result.valid) {
            throw new BadRequestException({
                message:
                    "Invalid custom agent manifest.",

                errors:
                    result.errors,
            });
        }
    }

    private normalizeEndpointUrl(
        value: string,
    ): string {
        let url: URL;

        try {
            url =
                new URL(value);
        } catch {
            throw new BadRequestException(
                "endpointUrl must be a valid URL.",
            );
        }

        const allowLocalhost =
            process.env
                .NODE_ENV !==
            "production";

        const isLocalhost =
            url.hostname ===
            "localhost" ||
            url.hostname ===
            "127.0.0.1";

        if (
            url.protocol !==
            "https:" &&
            !(
                allowLocalhost &&
                isLocalhost &&
                url.protocol ===
                "http:"
            )
        ) {
            throw new BadRequestException(
                "endpointUrl must use HTTPS.",
            );
        }

        return url
            .toString()
            .replace(
                /\/$/,
                "",
            );
    }
}