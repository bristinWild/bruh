import http from "node:http";

import {
    CUSTOM_AGENT_PROTOCOL_VERSION,
    type CustomAgentRunRequest,
} from "@bruhmarket/agent-sdk";

const PORT = 4000;

const server =
    http.createServer(
        (
            request,
            response,
        ) => {
            if (
                request.method ===
                "GET" &&
                request.url ===
                "/v1/health"
            ) {
                sendJson(
                    response,
                    200,
                    {
                        protocolVersion:
                            CUSTOM_AGENT_PROTOCOL_VERSION,

                        status:
                            "healthy",

                        agent: {
                            id:
                                "macro-sentinel",

                            name:
                                "Macro Sentinel",

                            version:
                                "0.1.0",
                        },

                        checkedAt:
                            new Date()
                                .toISOString(),
                    },
                );

                return;
            }

            if (
                request.method ===
                "POST" &&
                request.url ===
                "/v1/run"
            ) {
                void readJson(
                    request,
                )
                    .then(
                        (
                            body,
                        ) => {
                            const runRequest =
                                body as
                                CustomAgentRunRequest;

                            sendJson(
                                response,
                                200,
                                {
                                    protocolVersion:
                                        CUSTOM_AGENT_PROTOCOL_VERSION,

                                    requestId:
                                        runRequest
                                            .requestId,

                                    agent: {
                                        id:
                                            "macro-sentinel",

                                        version:
                                            "0.1.0",
                                    },

                                    status:
                                        "completed",

                                    research: {
                                        summary:
                                            "Mock macro research completed.",

                                        evidence:
                                            [],

                                        costUsdc:
                                            0,
                                    },

                                    estimate: {
                                        probability:
                                            0.57,

                                        confidence:
                                            0.68,

                                        reasoning:
                                            "The mock macro indicators support a probability moderately above the current market price.",

                                        keyFactors: [
                                            "Macroeconomic conditions",
                                            "Current market pricing",
                                        ],

                                        risks: [
                                            "Unexpected policy changes",
                                            "Market conditions may change",
                                        ],

                                        recommendedAction:
                                            "BUY_YES",
                                    },

                                    completedAt:
                                        new Date()
                                            .toISOString(),

                                    metadata: {
                                        mock:
                                            true,

                                        dryRun:
                                            runRequest
                                                .config
                                                .dryRun,
                                    },
                                },
                            );
                        },
                    )
                    .catch(
                        (
                            error,
                        ) => {
                            sendJson(
                                response,
                                400,
                                {
                                    message:
                                        error instanceof
                                            Error
                                            ? error
                                                .message
                                            : "Invalid request.",
                                },
                            );
                        },
                    );

                return;
            }

            sendJson(
                response,
                404,
                {
                    message:
                        "Not found",
                },
            );
        },
    );

server.listen(
    PORT,
    () => {
        console.log(
            `Custom agent listening on http://localhost:${PORT}`,
        );

        console.log(
            "Protocol version:",
            CUSTOM_AGENT_PROTOCOL_VERSION,
        );
    },
);

function sendJson(
    response:
        http.ServerResponse,

    statusCode:
        number,

    body:
        unknown,
): void {
    response.writeHead(
        statusCode,
        {
            "Content-Type":
                "application/json",
        },
    );

    response.end(
        JSON.stringify(
            body,
        ),
    );
}

async function readJson(
    request:
        http.IncomingMessage,
): Promise<unknown> {
    const chunks:
        Buffer[] = [];

    for await (
        const chunk of request
    ) {
        chunks.push(
            Buffer.isBuffer(
                chunk,
            )
                ? chunk
                : Buffer.from(
                    chunk,
                ),
        );
    }

    const text =
        Buffer.concat(
            chunks,
        ).toString(
            "utf8",
        );

    return JSON.parse(
        text,
    ) as unknown;
}