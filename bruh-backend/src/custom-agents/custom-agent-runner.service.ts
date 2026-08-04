import {
    BadGatewayException,
    BadRequestException,
    Injectable,
    InternalServerErrorException,
} from "@nestjs/common";

import {
    CUSTOM_AGENT_PROTOCOL_VERSION,
    CustomAgentProtocolError,
    validateCustomAgentResponse,
    type CustomAgentRunConfig,
    type CustomAgentRunRequest,
    type CustomAgentRunResponse,
} from "@bruhmarket/agent-sdk";

import {
    randomUUID,
} from "node:crypto";

import {
    CustomAgentService,
} from "./custom-agent.service";

import type {
    CustomAgentRunnerResult,
    RunCustomAgentDto,
} from "./custom-agent-run.types";

import {
    SupabaseService,
} from "../supabase.service";

import {
    buildAgentDecision,
    buildExecutionPlan,
    type AgentDecision,
    type AgentEstimate,
    type AgentMarket,
    type AgentProfile,
    type AgentResearchResult,
    type ExecutionPlan,
} from "@bruhmarket/agent-sdk/runtime";

import {
    type AgentManifest,
    type AgentManifestPermissions,
    type CustomAgentProtocolVersion,
    type CustomAgentRunMarket,
} from "@bruhmarket/agent-sdk";

import type {
    AgentInstallationRecord,
    AgentListingRecord,
    AgentVersionRecord,
    RunInstalledAgentDto,
} from "../agent-registry/agent-registry.types";

interface ResolvedRemoteAgentInput {
    customAgentId: string;

    installationId?: string;

    ownerAddress: string;

    manifest: AgentManifest;

    endpointUrl: string;

    protocolVersion:
    CustomAgentProtocolVersion;

    permissions:
    AgentManifestPermissions;

    market:
    CustomAgentRunMarket;

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

@Injectable()
export class CustomAgentRunnerService {
    constructor(
        private readonly customAgents:
            CustomAgentService,

        private readonly supabase:
            SupabaseService,
    ) { }

    async run(input: {
        customAgentId: string;

        ownerAddress: string;

        dto: RunCustomAgentDto;
    }): Promise<CustomAgentRunnerResult> {
        const agent =
            await this.customAgents
                .getOwned({
                    id:
                        input.customAgentId,

                    ownerAddress:
                        input.ownerAddress,
                });

        if (
            agent.verification_status !==
            "verified"
        ) {
            throw new BadRequestException(
                "The custom agent must be verified before it can run.",
            );
        }

        if (!agent.active) {
            throw new BadRequestException(
                "The custom agent is not active.",
            );
        }

        return this.executeResolvedAgent({
            customAgentId:
                agent.id,

            ownerAddress:
                input.ownerAddress,

            manifest:
                agent.manifest,

            endpointUrl:
                agent.endpoint_url,

            protocolVersion:
                agent.protocol_version,

            permissions:
                agent.manifest.permissions,

            market:
                input.dto.market,

            config:
                input.dto.config,

            context:
                input.dto.context,

            wallet:
                input.dto.wallet,
        });
    }

