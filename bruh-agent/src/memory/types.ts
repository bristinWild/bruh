import type {
    AgentAction,
    AgentDecision,
    AgentEstimate,
    AgentResearchResult,
    ExecutionPlan,
    RiskCheckResult,
} from "../core/types";

export type AgentMemoryType =
    | "run"
    | "decision"
    | "trade"
    | "resolution"
    | "reflection";

export type TradeExecutionStatus =
    | "pending"
    | "executing"
    | "executed"
    | "failed"
    | "rejected"
    | "skipped";

export type MarketResolution =
    | "YES"
    | "NO"
    | "INVALID"
    | "CANCELLED";

export interface AgentMemoryRecord {
    id: string;

    type: AgentMemoryType;

    agentId: string;

    profileId: string;

    profileVersion: string;

    marketId: string;

    runId?: string;

    createdAt: string;

    updatedAt?: string;

    metadata?: Record<string, unknown>;
}

export interface AgentRunMemory
    extends AgentMemoryRecord {
    type: "run";

    marketQuestion: string;

    research: AgentResearchResult;

    estimate: AgentEstimate;

    decision: AgentDecision;

    executionPlan: ExecutionPlan;
}

export interface AgentDecisionMemory
    extends AgentMemoryRecord {
    type: "decision";

    marketQuestion: string;

    action: AgentAction;

    probability: number;

    marketProbability: number;

    confidence: number;

    edge: number;

    amountUsdc: number;

    reasoning: string;

    keyFactors: string[];

    risks: string[];

    riskChecks: RiskCheckResult[];

    researchCostUsdc: number;
}

export interface AgentTradeMemory
    extends AgentMemoryRecord {
    type: "trade";

    executionPlanId: string;

    marketQuestion: string;

    action: Exclude<AgentAction, "PASS">;

    side: "YES" | "NO";

    amountUsdc: number;

    executionStatus: TradeExecutionStatus;

    walletAddress?: string;

    network?: string;

    transactionHash?: string;

    executedAt?: string;

    failureReason?: string;

    metadata?: Record<string, unknown>;
}

export interface AgentResolutionMemory
    extends AgentMemoryRecord {
    type: "resolution";

    marketQuestion: string;

    resolution: MarketResolution;

    resolvedAt: string;

    action: AgentAction;

    positionAmountUsdc: number;

    probability: number;

    marketProbability: number;

    confidence: number;

    pnlUsdc: number;

    returnUsdc: number;

    won: boolean | null;

    transactionHash?: string;
}

export interface AgentReflectionMemory
    extends AgentMemoryRecord {
    type: "reflection";

    marketQuestion: string;

    resolution: MarketResolution;

    prediction: AgentAction;

    probability: number;

    confidence: number;

    pnlUsdc: number;

    outcomeAssessment:
    | "correct"
    | "incorrect"
    | "no-position"
    | "invalid";

    summary: string;

    whatWorked: string[];

    whatFailed: string[];

    lessons: string[];

    futureAdjustments: string[];
}

export type AgentMemory =
    | AgentRunMemory
    | AgentDecisionMemory
    | AgentTradeMemory
    | AgentResolutionMemory
    | AgentReflectionMemory;

export interface AgentMemoryQuery {
    agentId?: string;

    profileId?: string;

    marketId?: string;

    runId?: string;

    types?: AgentMemoryType[];

    from?: string;

    to?: string;

    limit?: number;

    newestFirst?: boolean;
}

export interface AgentMemoryContext {
    recentRuns: AgentRunMemory[];

    recentDecisions: AgentDecisionMemory[];

    recentTrades: AgentTradeMemory[];

    recentResolutions: AgentResolutionMemory[];

    recentReflections: AgentReflectionMemory[];

    summary: string;
}

export interface AgentPerformanceSummary {
    agentId: string;

    profileId?: string;

    totalRuns: number;

    totalDecisions: number;

    totalTrades: number;

    resolvedTrades: number;

    winningTrades: number;

    losingTrades: number;

    winRate: number;

    totalVolumeUsdc: number;

    totalPnlUsdc: number;

    roi: number;

    averageConfidence: number;

    averageEdge: number;

    averageResearchCostUsdc: number;

    averagePositionUsdc: number;

    bestTradePnlUsdc: number;

    worstTradePnlUsdc: number;

    lastUpdatedAt: string;
}