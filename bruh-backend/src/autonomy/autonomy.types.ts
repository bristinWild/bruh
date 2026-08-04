export interface AutonomousAgentRecord {
    id: string;
    user_address: string;

    agent_id?: string | null;
    agent_name?: string | null;

    strategy: string;

    circle_wallet_id: string;
    circle_wallet_address?: string | null;

    autonomous_enabled: boolean;
    schedule_interval_minutes: number;
    auto_research: boolean;
    auto_trade: boolean;
    market_scan_limit: number;

    last_scheduled_run_at?: string | null;
}

export interface MarketCandidate {
    address: `0x${string}`;
    question: string;
    closesAt: string;
    yesPrice: number;
    noPrice: number;
    liquidityUsdc: number;
}

export interface UpdateAutonomyConfigDto {
    autonomousEnabled?: boolean;
    scheduleIntervalMinutes?: number;
    autoResearch?: boolean;
    autoTrade?: boolean;
    marketScanLimit?: number;
}