    async runInstallation(input: {
        installation:
        AgentInstallationRecord;

        listing:
        AgentListingRecord;

        version:
        AgentVersionRecord;

        ownerAddress: string;

        dto:
        RunInstalledAgentDto;
    }): Promise<CustomAgentRunnerResult> {
        if (!input.installation.enabled) {
            throw new BadRequestException(
                "This agent installation is disabled.",
            );
        }

        if (
            input.version.status !==
            "published"
        ) {
            throw new BadRequestException(
                "The installed agent version is not published.",
            );
        }

        const mergedConfiguration = {
            ...(input.installation.configuration ?? {}),
            ...(input.dto.config ?? {}),
        } as Partial<CustomAgentRunConfig>;

        const manifestPermissions =
            input.version.manifest.permissions;

        const installationPermissions =
            input.installation.permissions ?? {};

        const mergedPermissions:
            AgentManifestPermissions = {
            canResearch:
                Boolean(
                    manifestPermissions.canResearch,
                ) &&
                installationPermissions.canResearch !==
                false,

            canPurchaseResearch:
                Boolean(
                    manifestPermissions
                        .canPurchaseResearch,
                ) &&
                installationPermissions
                    .canPurchaseResearch !==
                false,

            canAccessHistoricalData:
                Boolean(
                    manifestPermissions
                        .canAccessHistoricalData,
                ) &&
                installationPermissions
                    .canAccessHistoricalData !==
                false,

            canAccessOnchainData:
                Boolean(
                    manifestPermissions
                        .canAccessOnchainData,
                ) &&
                installationPermissions
                    .canAccessOnchainData !==
                false,

            canUseExternalApis:
                Boolean(
                    manifestPermissions
                        .canUseExternalApis,
                ) &&
                installationPermissions
                    .canUseExternalApis !==
                false,

            canTrade:
                false,

            maximumTradeUsdc:
                0,
        };
        return this.executeResolvedAgent({
            customAgentId:
                input.listing
                    .custom_agent_id,

            installationId:
                input.installation.id,

            ownerAddress:
                input.ownerAddress,

            // These values come from the
            // immutable published version.
            manifest:
                input.version.manifest,

            endpointUrl:
                input.version.endpoint_url,

            protocolVersion:
                input.version
                    .protocol_version,

            permissions:
                mergedPermissions,

            market:
                input.dto.market,

            config:
                mergedConfiguration,

            context:
                input.dto.context,

            wallet:
                input.dto.wallet,
        });
    }


