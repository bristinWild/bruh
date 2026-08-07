export interface PublicMarket {
    id: string;

    address:
    `0x${string}`;

    question:
    string;

    closeTime:
    string;

    closeTimeUnix:
    number;

    createdAt:
    string;

    creator:
    `0x${string}`;

    oracle:
    `0x${string}`;

    outcome:
    "UNRESOLVED"
    | "YES"
    | "NO"
    | "INVALID";

    yesPrice:
    number;

    noPrice:
    number;

    collateralUsdc:
    number;

    totalSharesYes:
    number;

    totalSharesNo:
    number;

    feeBps:
    number;

    open:
    boolean;

    resolved:
    boolean;

    network:
    "eip155:5042002";
}

export interface MarketPricePoint {
    blockNumber: number;
    timestamp: string;
    yesPrice: number;
    noPrice: number;
    eventType:
    | "BUY"
    | "SELL"
    | "INITIAL"
    | "CURRENT";
}

export type MarketActivity = {
    id: string;

    transactionHash:
    `0x${string}`;

    blockNumber:
    number;

    timestamp:
    string;

    trader:
    `0x${string}`;

    action:
    "BUY" | "SELL";

    side:
    "YES" | "NO";

    usdcAmount:
    number;

    shares:
    number;

    feeUsdc:
    number;

    yesPrice:
    number;

    noPrice:
    number;

    pending?: boolean;
};

export type MarketStats = {
    liquidityUsdc: number;
    totalVolumeUsdc: number;

    yesPrice: number;
    noPrice: number;

    yesShares: number;
    noShares: number;

    tradeCount: number;
};

export type MarketPosition = {
    side:
    | "YES"
    | "NO";

    shares:
    number;

    avgEntry:
    number;

    currentPrice:
    number;

    costBasisUsdc:
    number;

    currentValueUsdc:
    number;

    unrealizedPnlUsdc:
    number;

    unrealizedPnlPercent:
    number;

    realizedPnlUsdc:
    number;
};

export type MarketPortfolio = {
    marketAddress:
    `0x${string}`;

    wallet:
    `0x${string}`;

    yes:
    MarketPosition;

    no:
    MarketPosition;

    totalCurrentValueUsdc:
    number;

    totalUnrealizedPnlUsdc:
    number;

    totalRealizedPnlUsdc:
    number;
};

export type MarketAgentDecision = {
    id: string;

    agentWalletId: string;
    agentId: string | null;
    agentName: string | null;

    profileId: string;

    marketAddress: string;
    marketQuestion: string;

    status: string;

    action:
    | "BUY_YES"
    | "BUY_NO"
    | "PASS";

    probability: number;
    marketProbability: number;
    edge: number;
    confidence: number;
    amountUsdc: number;

    reasoning: string;

    researchSummary: string | null;

    keyFactors: string[];
    risks: string[];

    transactionHash: string | null;

    createdAt: string;
    completedAt: string | null;
};