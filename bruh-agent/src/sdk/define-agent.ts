import type {
    AgentEstimate,
    AgentProfile,
    AgentProfileDefaults,
    AgentReasoningContext,
    AgentResearchContext,
    AgentResearchResult,
} from "../core/types";

import {
    assertValidAgentManifest,
    normalizeAgentManifest,
    type AgentManifest,
} from "./manifest";

export interface CustomAgentHooks {
    /**
     * Optional lifecycle hook before research starts.
     */
    beforeResearch?(
        context: AgentResearchContext,
    ): Promise<void> | void;

    /**
     * Gather evidence for the current market.
     */
    research(
        context: AgentResearchContext,
    ): Promise<AgentResearchResult>;

    /**
     * Optional lifecycle hook after research completes.
     */
    afterResearch?(
        context: AgentResearchContext,
        research: AgentResearchResult,
    ): Promise<void> | void;

    /**
     * Produce a probability estimate.
     */
    estimate(
        context: AgentReasoningContext,
    ): Promise<AgentEstimate>;

    /**
     * Optional lifecycle hook after estimation.
     */
    afterEstimate?(
        context: AgentReasoningContext,
        estimate: AgentEstimate,
    ): Promise<void> | void;
}

export interface DefineAgentInput
    extends CustomAgentHooks {
    manifest: AgentManifest;

    systemPrompt: string;

    defaults: AgentProfileDefaults;
}

export interface DefinedAgent
    extends AgentProfile {
    manifest: AgentManifest;

    /**
     * Identifies SDK-created agents.
     */
    sdkVersion: string;
}

export class DefineAgentError extends Error {
    readonly code: string;

    readonly cause?: unknown;

    constructor({
        code,
        message,
        cause,
    }: {
        code: string;
        message: string;
        cause?: unknown;
    }) {
        super(message);

        this.name = "DefineAgentError";
        this.code = code;
        this.cause = cause;
    }
}

export function defineAgent(
    input: DefineAgentInput,
): DefinedAgent {
    validateDefinition(input);

    const manifest =
        normalizeAgentManifest(
            assertValidAgentManifest(input.manifest),
        );

    const profile: DefinedAgent = {
        id: manifest.id,

        name: manifest.name,

        version: manifest.version,

        source: manifest.source,

        description: manifest.description,

        difficulty: manifest.difficulty,

        categories: manifest.categories,

        capabilities: manifest.capabilities,

        defaults: {
            ...input.defaults,
            ...manifest.riskDefaults,
        },

        systemPrompt: input.systemPrompt.trim(),

        manifest,

        sdkVersion: "1.0.0",

        async research(
            context: AgentResearchContext,
        ): Promise<AgentResearchResult> {
            try {
                await input.beforeResearch?.(context);

                const result =
                    await input.research(context);

                validateResearchResult(
                    result,
                    manifest.id,
                    context.market.id,
                );

                await input.afterResearch?.(
                    context,
                    result,
                );

                return {
                    ...result,

                    profileId: manifest.id,

                    marketId: context.market.id,

                    metadata: {
                        ...(result.metadata ?? {}),

                        customAgent: true,

                        agentVersion:
                            manifest.version,

                        agentSource:
                            manifest.source,

                        sdkVersion: "1.0.0",
                    },
                };
            } catch (error) {
                throw normalizeHookError({
                    hook: "research",
                    agentId: manifest.id,
                    error,
                });
            }
        },

        async estimate(
            context: AgentReasoningContext,
        ): Promise<AgentEstimate> {
            try {
                const result =
                    await input.estimate(context);

                validateEstimate(result);

                await input.afterEstimate?.(
                    context,
                    result,
                );

                return {
                    ...result,

                    metadata: {
                        ...(result.metadata ?? {}),

                        customAgent: true,

                        agentVersion:
                            manifest.version,

                        agentSource:
                            manifest.source,

                        sdkVersion: "1.0.0",
                    },
                };
            } catch (error) {
                throw normalizeHookError({
                    hook: "estimate",
                    agentId: manifest.id,
                    error,
                });
            }
        },
    };

    return Object.freeze(profile);
}

function validateDefinition(
    input: DefineAgentInput,
): void {
    if (!input || typeof input !== "object") {
        throw new DefineAgentError({
            code: "INVALID_AGENT_DEFINITION",
            message:
                "defineAgent requires an agent definition object.",
        });
    }

    if (!input.manifest) {
        throw new DefineAgentError({
            code: "MISSING_AGENT_MANIFEST",
            message:
                "Custom agents require a manifest.",
        });
    }

    if (!input.systemPrompt?.trim()) {
        throw new DefineAgentError({
            code: "MISSING_AGENT_SYSTEM_PROMPT",
            message:
                "Custom agents require a system prompt.",
        });
    }

    if (typeof input.research !== "function") {
        throw new DefineAgentError({
            code: "MISSING_AGENT_RESEARCH_HOOK",
            message:
                "Custom agents must implement research().",
        });
    }

    if (typeof input.estimate !== "function") {
        throw new DefineAgentError({
            code: "MISSING_AGENT_ESTIMATE_HOOK",
            message:
                "Custom agents must implement estimate().",
        });
    }

    validateDefaults(input.defaults);
}

