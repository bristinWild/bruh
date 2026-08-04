import type {
    CustomAgentRunConfig,
    CustomAgentRunMarket,
    CustomAgentRunResponse,
} from "@bruhmarket/agent-sdk";

import type {
    AgentDecision,
    ExecutionPlan,
} from "@bruhmarket/agent-sdk/runtime";

export interface RunCustomAgentDto {
    market: CustomAgentRunMarket;

    wallet?: {
        agentId: string;

        address: `0x${string}`;

        availableBalanceUsdc: number;
    };

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
}

export interface CustomAgentRunnerResult {
    runId: string;

    customAgentId: string;

    requestId: string;

    dryRun: true;

    status: "passed";

    response:
    CustomAgentRunResponse;

    decision:
    AgentDecision;

    executionPlan:
    ExecutionPlan;

    durationMs: number;

    persisted: true;
}