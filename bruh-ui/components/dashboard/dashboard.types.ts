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