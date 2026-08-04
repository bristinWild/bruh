export type AgentState = "idle" | "running" | "done";
export type DashboardTab = "agent" | "pnl" | "transactions";

export interface AgentWallet {
  id: string;
  agent_id?: string;
  agent_name?: string;
  strategy: string;
  circle_wallet_address: `0x${string}`;
  edge_threshold: number;
  kelly_fraction: number;
  status?: string;
}

export type TradeAction = "BUY_YES" | "BUY_NO" | "PASS";
export type AgentAction = TradeAction;

export interface Trade {
  id: string;
  action: TradeAction;
  timestamp: string;

  reasoning_summary?: string;
  edge?: number;
  usdc_amount?: number;
  probability?: number;
  market_probability?: number;
  market_question?: string;
  market?: string;
  market_address?: string;
  tx_hash?: string;
  transaction_hash?: string;
  research_cost?: number;
  sources_count?: number;
  execution_time_ms?: number;
}

export interface AgentResearch {
  summary: string;
  costUsdc?: number;
  evidence?: Array<{
    type?: string;
    title?: string;
    summary?: string;
    source?: string;
    url?: string;
    publishedAt?: string;
    credibilityScore?: number;
  }>;
  metadata?: Record<string, unknown>;
}

export interface AgentEstimate {
  probability: number;
  confidence: number;
  reasoning: string;
  keyFactors: string[];
  risks: string[];
  recommendedAction: AgentAction;
}

export interface AgentRiskCheck {
  id: string;
  passed: boolean;
  message: string;
  value?: number;
  limit?: number;
}

export interface AgentDecision {
  action: AgentAction;
  probability: number;
  marketProbability: number;
  confidence: number;
  edge: number;
  amountUsdc: number;
  reasoning: string;
  keyFactors: string[];
  risks: string[];
  riskChecks: AgentRiskCheck[];
  shouldExecute?: boolean;
  researchCostUsdc?: number;
  agreement?: string;
}

export interface ExecutionPlan {
  id: string;
  runId: string;
  agentId?: string;
  profileId: string;
  profileVersion: string;

  marketId: string;
  marketQuestion: string;

  network: string;
  walletAddress?: string;

  action: AgentAction;
  side: "YES" | "NO" | null;
  status: "ready" | "skipped" | string;

  amountUsdc: number;
  researchCostUsdc: number;

  estimatedProbability: number;
  marketProbability: number;
  edge: number;
  confidence: number;

  expectedReturnUsdc: number;
  expectedProfitUsdc: number;

  riskLevel: string;
  reasoning: string;

  keyFactors: string[];
  risks: string[];
  riskChecks: AgentRiskCheck[];

  execution: {
    requiresApproval: boolean;
    allowExecution: boolean;
    dryRun: boolean;
    expectedContract?: string;
    slippageBps: number;
    deadline: string;
  };

  createdAt: string;
  expiresAt: string;

  metadata?: Record<string, unknown>;
}

export interface AgentRun {
  id: string;

  agent_wallet_id: string;
  agent_id?: string | null;

  profile_id: string;
  profile_version: string;

  market_id: string;
  market_address: string;
  market_question: string;

  status:
  | "running"
  | "planned"
  | "passed"
  | "execution_queued"
  | "executing"
  | "executed"
  | "execution_failed"
  | "failed";

  research: AgentResearch | null;
  estimate: AgentEstimate | null;
  decision: AgentDecision | null;
  execution_plan: ExecutionPlan | null;

  execution_receipt_id?: string | null;
  error_message?: string | null;

  started_at: string;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;

  metadata?: Record<string, unknown>;
}

export interface ConsensusMember {
  runId: string;
  profileId: string;
  action: AgentAction;
  probability: number;
  confidence: number;
  edge: number;
  amountUsdc: number;
  reasoning: string;
}

export interface ConsensusResult {
  id: string;

  action: AgentAction;

  probability: number;
  marketProbability: number;
  edge: number;
  confidence: number;
  amountUsdc: number;

  reasoning: string;

  agreement:
  | "unanimous"
  | "partial"
  | "conflicted"
  | "none";

  members: ConsensusMember[];

  executionPlan: ExecutionPlan;
}

export interface RunAgentResponse {
  walletId: string;

  runs: Array<{
    runId: string;
    profileId: string;
    status: string;
    executionPlan?: ExecutionPlan;
  }>;

  consensus?: ConsensusResult;
}

export interface AgentAutonomyConfig {
  autonomousEnabled: boolean;
  scheduleIntervalMinutes: number;
  autoResearch: boolean;
  autoTrade: boolean;
  marketScanLimit: number;
  lastScheduledRunAt?: string | null;
}

export interface UpdateAgentAutonomyConfig {
  autonomousEnabled?: boolean;
  scheduleIntervalMinutes?: number;
  autoResearch?: boolean;
  autoTrade?: boolean;
  marketScanLimit?: number;
}
