import Anthropic from "@anthropic-ai/sdk";

import type {
    LlmCompletionInput,
    LlmCompletionResult,
    LlmTransport,
} from "../../llm-provider";

export interface AnthropicTransportOptions {
    apiKey: string;

    model: string;

    baseUrl?: string;

    /**
     * Request timeout passed to the Anthropic SDK.
     */
    timeoutMs?: number;

    /**
     * Number of automatic SDK retries.
     */
    maxRetries?: number;

    /**
     * Optional headers added to every request.
     */
    defaultHeaders?: Record<string, string>;
}

export class AnthropicTransport implements LlmTransport {
    readonly id = "anthropic";

    private readonly client: Anthropic;

    private readonly model: string;

    constructor(options: AnthropicTransportOptions) {
        validateOptions(options);

        this.model = options.model;

        this.client = new Anthropic({
            apiKey: options.apiKey,

            baseURL: options.baseUrl,

            timeout: options.timeoutMs ?? 30_000,

            maxRetries: options.maxRetries ?? 2,

            defaultHeaders: options.defaultHeaders,
        });
    }

    async complete(
        input: LlmCompletionInput,
    ): Promise<LlmCompletionResult> {
        validateCompletionInput(input);

        const startedAt = Date.now();

        try {
            const response = await this.client.messages.create({
                model: this.model,

                max_tokens: input.maxTokens ?? 1_200,

                temperature: input.temperature ?? 0.2,

                system: input.systemPrompt,

                messages: [
                    {
                        role: "user",
                        content: input.userPrompt,
                    },
                ],
            });

            const text = extractText(response.content);

            if (!text.trim()) {
                throw new AnthropicTransportError({
                    code: "EMPTY_ANTHROPIC_RESPONSE",
                    message:
                        "Anthropic returned a response without any text content.",
                });
            }

            return {
                text,

                model: response.model,

                inputTokens: response.usage.input_tokens,

                outputTokens: response.usage.output_tokens,

                metadata: {
                    messageId: response.id,

                    stopReason: response.stop_reason,

                    stopSequence: response.stop_sequence,

                    durationMs: Date.now() - startedAt,
                },
            };
        } catch (error) {
            if (error instanceof AnthropicTransportError) {
                throw error;
            }

            throw normalizeAnthropicError(error);
        }
    }
}

export class AnthropicTransportError extends Error {
    readonly code: string;

    readonly status?: number;

    readonly requestId?: string;

    readonly retryable: boolean;

    readonly cause?: unknown;

    constructor({
        code,
        message,
        status,
        requestId,
        retryable = false,
        cause,
    }: {
        code: string;
        message: string;
        status?: number;
        requestId?: string;
        retryable?: boolean;
        cause?: unknown;
    }) {
        super(message);

        this.name = "AnthropicTransportError";

        this.code = code;

        this.status = status;

        this.requestId = requestId;

        this.retryable = retryable;

        this.cause = cause;
    }
}

function validateOptions(
    options: AnthropicTransportOptions,
): void {
    if (!options.apiKey.trim()) {
        throw new AnthropicTransportError({
            code: "MISSING_ANTHROPIC_API_KEY",
            message:
                "AnthropicTransport requires a non-empty API key.",
        });
    }

    if (!options.model.trim()) {
        throw new AnthropicTransportError({
            code: "MISSING_ANTHROPIC_MODEL",
            message:
                "AnthropicTransport requires a model name.",
        });
    }

    if (
        options.timeoutMs !== undefined &&
        (!Number.isFinite(options.timeoutMs) ||
            options.timeoutMs <= 0)
    ) {
        throw new AnthropicTransportError({
            code: "INVALID_ANTHROPIC_TIMEOUT",
            message:
                "Anthropic timeoutMs must be greater than zero.",
        });
    }

    if (
        options.maxRetries !== undefined &&
        (!Number.isInteger(options.maxRetries) ||
            options.maxRetries < 0)
    ) {
        throw new AnthropicTransportError({
            code: "INVALID_ANTHROPIC_RETRIES",
            message:
                "Anthropic maxRetries must be a non-negative integer.",
        });
    }
}

function validateCompletionInput(
    input: LlmCompletionInput,
): void {
    if (!input.systemPrompt.trim()) {
        throw new AnthropicTransportError({
            code: "MISSING_SYSTEM_PROMPT",
            message:
                "Anthropic completion requires a system prompt.",
        });
    }

    if (!input.userPrompt.trim()) {
        throw new AnthropicTransportError({
            code: "MISSING_USER_PROMPT",
            message:
                "Anthropic completion requires a user prompt.",
        });
    }

    if (
        input.maxTokens !== undefined &&
        (!Number.isInteger(input.maxTokens) ||
            input.maxTokens <= 0)
    ) {
        throw new AnthropicTransportError({
            code: "INVALID_MAX_TOKENS",
            message:
                "Anthropic maxTokens must be a positive integer.",
        });
    }

    if (
        input.temperature !== undefined &&
        (!Number.isFinite(input.temperature) ||
            input.temperature < 0 ||
            input.temperature > 1)
    ) {
        throw new AnthropicTransportError({
            code: "INVALID_TEMPERATURE",
            message:
                "Anthropic temperature must be between 0 and 1.",
        });
    }
}

function extractText(
    content: Anthropic.Messages.ContentBlock[],
): string {
    return content
        .filter(
            (
                block,
            ): block is Anthropic.Messages.TextBlock =>
                block.type === "text",
        )
        .map((block) => block.text)
        .join("\n")
        .trim();
}

function normalizeAnthropicError(
    error: unknown,
): AnthropicTransportError {
    if (error instanceof Anthropic.APIError) {
        return new AnthropicTransportError({
            code: resolveErrorCode(error.status),

            message:
                error.message ||
                "Anthropic API request failed.",

            status: error.status,

            requestId: error.request_id ?? undefined,

            retryable: isRetryableStatus(
                error.status,
            ),

            cause: error,
        });
    }

    if (error instanceof Error) {
        return new AnthropicTransportError({
            code: "ANTHROPIC_REQUEST_FAILED",

            message: error.message,

            retryable: false,

            cause: error,
        });
    }

    return new AnthropicTransportError({
        code: "UNKNOWN_ANTHROPIC_ERROR",

        message:
            "An unknown Anthropic request error occurred.",

        retryable: false,

        cause: error,
    });
}

function resolveErrorCode(
    status: number | undefined,
): string {
    switch (status) {
        case 400:
            return "ANTHROPIC_BAD_REQUEST";

        case 401:
            return "ANTHROPIC_UNAUTHORIZED";

        case 403:
            return "ANTHROPIC_FORBIDDEN";

        case 404:
            return "ANTHROPIC_NOT_FOUND";

        case 408:
            return "ANTHROPIC_TIMEOUT";

        case 413:
            return "ANTHROPIC_REQUEST_TOO_LARGE";

        case 429:
            return "ANTHROPIC_RATE_LIMITED";

        case 500:
            return "ANTHROPIC_INTERNAL_ERROR";

        case 529:
            return "ANTHROPIC_OVERLOADED";

        default:
            return "ANTHROPIC_API_ERROR";
    }
}

function isRetryableStatus(
    status: number | undefined,
): boolean {
    return (
        status === 408 ||
        status === 409 ||
        status === 429 ||
        status === 500 ||
        status === 502 ||
        status === 503 ||
        status === 504 ||
        status === 529
    );
}