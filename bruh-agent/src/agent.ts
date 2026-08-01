import { CONFIG } from "./config";
import {
    getMarketState,
    getUsdcBalance,
    approveAndBuy,
    MarketState,
} from "./market";
import { reason, Reasoning } from "./reasoning";
import { privateKeyToAccount } from "viem/accounts";

export interface AgentConfig {
    name: string;
    strategy: string;
    privateKey: `0x${string}`;
    markets: `0x${string}`[];
}

export interface Decision {
    agent: string;
    market: string;
    question: string;
    marketPrice: number;
    estimatedProb: number;
    edge: number;
    action: "BUY_YES" | "BUY_NO" | "PASS";
    usdcAmount: bigint;
    reasoning: Reasoning;
    txHash?: `0x${string}`;
    timestamp: Date;
}

function kellySize(
    edge: number,
    balance: bigint,
    kellyFraction: number
): bigint {
    const kellyBet = Math.max(0, edge * kellyFraction);
    const maxBet = BigInt(CONFIG.MAX_POSITION_USDC);
    const sized = BigInt(Math.floor(Number(balance) * kellyBet));
    return sized > maxBet ? maxBet : sized;
}

export async function runAgentCycle(config: AgentConfig): Promise<Decision[]> {
    const account = privateKeyToAccount(config.privateKey);
    const walletAddress = account.address;
    const decisions: Decision[] = [];

    console.log(`\n🤖 [${config.name}] Starting cycle — wallet: ${walletAddress}`);

    // Get USDC balance
    const balance = await getUsdcBalance(walletAddress);
    console.log(`💰 [${config.name}] Balance: ${Number(balance) / 1e6} USDC`);

    if (balance < BigInt(CONFIG.MIN_TRADE_USDC)) {
        console.log(`⚠️  [${config.name}] Balance too low to trade`);
        return decisions;
    }

    for (const marketAddress of config.markets) {
        try {
            // 1. Read market state
            const market: MarketState = await getMarketState(marketAddress);

            if (!market.open) {
                console.log(`⏸️  [${config.name}] Market closed: ${market.question}`);
                continue;
            }

            console.log(`\n📊 [${config.name}] Market: "${market.question}"`);
            console.log(`   Price: YES=${(market.yesPrice * 100).toFixed(1)}%`);

            // 2. Reason about probability
            console.log(`🧠 [${config.name}] Reasoning...`);
            const reasoning = await reason(market, config.name, config.strategy);

            console.log(`   Estimate: ${(reasoning.probability * 100).toFixed(1)}% (confidence: ${(reasoning.confidence * 100).toFixed(0)}%)`);
            console.log(`   Summary: ${reasoning.summary}`);

            // 3. Calculate edge
            const edge = reasoning.probability - market.yesPrice;
            const absEdge = Math.abs(edge);

            console.log(`   Edge: ${(edge * 100).toFixed(1)}pts`);

            // 4. Decide
            const decision: Decision = {
                agent: config.name,
                market: marketAddress,
                question: market.question,
                marketPrice: market.yesPrice,
                estimatedProb: reasoning.probability,
                edge,
                action: "PASS",
                usdcAmount: 0n,
                reasoning,
                timestamp: new Date(),
            };

            if (absEdge < CONFIG.EDGE_THRESHOLD) {
                console.log(`   ➡️  PASS - edge too small (${(absEdge * 100).toFixed(1)}% < ${CONFIG.EDGE_THRESHOLD * 100}%)`);
                decision.action = "PASS";
            } else {
                const isYes = edge > 0;
                decision.action = isYes ? "BUY_YES" : "BUY_NO";

                // Kelly sizing
                const positionSize = kellySize(absEdge, balance, CONFIG.KELLY_FRACTION);
                decision.usdcAmount = positionSize;

                if (positionSize < BigInt(CONFIG.MIN_TRADE_USDC)) {
                    console.log(`   ➡️  PASS - position size too small`);
                    decision.action = "PASS";
                } else {
                    console.log(`   ⚡ ${decision.action} — ${Number(positionSize) / 1e6} USDC`);

                    try {
                        const txHash = await approveAndBuy(
                            config.privateKey,
                            marketAddress,
                            isYes,
                            positionSize
                        );
                        decision.txHash = txHash;
                        console.log(`  Tx successfully completed: ${txHash}`);
                    } catch (err) {
                        console.error(`  Trade Execution failed:`, err);
                        decision.action = "PASS";
                    }
                }
            }

            decisions.push(decision);

            // Pause between markets
            await new Promise((r) => setTimeout(r, 3000));
        } catch (err) {
            console.error(` [${config.name}] Error on market ${marketAddress}:`, err);
        }
    }

    return decisions;
}