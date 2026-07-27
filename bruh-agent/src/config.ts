import dotenv from "dotenv";
dotenv.config();

export const CONFIG = {
    // Arc testnet
    RPC_URL: process.env.ARC_RPC_URL || "https://rpc.testnet.arc.io",
    CHAIN_ID: 5042002,

    // Contracts
    MARKET_FACTORY: "0xa141903a7877A670B0c7Ebb7F8B7B67BD46bB240" as `0x${string}`,
    MARKET_1: "0x0797b5f23ded30f1a6d7cd15c54efa7781267aa0" as `0x${string}`,
    MARKET_2: "0xcae8072e80e78ab243d42f74819b037dde623b7b" as `0x${string}`,
    USDC: "0x3600000000000000000000000000000000000000" as `0x${string}`,

    // Agent wallets (private keys from .env)
    NEWSHOUND_KEY: process.env.NEWSHOUND_PRIVATE_KEY as `0x${string}`,
    ACTUARY_KEY: process.env.ACTUARY_PRIVATE_KEY as `0x${string}`,

    // Claude API
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",

    // Decision parameters
    EDGE_THRESHOLD: 0.05,       // minimum edge to trade (5%)
    KELLY_FRACTION: 0.25,       // fractional Kelly (25%)
    MAX_POSITION_USDC: 2_000_000, // 2 USDC max per trade (6 decimals)
    MIN_TRADE_USDC: 100_000,    // 0.10 USDC minimum

    // Loop timing
    CYCLE_INTERVAL_MS: 30_000,  // run every 30 seconds
};

// Market ABI — only the functions we need
export const MARKET_ABI = [
    {
        name: "buy",
        type: "function",
        inputs: [
            { name: "isYes", type: "bool" },
            { name: "usdcIn", type: "uint256" },
            { name: "minSharesOut", type: "uint256" },
        ],
        outputs: [{ name: "sharesOut", type: "uint256" }],
        stateMutability: "nonpayable",
    },
    {
        name: "yesPrice",
        type: "function",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
    },
    {
        name: "isOpen",
        type: "function",
        inputs: [],
        outputs: [{ name: "", type: "bool" }],
        stateMutability: "view",
    },
    {
        name: "summary",
        type: "function",
        inputs: [],
        outputs: [
            { name: "question", type: "string" },
            { name: "closeTime", type: "uint256" },
            { name: "currentOutcome", type: "uint8" },
            { name: "yesPriceWad", type: "uint256" },
            { name: "noPriceWad", type: "uint256" },
            { name: "totalCollateral", type: "uint256" },
            { name: "yesShares", type: "uint256" },
            { name: "noShares", type: "uint256" },
            { name: "open", type: "bool" },
            { name: "resolved", type: "bool" },
        ],
        stateMutability: "view",
    },
] as const;

export const USDC_ABI = [
    {
        name: "approve",
        type: "function",
        inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
        ],
        outputs: [{ name: "", type: "bool" }],
        stateMutability: "nonpayable",
    },
    {
        name: "balanceOf",
        type: "function",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
    },
] as const;