import type {
    AgentMemory,
    AgentMemoryContext,
    AgentMemoryQuery,
    AgentPerformanceSummary,
    AgentReflectionMemory,
    AgentResolutionMemory,
    AgentRunMemory,
    AgentTradeMemory,
} from "./types";

export interface AgentMemoryProvider {
    readonly id: string;

    save(memory: AgentMemory): Promise<void>;

    saveMany(
        memories: AgentMemory[],
    ): Promise<void>;

    find(
        query: AgentMemoryQuery,
    ): Promise<AgentMemory[]>;

    getById(
        memoryId: string,
    ): Promise<AgentMemory | null>;

    getRunMemory(
        runId: string,
    ): Promise<AgentRunMemory | null>;

    getTradeByExecutionPlan(
        executionPlanId: string,
    ): Promise<AgentTradeMemory | null>;

    updateTrade(
        executionPlanId: string,
        updates: Partial<AgentTradeMemory>,
    ): Promise<AgentTradeMemory>;

    saveResolution(
        resolution: AgentResolutionMemory,
    ): Promise<void>;

    saveReflection(
        reflection: AgentReflectionMemory,
    ): Promise<void>;

    getContext(input: {
        agentId: string;
        profileId?: string;
        marketId?: string;
        limit?: number;
    }): Promise<AgentMemoryContext>;

    getPerformance(
        agentId: string,
        profileId?: string,
    ): Promise<AgentPerformanceSummary>;

    delete(memoryId: string): Promise<void>;

    clearAgent(agentId: string): Promise<void>;
}

export class AgentMemoryError extends Error {
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

        this.name = "AgentMemoryError";

        this.code = code;

        this.cause = cause;
    }
}