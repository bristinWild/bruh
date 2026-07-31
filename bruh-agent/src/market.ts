import { createPublicClient, createWalletClient, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CONFIG, MARKET_ABI, USDC_ABI } from "./config.js";

const arcTestnet = {
    id: CONFIG.CHAIN_ID,
    name: "Arc Testnet",
    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
    rpcUrls: { default: { http: [CONFIG.RPC_URL] } },
};

export const publicClient = createPublicClient({
    chain: arcTestnet as any,
    transport: http(CONFIG.RPC_URL),
});

export interface MarketState {
    address: `0x${string}`;
    question: string;
    yesPrice: number;   // 0–1
    noPrice: number;    // 0–1
    collateral: bigint;
    open: boolean;
    resolved: boolean;
}

export async function getMarketState(address: `0x${string}`): Promise<MarketState> {
    const result = await publicClient.readContract({
        address,
        abi: MARKET_ABI,
        functionName: "summary",
    });

    const [question, , , yesPriceWad, , totalCollateral, , , open, resolved] = result;

    return {
        address,
        question,
        yesPrice: Number(yesPriceWad) / 1e18,
        noPrice: 1 - Number(yesPriceWad) / 1e18,
        collateral: totalCollateral,
        open,
        resolved,
    };
}

export async function getUsdcBalance(
    walletAddress: `0x${string}`
): Promise<bigint> {
    return publicClient.readContract({
        address: CONFIG.USDC,
        abi: USDC_ABI,
        functionName: "balanceOf",
        args: [walletAddress],
    });
}

export async function approveAndBuy(
    privateKey: `0x${string}`,
    marketAddress: `0x${string}`,
    isYes: boolean,
    usdcAmount: bigint
): Promise<`0x${string}`> {
    const account = privateKeyToAccount(privateKey);
    const walletClient = createWalletClient({
        account,
        chain: arcTestnet as any,
        transport: http(CONFIG.RPC_URL),
    });

    // Approve USDC spend
    await walletClient.writeContract({
        chain: null,
        address: CONFIG.USDC,
        abi: USDC_ABI,
        functionName: "approve",
        args: [marketAddress, usdcAmount],
    });

    // Small delay for approval to land
    await new Promise((r) => setTimeout(r, 2000));

    // Buy shares
    const hash = await walletClient.writeContract({
        chain: null,
        address: marketAddress,
        abi: MARKET_ABI,
        functionName: "buy",
        args: [isYes, usdcAmount, 0n],

    });

    return hash;
}