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