import {
    CUSTOM_AGENT_PROTOCOL_VERSION,
    validateCustomAgentResponse,
    type CustomAgentRunResponse,
} from "../index";

const response:
    CustomAgentRunResponse = {
    protocolVersion:
        CUSTOM_AGENT_PROTOCOL_VERSION,

    requestId:
        "request-123",

    agent: {
        id:
            "consumer-test-agent",

        version:
            "0.1.0",
    },

    status:
        "completed",

    estimate: {
        probability:
            0.64,

        confidence:
            0.72,

        reasoning:
            "The evidence supports a probability above the current market price.",

        keyFactors: [
            "Positive evidence",
        ],

        risks: [
            "Market conditions may change",
        ],

        recommendedAction:
            "BUY_YES",
    },

    completedAt:
        new Date()
            .toISOString(),
};

const validated =
    validateCustomAgentResponse(
        response,
        "request-123",
    );

console.log(
    "Validated custom agent response:",
    {
        requestId:
            validated.requestId,

        status:
            validated.status,
    },
);