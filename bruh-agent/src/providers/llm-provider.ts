import type {
    AgentAction,
    AgentEstimate,
    LlmEstimateInput,
    LlmProvider,
} from "../core/types";
import {
    clamp,
    ResearchProviderError,
    withTimeout,
} from "./research-provider";

export interface LlmCompletionInput {
    systemPrompt: string;
    userPrompt: string;
    temperature?: number;
    maxTokens?: number;
    responseFormat?: "json";
}

export interface LlmCompletionResult {
    text: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    costUsdc?: number;
    metadata?: Record<string, unknown>;
}

export interface LlmTransport {
    readonly id: string;

    complete(
        input: LlmCompletionInput,
    ): Promise<LlmCompletionResult>;
}

export interface DefaultLlmProviderOptions {
    transport: LlmTransport;
    timeoutMs?: number;
    temperature?: number;
    maxTokens?: number;
}

interface ParsedEstimate {
    probability: unknown;
    confidence: unknown;
    reasoning: unknown;
    keyFactors?: unknown;
    risks?: unknown;
    recommendedAction?: unknown;
    metadata?: unknown;
}

export class DefaultLlmProvider
    implements LlmProvider {
    private readonly transport: LlmTransport;

    private readonly timeoutMs: number;

    private readonly temperature: number;

    private readonly maxTokens: number;

    constructor(
        options: DefaultLlmProviderOptions,
    ) {
        this.transport = options.transport;

        this.timeoutMs =
            options.timeoutMs ?? 30_000;

        this.temperature =
            options.temperature ?? 0.2;

        this.maxTokens =
            options.maxTokens ?? 1_200;
    }

    async estimate(
        input: LlmEstimateInput,
    ): Promise<AgentEstimate> {
        validateLlmInput(input);

        const completion = await withTimeout(
            this.transport.complete({
                systemPrompt: input.systemPrompt,

                userPrompt:
                    buildEstimatePrompt(input),

                temperature:
                    this.temperature,

                maxTokens:
                    this.maxTokens,

                responseFormat: "json",
            }),

            this.timeoutMs,

            "custom",
        );

        const parsed =
            parseJsonResponse(completion.text);

        const estimate =
            validateAndNormalizeEstimate(parsed);

        return {
            ...estimate,

            metadata: {
                ...(estimate.metadata ?? {}),

                provider:
                    this.transport.id,

                model: completion.model,

                inputTokens:
                    completion.inputTokens,

                outputTokens:
                    completion.outputTokens,

                costUsdc:
                    completion.costUsdc,

                transportMetadata:
                    completion.metadata,
            },
        };
    }
}

function validateLlmInput(
    input: LlmEstimateInput,
): void {
    if (!input.profileId.trim()) {
        throw new ResearchProviderError({
            provider: "custom",
            code: "INVALID_PROFILE_ID",
            message:
                "LLM estimation requires a profile ID.",
        });
    }

    if (!input.market.question.trim()) {
        throw new ResearchProviderError({
            provider: "custom",
            code: "INVALID_MARKET_QUESTION",
            message:
                "LLM estimation requires a market question.",
        });
    }

    if (
        input.marketProbability <= 0 ||
        input.marketProbability >= 1
    ) {
        throw new ResearchProviderError({
            provider: "custom",
            code:
                "INVALID_MARKET_PROBABILITY",
            message:
                "Market probability must be between 0 and 1.",
        });
    }
}

function buildEstimatePrompt(
    input: LlmEstimateInput,
): string {
    return `
You are evaluating a binary prediction market.

PROFILE
${input.profileId}

MARKET QUESTION
${input.market.question}

MARKET DESCRIPTION
${input.market.description ?? "Not supplied"}

RESOLUTION CRITERIA
${input.market.resolutionCriteria ?? "Not supplied"}

CURRENT YES PROBABILITY
${input.marketProbability}

MARKET CATEGORIES
${input.market.categories.join(", ")}

RESEARCH SUMMARY
${input.research.summary}

RESEARCH EVIDENCE
${JSON.stringify(
        input.research.evidence,
        null,
        2,
    )}

ADDITIONAL INSTRUCTIONS
${input.instructions}

Return only a valid JSON object using this exact structure:

{
  "probability": 0.65,
  "confidence": 0.72,
  "reasoning": "Concise calibrated explanation.",
  "keyFactors": [
    "First factor",
    "Second factor"
  ],
  "risks": [
    "First risk",
    "Second risk"
  ],
  "recommendedAction": "BUY_YES"
}

Requirements:

- probability must be between 0.01 and 0.99
- confidence must be between 0 and 1
- recommendedAction must be BUY_YES, BUY_NO or PASS
- do not include markdown
- do not include code fences
- do not include text before or after the JSON
`.trim();
}