function validateDefaults(
    defaults: AgentProfileDefaults,
): void {
    if (!defaults) {
        throw new DefineAgentError({
            code: "MISSING_AGENT_DEFAULTS",
            message:
                "Custom agents require runtime defaults.",
        });
    }

    validateProbability(
        defaults.edgeThreshold,
        "edgeThreshold",
    );

    validateProbability(
        defaults.kellyFraction,
        "kellyFraction",
    );

    validatePositiveNumber(
        defaults.maxPositionUsdc,
        "maxPositionUsdc",
    );

    validateNonNegativeNumber(
        defaults.researchBudgetUsdc,
        "researchBudgetUsdc",
    );

    validatePositiveInteger(
        defaults.maxResearchSources,
        "maxResearchSources",
    );

    if (
        defaults.minimumConfidence !==
        undefined
    ) {
        validateProbability(
            defaults.minimumConfidence,
            "minimumConfidence",
        );
    }

    if (
        defaults.maxDailyLossUsdc !==
        undefined
    ) {
        validateNonNegativeNumber(
            defaults.maxDailyLossUsdc,
            "maxDailyLossUsdc",
        );
    }

    if (
        defaults.maximumMarketExposureUsdc !==
        undefined
    ) {
        validateNonNegativeNumber(
            defaults.maximumMarketExposureUsdc,
            "maximumMarketExposureUsdc",
        );
    }
}

function validateResearchResult(
    result: AgentResearchResult,
    expectedProfileId: string,
    expectedMarketId: string,
): void {
    if (!result || typeof result !== "object") {
        throw new DefineAgentError({
            code: "INVALID_RESEARCH_RESULT",
            message:
                "research() must return an AgentResearchResult.",
        });
    }

    if (typeof result.summary !== "string") {
        throw new DefineAgentError({
            code: "INVALID_RESEARCH_SUMMARY",
            message:
                "Research result requires a summary.",
        });
    }

    if (!Array.isArray(result.evidence)) {
        throw new DefineAgentError({
            code: "INVALID_RESEARCH_EVIDENCE",
            message:
                "Research result evidence must be an array.",
        });
    }

    if (
        !Number.isFinite(result.costUsdc) ||
        result.costUsdc < 0
    ) {
        throw new DefineAgentError({
            code: "INVALID_RESEARCH_COST",
            message:
                "Research result costUsdc must be non-negative.",
        });
    }

    if (
        result.profileId &&
        result.profileId !== expectedProfileId
    ) {
        throw new DefineAgentError({
            code: "RESEARCH_PROFILE_MISMATCH",
            message:
                `Research result profileId must be "${expectedProfileId}".`,
        });
    }

    if (
        result.marketId &&
        result.marketId !== expectedMarketId
    ) {
        throw new DefineAgentError({
            code: "RESEARCH_MARKET_MISMATCH",
            message:
                `Research result marketId must be "${expectedMarketId}".`,
        });
    }
}

function validateEstimate(
    estimate: AgentEstimate,
): void {
    if (!estimate || typeof estimate !== "object") {
        throw new DefineAgentError({
            code: "INVALID_AGENT_ESTIMATE",
            message:
                "estimate() must return an AgentEstimate.",
        });
    }

    validateProbability(
        estimate.probability,
        "estimate.probability",
    );

    validateProbability(
        estimate.confidence,
        "estimate.confidence",
    );

    if (
        typeof estimate.reasoning !== "string" ||
        !estimate.reasoning.trim()
    ) {
        throw new DefineAgentError({
            code: "INVALID_ESTIMATE_REASONING",
            message:
                "Agent estimate requires reasoning.",
        });
    }

    if (!Array.isArray(estimate.keyFactors)) {
        throw new DefineAgentError({
            code: "INVALID_ESTIMATE_FACTORS",
            message:
                "Agent estimate keyFactors must be an array.",
        });
    }

    if (!Array.isArray(estimate.risks)) {
        throw new DefineAgentError({
            code: "INVALID_ESTIMATE_RISKS",
            message:
                "Agent estimate risks must be an array.",
        });
    }

    if (
        estimate.recommendedAction &&
        ![
            "BUY_YES",
            "BUY_NO",
            "PASS",
        ].includes(estimate.recommendedAction)
    ) {
        throw new DefineAgentError({
            code: "INVALID_ESTIMATE_ACTION",
            message:
                "recommendedAction must be BUY_YES, BUY_NO or PASS.",
        });
    }
}

function normalizeHookError({
    hook,
    agentId,
    error,
}: {
    hook: "research" | "estimate";
    agentId: string;
    error: unknown;
}): DefineAgentError {
    if (error instanceof DefineAgentError) {
        return error;
    }

    return new DefineAgentError({
        code:
            hook === "research"
                ? "CUSTOM_AGENT_RESEARCH_FAILED"
                : "CUSTOM_AGENT_ESTIMATE_FAILED",

        message:
            error instanceof Error
                ? `${agentId} ${hook} failed: ${error.message}`
                : `${agentId} ${hook} failed.`,

        cause: error,
    });
}

function validateProbability(
    value: number,
    field: string,
): void {
    if (
        !Number.isFinite(value) ||
        value < 0 ||
        value > 1
    ) {
        throw new DefineAgentError({
            code: "INVALID_PROBABILITY",
            message:
                `${field} must be between 0 and 1.`,
        });
    }
}

function validatePositiveNumber(
    value: number,
    field: string,
): void {
    if (
        !Number.isFinite(value) ||
        value <= 0
    ) {
        throw new DefineAgentError({
            code: "INVALID_POSITIVE_NUMBER",
            message:
                `${field} must be greater than zero.`,
        });
    }
}

function validateNonNegativeNumber(
    value: number,
    field: string,
): void {
    if (
        !Number.isFinite(value) ||
        value < 0
    ) {
        throw new DefineAgentError({
            code: "INVALID_NON_NEGATIVE_NUMBER",
            message:
                `${field} must be non-negative.`,
        });
    }
}

function validatePositiveInteger(
    value: number,
    field: string,
): void {
    if (
        !Number.isInteger(value) ||
        value <= 0
    ) {
        throw new DefineAgentError({
            code: "INVALID_POSITIVE_INTEGER",
            message:
                `${field} must be a positive integer.`,
        });
    }
}