    private async executeResolvedAgent(
        input: ResolvedRemoteAgentInput,
    ): Promise<CustomAgentRunnerResult> {
        if (
            !input.market ||
            !input.market.id ||
            !input.market.question
        ) {
            throw new BadRequestException(
                "A valid market is required.",
            );
        }

        if (!input.market.address) {
            throw new BadRequestException(
                "market.address is required for persisted custom-agent runs.",
            );
        }

        if (
            input.protocolVersion !==
            CUSTOM_AGENT_PROTOCOL_VERSION
        ) {
            throw new BadRequestException(
                `Unsupported custom-agent protocol version: ${input.protocolVersion}.`,
            );
        }

        const requestId =
            randomUUID();

        const runId =
            randomUUID();

        const issuedAt =
            new Date();

        const expiresAt =
            new Date(
                issuedAt.getTime() +
                30_000,
            );

        const manifestMaximumTradeUsdc =
            input.manifest.permissions
                .maximumTradeUsdc ??
            0;

        const config =
            this.buildConfig(
                input.config,
                manifestMaximumTradeUsdc,
            );

        const requestPermissions:
            CustomAgentRunRequest["permissions"] = {
            canResearch:
                input.permissions
                    .canResearch ===
                true,

            canPurchaseResearch:
                input.permissions
                    .canPurchaseResearch ===
                true,

            // Remote agents never authorize
            // wallet execution.
            canTrade:
                false,

            canAccessHistoricalData:
                input.permissions
                    .canAccessHistoricalData ===
                true,

            canAccessOnchainData:
                input.permissions
                    .canAccessOnchainData ===
                true,

            canUseExternalApis:
                input.permissions
                    .canUseExternalApis ===
                true,

            maximumTradeUsdc:
                0,
        };

        const request:
            CustomAgentRunRequest = {
            protocolVersion:
                CUSTOM_AGENT_PROTOCOL_VERSION,

            requestId,

            issuedAt:
                issuedAt.toISOString(),

            expiresAt:
                expiresAt.toISOString(),

            agent: {
                id:
                    input.manifest.id,

                version:
                    input.manifest.version,
            },

            market:
                input.market,

            permissions:
                requestPermissions,

            config: {
                ...config,

                dryRun:
                    true,
            },

            context:
                input.context,

            metadata: {
                customAgentRegistryId:
                    input.customAgentId,

                agentInstallationId:
                    input.installationId,

                runId,

                requestedBy:
                    input.ownerAddress,

                executionMode:
                    "remote-dry-run",
            },
        };

        const startedAt =
            Date.now();

        const response =
            await this.callRemoteAgent({
                endpointUrl:
                    input.endpointUrl,

                request,
            });

        const research =
            this.normalizeResearch({
                profileId:
                    input.manifest.id,

                marketId:
                    input.market.id,

                response,
            });

        const estimate =
            this.normalizeEstimate(
                response,
            );

        const normalizedMarket:
            AgentMarket = {
            id:
                input.market.id,

            question:
                input.market.question,

            categories:
                [],

            yesPrice:
                input.market.yesPrice,

            noPrice:
                input.market.noPrice,

            description:
                input.market.description,

            resolutionCriteria:
                input.market
                    .resolutionCriteria,

            closesAt:
                input.market.closesAt,
        };

        const profile =
            this.buildCustomProfile({
                agentId:
                    input.manifest.id,

                version:
                    input.manifest.version,

                name:
                    input.manifest.name,

                config,
            });

        const decision =
            buildAgentDecision({
                market:
                    normalizedMarket,

                estimate,

                research,

                config: {
                    edgeThreshold:
                        config.edgeThreshold,

                    kellyFraction:
                        config.kellyFraction,

                    maxPositionUsdc:
                        config.maxPositionUsdc,

                    researchBudgetUsdc:
                        config.researchBudgetUsdc,

                    maxResearchSources:
                        config.maxResearchSources,

                    minimumConfidence:
                        config.minimumConfidence,

                    availableBalanceUsdc:
                        input.wallet
                            ?.availableBalanceUsdc ??
                        0,

                    allowTrading:
                        false,

                    dryRun:
                        true,
                },
            });

        const executionPlan =
            buildExecutionPlan({
                runId,

                agentId:
                    input.wallet?.agentId ??
                    input.manifest.id,

                profile,

                market:
                    normalizedMarket,

                research,

                decision,

                walletAddress:
                    input.wallet?.address,

                network:
                    input.market.network,

                expiresInSeconds:
                    300,

                metadata: {
                    customAgentId:
                        input.customAgentId,

                    installationId:
                        input.installationId,

                    requestId,

                    source:
                        "remote-custom-agent",

                    requestedBy:
                        input.ownerAddress,

                    marketAddress:
                        input.market.address,
                },
            });

        const durationMs =
            Date.now() -
            startedAt;

        await this.persistRun({
            runId,

            customAgentId:
                input.customAgentId,

            installationId:
                input.installationId,

            ownerAddress:
                input.ownerAddress,

            profileId:
                input.manifest.id,

            profileVersion:
                input.manifest.version,

            market:
                input.market,

            requestId,

            response,

            research,

            estimate,

            decision,

            executionPlan,

            durationMs,
        });

        return {
            runId,

            customAgentId:
                input.customAgentId,

            installationId:
                input.installationId,

            requestId,

            dryRun:
                true,

            status:
                "passed",

            response,

            decision,

            executionPlan,

            durationMs,

            persisted:
                true,
        };
    }