function parseJsonResponse(
    response: string,
): ParsedEstimate {
    const cleaned = response
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "");

    try {
        return JSON.parse(
            cleaned,
        ) as ParsedEstimate;
    } catch (error) {
        const possibleJson =
            extractFirstJsonObject(cleaned);

        if (possibleJson) {
            try {
                return JSON.parse(
                    possibleJson,
                ) as ParsedEstimate;
            } catch {
                // Continue to the structured error.
            }
        }

        throw new ResearchProviderError({
            provider: "custom",
            code: "INVALID_LLM_JSON",
            message:
                "The LLM returned an invalid JSON response.",
            cause: error,
        });
    }
}

function extractFirstJsonObject(
    value: string,
): string | null {
    const startIndex = value.indexOf("{");

    if (startIndex === -1) {
        return null;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (
        let index = startIndex;
        index < value.length;
        index += 1
    ) {
        const character = value[index];

        if (escaped) {
            escaped = false;
            continue;
        }

        if (character === "\\") {
            escaped = true;
            continue;
        }

        if (character === '"') {
            inString = !inString;
            continue;
        }

        if (inString) {
            continue;
        }

        if (character === "{") {
            depth += 1;
        }

        if (character === "}") {
            depth -= 1;

            if (depth === 0) {
                return value.slice(
                    startIndex,
                    index + 1,
                );
            }
        }
    }

    return null;
}

function validateAndNormalizeEstimate(
    parsed: ParsedEstimate,
): AgentEstimate {
    const probability =
        parseFiniteNumber(
            parsed.probability,
            "probability",
        );

    const confidence =
        parseFiniteNumber(
            parsed.confidence,
            "confidence",
        );

    if (
        typeof parsed.reasoning !== "string" ||
        !parsed.reasoning.trim()
    ) {
        throw new ResearchProviderError({
            provider: "custom",
            code:
                "INVALID_LLM_REASONING",
            message:
                "The LLM estimate must include reasoning.",
        });
    }

    return {
        probability: clamp(
            probability,
            0.01,
            0.99,
        ),

        confidence: clamp(
            confidence,
            0,
            1,
        ),

        reasoning:
            parsed.reasoning.trim(),

        keyFactors: parseStringArray(
            parsed.keyFactors,
        ),

        risks: parseStringArray(
            parsed.risks,
        ),

        recommendedAction:
            parseAgentAction(
                parsed.recommendedAction,
            ),

        metadata:
            isRecord(parsed.metadata)
                ? parsed.metadata
                : undefined,
    };
}

function parseFiniteNumber(
    value: unknown,
    field: string,
): number {
    const number =
        typeof value === "number"
            ? value
            : typeof value === "string"
                ? Number(value)
                : Number.NaN;

    if (!Number.isFinite(number)) {
        throw new ResearchProviderError({
            provider: "custom",
            code: "INVALID_LLM_NUMBER",
            message:
                `The LLM field "${field}" must be a valid number.`,
        });
    }

    return number;
}

function parseStringArray(
    value: unknown,
): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .filter(
            (item): item is string =>
                typeof item === "string",
        )
        .map((item) => item.trim())
        .filter(Boolean);
}

function parseAgentAction(
    value: unknown,
): AgentAction | undefined {
    if (typeof value !== "string") {
        return undefined;
    }

    const normalized =
        value.trim().toUpperCase();

    if (
        normalized === "BUY_YES" ||
        normalized === "BUY_NO" ||
        normalized === "PASS"
    ) {
        return normalized;
    }

    return undefined;
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