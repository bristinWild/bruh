import {
    CUSTOM_AGENT_PROTOCOL_VERSION,
    CustomAgentProtocolError,
    type CustomAgentAction,
    type CustomAgentErrorResponse,
    type CustomAgentRunResponse,
    type CustomAgentResponse,
} from "./custom-agent-protocol";

const ACTIONS =
    new Set<CustomAgentAction>([
        "BUY_YES",
        "BUY_NO",
        "PASS",
    ]);

export function validateCustomAgentResponse(
    value: unknown,
    expectedRequestId?: string,
): CustomAgentResponse {
    const record =
        requireRecord(
            value,
            "response",
        );

    if (
        record.protocolVersion !==
        CUSTOM_AGENT_PROTOCOL_VERSION
    ) {
        throw new CustomAgentProtocolError({
            code:
                "UNSUPPORTED_PROTOCOL_VERSION",

            message:
                `Expected protocol version ${CUSTOM_AGENT_PROTOCOL_VERSION}.`,
        });
    }

    const requestId =
        requireString(
            record.requestId,
            "requestId",
        );

    if (
        expectedRequestId &&
        requestId !==
        expectedRequestId
    ) {
        throw new CustomAgentProtocolError({
            code:
                "REQUEST_ID_MISMATCH",

            message:
                "Custom agent response requestId does not match the original request.",
        });
    }

    if (
        record.status ===
        "failed"
    ) {
        return validateErrorResponse(
            record,
        );
    }

    if (
        record.status !==
        "completed"
    ) {
        throw new CustomAgentProtocolError({
            code:
                "INVALID_RESPONSE_STATUS",

            message:
                'Response status must be "completed" or "failed".',
        });
    }

    const agent =
        requireRecord(
            record.agent,
            "agent",
        );

    const estimate =
        requireRecord(
            record.estimate,
            "estimate",
        );

    const probability =
        requireProbability(
            estimate.probability,
            "estimate.probability",
        );

    const confidence =
        requireProbability(
            estimate.confidence,
            "estimate.confidence",
        );

    const recommendedAction =
        requireString(
            estimate.recommendedAction,
            "estimate.recommendedAction",
        ) as CustomAgentAction;

    if (
        !ACTIONS.has(
            recommendedAction,
        )
    ) {
        throw new CustomAgentProtocolError({
            code:
                "INVALID_ACTION",

            message:
                "recommendedAction must be BUY_YES, BUY_NO or PASS.",
        });
    }

    const keyFactors =
        requireStringArray(
            estimate.keyFactors,
            "estimate.keyFactors",
        );

    const risks =
        requireStringArray(
            estimate.risks,
            "estimate.risks",
        );

    return {
        protocolVersion:
            CUSTOM_AGENT_PROTOCOL_VERSION,

        requestId,

        agent: {
            id: requireString(
                agent.id,
                "agent.id",
            ),

            version:
                requireString(
                    agent.version,
                    "agent.version",
                ),
        },

        status: "completed",

        research:
            record.research as
            | CustomAgentRunResponse["research"]
            | undefined,

        estimate: {
            probability,

            confidence,

            reasoning:
                requireString(
                    estimate.reasoning,
                    "estimate.reasoning",
                ),

            keyFactors,

            risks,

            recommendedAction,

            metadata:
                isRecord(
                    estimate.metadata,
                )
                    ? estimate.metadata
                    : undefined,
        },

        completedAt:
            requireIsoDate(
                record.completedAt,
                "completedAt",
            ),

        metadata:
            isRecord(
                record.metadata,
            )
                ? record.metadata
                : undefined,
    };
}

function validateErrorResponse(
    record: Record<
        string,
        unknown
    >,
): CustomAgentErrorResponse {
    const error =
        requireRecord(
            record.error,
            "error",
        );

    return {
        protocolVersion:
            CUSTOM_AGENT_PROTOCOL_VERSION,

        requestId:
            requireString(
                record.requestId,
                "requestId",
            ),

        status: "failed",

        error: {
            code:
                requireString(
                    error.code,
                    "error.code",
                ),

            message:
                requireString(
                    error.message,
                    "error.message",
                ),

            retryable:
                requireBoolean(
                    error.retryable,
                    "error.retryable",
                ),

            details:
                isRecord(
                    error.details,
                )
                    ? error.details
                    : undefined,
        },

        completedAt:
            requireIsoDate(
                record.completedAt,
                "completedAt",
            ),
    };
}

function requireProbability(
    value: unknown,
    path: string,
): number {
    const number =
        requireFiniteNumber(
            value,
            path,
        );

    if (
        number < 0 ||
        number > 1
    ) {
        throw new CustomAgentProtocolError({
            code:
                "INVALID_PROBABILITY",

            message:
                `${path} must be between 0 and 1.`,
        });
    }

    return number;
}

function requireFiniteNumber(
    value: unknown,
    path: string,
): number {
    if (
        typeof value !==
        "number" ||
        !Number.isFinite(value)
    ) {
        throw new CustomAgentProtocolError({
            code:
                "INVALID_NUMBER",

            message:
                `${path} must be a finite number.`,
        });
    }

    return value;
}

function requireString(
    value: unknown,
    path: string,
): string {
    if (
        typeof value !==
        "string" ||
        value.trim().length === 0
    ) {
        throw new CustomAgentProtocolError({
            code:
                "INVALID_STRING",

            message:
                `${path} must be a non-empty string.`,
        });
    }

    return value;
}

function requireStringArray(
    value: unknown,
    path: string,
): string[] {
    if (
        !Array.isArray(value) ||
        !value.every(
            (item) =>
                typeof item ===
                "string",
        )
    ) {
        throw new CustomAgentProtocolError({
            code:
                "INVALID_STRING_ARRAY",

            message:
                `${path} must be an array of strings.`,
        });
    }

    return value;
}

function requireBoolean(
    value: unknown,
    path: string,
): boolean {
    if (
        typeof value !==
        "boolean"
    ) {
        throw new CustomAgentProtocolError({
            code:
                "INVALID_BOOLEAN",

            message:
                `${path} must be a boolean.`,
        });
    }

    return value;
}

function requireIsoDate(
    value: unknown,
    path: string,
): string {
    const dateString =
        requireString(
            value,
            path,
        );

    const timestamp =
        Date.parse(
            dateString,
        );

    if (
        !Number.isFinite(
            timestamp,
        )
    ) {
        throw new CustomAgentProtocolError({
            code:
                "INVALID_DATE",

            message:
                `${path} must be a valid ISO date string.`,
        });
    }

    return dateString;
}

function requireRecord(
    value: unknown,
    path: string,
): Record<
    string,
    unknown
> {
    if (
        !isRecord(value)
    ) {
        throw new CustomAgentProtocolError({
            code:
                "INVALID_OBJECT",

            message:
                `${path} must be an object.`,
        });
    }

    return value;
}

function isRecord(
    value: unknown,
): value is Record<
    string,
    unknown
> {
    return (
        typeof value ===
        "object" &&
        value !== null &&
        !Array.isArray(value)
    );
}