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

import type {
    AgentInstallationRecord,
    AgentListingRecord,
    AgentVersionRecord,
    RunInstalledAgentDto,
} from "../agent-registry/agent-registry.types";

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

        if (
            !input.dto.market ||
            !input.dto.market.id ||
            !input.dto.market.question
        ) {
            throw new BadRequestException(
                "A valid market is required.",
            );
        }

        if (!input.dto.market.address) {
            throw new BadRequestException(
                "market.address is required for persisted custom-agent runs.",
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
            agent.manifest.permissions
                .maximumTradeUsdc ?? 0;

        const config =
            this.buildConfig(
                input.dto.config,
                manifestMaximumTradeUsdc,
            );

        const request:
            CustomAgentRunRequest = {
            protocolVersion:
                CUSTOM_AGENT_PROTOCOL_VERSION,

            requestId,

            issuedAt:
                issuedAt
                    .toISOString(),

            expiresAt:
                expiresAt
                    .toISOString(),

            agent: {
                id:
                    agent.manifest.id,

                version:
                    agent.manifest
                        .version,
            },

            market:
                input.dto.market,

            permissions: {
                canResearch:
                    agent.manifest
                        .permissions
                        .canResearch,

                canPurchaseResearch:
                    agent.manifest
                        .permissions
                        .canPurchaseResearch,

                canTrade:
                    false,

                canAccessHistoricalData:
                    agent.manifest
                        .permissions
                        .canAccessHistoricalData,

                canAccessOnchainData:
                    agent.manifest
                        .permissions
                        .canAccessOnchainData,

                canUseExternalApis:
                    agent.manifest
                        .permissions
                        .canUseExternalApis,

                maximumTradeUsdc:
                    0,
            },

            config: {
                ...config,

                // Custom-agent execution remains
                // simulation-only in this phase.
                dryRun:
                    true,
            },

            context:
                input.dto.context,

            metadata: {
                customAgentRegistryId:
                    agent.id,

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
                    agent.endpoint_url,

                request,
            });


        const research =
            this.normalizeResearch({
                profileId:
                    agent.manifest.id,

                marketId:
                    input.dto.market.id,

                response,
            });

        const estimate =
            this.normalizeEstimate(
                response,
            );

        const normalizedMarket: AgentMarket = {
            id: input.dto.market.id,
            question: input.dto.market.question,
            categories: [],

            yesPrice: input.dto.market.yesPrice,
            noPrice: input.dto.market.noPrice,

            description:
                input.dto.market.description,

            resolutionCriteria:
                input.dto.market.resolutionCriteria,

            closesAt:
                input.dto.market.closesAt,
        };

        const profile =
            this.buildCustomProfile({
                agentId:
                    agent.manifest.id,

                version:
                    agent.manifest.version,

                name:
                    agent.manifest.name,

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
                        input.dto.wallet
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
                    input.dto.wallet
                        ?.agentId ??
                    agent.manifest.id,

                profile,

                market:
                    normalizedMarket,

                research,

                decision,

                walletAddress:
                    input.dto.wallet
                        ?.address,

                network:
                    input.dto.market
                        .network,

                expiresInSeconds:
                    300,

                metadata: {
                    customAgentId:
                        agent.id,

                    requestId,

                    source:
                        "remote-custom-agent",

                    requestedBy:
                        input.ownerAddress,

                    marketAddress:
                        input.dto.market
                            .address,
                },
            });
        const durationMs =
            Date.now() -
            startedAt;
        await this.persistRun({
            runId,

            customAgentId:
                agent.id,

            ownerAddress:
                input.ownerAddress,

            profileId:
                agent.manifest.id,

            profileVersion:
                agent.manifest.version,

            market:
                input.dto.market,

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
                agent.id,

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
            !input.dto.market ||
            !input.dto.market.id ||
            !input.dto.market.question
        ) {
            throw new BadRequestException(
                "A valid market is required.",
            );
        }

        if (!input.dto.market.address) {
            throw new BadRequestException(
                "market.address is required for installed-agent runs.",
            );
        }

        const customAgent =
            await this.customAgents.getById(
                input.listing.custom_agent_id,
            );

        if (
            customAgent.verification_status !==
            "verified"
        ) {
            throw new BadRequestException(
                "The custom agent backing this installation is not verified.",
            );
        }

        if (!customAgent.active) {
            throw new BadRequestException(
                "The custom agent backing this installation is inactive.",
            );
        }

        return this.run({
            customAgentId:
                customAgent.id,

            ownerAddress:
                customAgent.owner_address,

            dto: {
                market:
                    input.dto.market,

                config: {
                    ...input.installation
                        .configuration,

                    ...input.dto.config,
                },

                context:
                    input.dto.context,

                wallet:
                    input.dto.wallet,
            },
        });
    }

    private async persistRun(input: {
        runId: string;

        customAgentId: string;

        ownerAddress: string;

        profileId: string;

        profileVersion: string;

        market:
        RunCustomAgentDto["market"];

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
        config: RunCustomAgentDto["config"],
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