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