    private async persistRun(input: {
        runId: string;

        customAgentId: string;

        installationId?: string;

        ownerAddress: string;

        profileId: string;

        profileVersion: string;

        market:
        CustomAgentRunMarket;

        requestId: string;

        response:
        CustomAgentRunResponse;

        research:
        AgentResearchResult;

        estimate:
        AgentEstimate;

        decision:
        AgentDecision;

        executionPlan:
        ExecutionPlan;

        durationMs: number;
    }): Promise<void> {

        const {
            error,
        } =
            await this.supabase.db
                .from("agent_runs")
                .insert({
                    id:
                        input.runId,

                    agent_wallet_id:
                        null,

                    agent_id:
                        input.response
                            .agent.id,

                    custom_agent_id:
                        input.customAgentId,

                    agent_installation_id:
                        input.installationId ??
                        null,

                    run_source:
                        "custom",

                    profile_id:
                        input.profileId,

                    profile_version:
                        input.profileVersion,

                    market_id:
                        input.market.id,

                    market_address:
                        input.market.address!
                            .toLowerCase(),

                    market_question:
                        input.market.question,

                    status:
                        input.executionPlan
                            .status ===
                            "skipped"
                            ? "passed"
                            : "planned",

                    research:
                        input.research,

                    estimate:
                        input.estimate,

                    decision:
                        input.decision,

                    execution_plan:
                        input.executionPlan,

                    execution_receipt_id:
                        null,

                    error_message:
                        null,

                    metadata: {
                        source:
                            "remote-custom-agent",

                        ownerAddress:
                            input.ownerAddress
                                .toLowerCase(),

                        protocolVersion:
                            input.response
                                .protocolVersion,

                        requestId:
                            input.requestId,

                        durationMs:
                            input.durationMs,

                        remoteMetadata:
                            input.response
                                .metadata,

                        installationId:
                            input.installationId,
                    },

                    started_at:
                        new Date(
                            Date.now() -
                            input.durationMs,
                        ).toISOString(),

                    completed_at:
                        input.response
                            .completedAt,

                    updated_at:
                        new Date()
                            .toISOString(),
                });
        if (error) {
            console.error(
                "SUPABASE INSERT ERROR",
                JSON.stringify(
                    error,
                    null,
                    2,
                ),
            );

            throw new InternalServerErrorException({
                message:
                    "Failed to persist custom-agent run.",

                error:
                    error.message,

                code:
                    error.code,

                details:
                    error.details,
            });
        }
    }

    private async callRemoteAgent(input: {
        endpointUrl: string;

        request:
        CustomAgentRunRequest;
    }): Promise<CustomAgentRunResponse> {
        const controller =
            new AbortController();

        const timeout =
            setTimeout(
                () =>
                    controller.abort(),
                30_000,
            );

        try {
            const response =
                await fetch(
                    `${input.endpointUrl}/v1/run`,
                    {
                        method:
                            "POST",

                        headers: {
                            Accept:
                                "application/json",

                            "Content-Type":
                                "application/json",
                        },

                        body:
                            JSON.stringify(
                                input.request,
                            ),

                        signal:
                            controller
                                .signal,
                    },
                );

            const rawBody =
                await this.readJson(
                    response,
                );

            if (!response.ok) {
                throw new BadGatewayException({
                    message:
                        "The custom agent endpoint returned an unsuccessful response.",

                    statusCode:
                        response.status,

                    response:
                        rawBody,
                });
            }

            const validated =
                validateCustomAgentResponse(
                    rawBody,
                    input.request
                        .requestId,
                );

            if (
                validated.status ===
                "failed"
            ) {
                throw new BadGatewayException({
                    message:
                        validated.error
                            .message,

                    code:
                        validated.error
                            .code,

                    retryable:
                        validated.error
                            .retryable,
                });
            }

            if (
                validated.agent.id !==
                input.request.agent.id
            ) {
                throw new CustomAgentProtocolError({
                    code:
                        "AGENT_ID_MISMATCH",

                    message:
                        "The response agent ID does not match the requested agent.",
                });
            }

            if (
                validated.agent.version !==
                input.request.agent
                    .version
            ) {
                throw new CustomAgentProtocolError({
                    code:
                        "AGENT_VERSION_MISMATCH",

                    message:
                        "The response agent version does not match the registered manifest.",
                });
            }

            return validated;
        } catch (error) {
            if (
                error instanceof
                BadGatewayException
            ) {
                throw error;
            }

            if (
                error instanceof
                CustomAgentProtocolError
            ) {
                throw new BadGatewayException({
                    message:
                        "The custom agent returned an invalid protocol response.",

                    code:
                        error.code,

                    error:
                        error.message,
                });
            }

            if (
                error instanceof Error &&
                error.name ===
                "AbortError"
            ) {
                throw new BadGatewayException(
                    "The custom agent timed out after 30 seconds.",
                );
            }

            throw new BadGatewayException({
                message:
                    "Failed to call the custom agent.",

                error:
                    error instanceof Error
                        ? error.message
                        : "Unknown custom-agent error.",
            });
        } finally {
            clearTimeout(timeout);
        }
    }



