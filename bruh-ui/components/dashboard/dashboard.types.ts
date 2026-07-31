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

export interface Trade {
  id: string;
  action: string;
  timestamp: string;
  usdc_amount?: number;
  edge?: number;
  market_address?: string;
}