    private async readJson(
        response: Response,
    ): Promise<unknown> {
        const text =
            await response.text();

        if (!text) {
            return null;
        }

        try {
            return JSON.parse(
                text,
            ) as unknown;
        } catch {
            throw new BadGatewayException(
                "The custom agent returned invalid JSON.",
            );
        }
    }

    private normalizeResearch(input: {
        profileId: string;

        marketId: string;

        response:
        CustomAgentRunResponse;
    }): AgentResearchResult {
        const remote =
            input.response.research;

        return {
            profileId:
                input.profileId,

            marketId:
                input.marketId,

            collectedAt:
                input.response
                    .completedAt,

            summary:
                remote?.summary ??
                "The custom agent returned no research summary.",

            evidence:
                (
                    remote?.evidence ??
                    []
                ).map(
                    (evidence) => ({
                        type:
                            evidence.type ===
                                "market"
                                ? "custom"
                                : evidence.type,

                        title:
                            evidence.title,

                        summary:
                            evidence.summary ??
                            evidence.title,

                        source:
                            evidence.source,

                        url:
                            evidence.url,

                        publishedAt:
                            evidence.publishedAt,

                        credibilityScore:
                            evidence
                                .credibilityScore,

                        metadata: {
                            ...evidence.metadata,

                            originalType:
                                evidence.type,
                        },
                    }),
                ),

            costUsdc:
                remote?.costUsdc ??
                0,

            metadata: {
                source:
                    "remote-custom-agent",

                remoteMetadata:
                    remote?.metadata,
            },
        };
    }

    private normalizeEstimate(
        response:
            CustomAgentRunResponse,
    ): AgentEstimate {
        return {
            probability:
                response.estimate
                    .probability,

            confidence:
                response.estimate
                    .confidence,

            reasoning:
                response.estimate
                    .reasoning,

            keyFactors:
                response.estimate
                    .keyFactors,

            risks:
                response.estimate
                    .risks,

            recommendedAction:
                response.estimate
                    .recommendedAction,
        };
    }

    private buildCustomProfile(input: {
        agentId: string;
        version: string;
        name: string;
        config: CustomAgentRunConfig;
    }): AgentProfile {
        return {
            id:
                input.agentId,

            name:
                input.name,

            version:
                input.version,

            source:
                "custom",

            difficulty:
                "developer",

            description:
                "Remote custom agent registered with Bruh.",

            categories: [
                "custom",
            ],

            capabilities: [
                "research",
                "prediction",
            ],

            systemPrompt:
                "Remote custom agent.",

            defaults: {
                edgeThreshold:
                    input.config
                        .edgeThreshold,

                kellyFraction:
                    input.config
                        .kellyFraction,

                maxPositionUsdc:
                    input.config
                        .maxPositionUsdc,

                researchBudgetUsdc:
                    input.config
                        .researchBudgetUsdc,

                maxResearchSources:
                    input.config
                        .maxResearchSources,

                minimumConfidence:
                    input.config
                        .minimumConfidence,
            },

            async research() {
                throw new Error(
                    "Research for this profile is provided by the remote custom-agent endpoint.",
                );
            },

            async estimate() {
                throw new Error(
                    "Estimates for this profile are provided by the remote custom-agent endpoint.",
                );
            },
        };
    }


    private buildConfig(
        config:
            Partial<CustomAgentRunConfig>
            | undefined,

        manifestMaximumTradeUsdc = 0,
    ): CustomAgentRunConfig {
        const safeMaximumTradeUsdc =
            Math.max(
                manifestMaximumTradeUsdc,
                0,
            );

        return {
            edgeThreshold:
                config?.edgeThreshold ??
                0.05,

            kellyFraction:
                config?.kellyFraction ??
                0.1,

            maxPositionUsdc:
                Math.min(
                    config?.maxPositionUsdc ??
                    safeMaximumTradeUsdc,
                    safeMaximumTradeUsdc,
                ),

            researchBudgetUsdc:
                config?.researchBudgetUsdc ??
                0,

            maxResearchSources:
                config?.maxResearchSources ??
                10,

            minimumConfidence:
                config?.minimumConfidence ??
                0.5,

            dryRun: true,
        };
    }
}