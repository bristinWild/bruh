import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase.service';
import { CircleService } from '../circle.service';
import Anthropic from '@anthropic-ai/sdk';
import { createPublicClient, http } from 'viem';

const MARKET_ABI = [
    {
        name: 'summary',
        type: 'function',
        inputs: [],
        outputs: [
            { name: 'question', type: 'string' },
            { name: 'closeTime', type: 'uint256' },
            { name: 'currentOutcome', type: 'uint8' },
            { name: 'yesPriceWad', type: 'uint256' },
            { name: 'noPriceWad', type: 'uint256' },
            { name: 'totalCollateral', type: 'uint256' },
            { name: 'yesShares', type: 'uint256' },
            { name: 'noShares', type: 'uint256' },
            { name: 'open', type: 'bool' },
            { name: 'resolved', type: 'bool' },
        ],
        stateMutability: 'view',
    },
] as const;

const MARKETS = [
    '0x0797b5f23ded30f1a6d7cd15c54efa7781267aa0',
    '0xcae8072e80e78ab243d42f74819b037dde623b7b',
] as `0x${string}`[];

const PERSONAS: Record<string, { system: string }> = {
    newshound: {
        system: `You are an aggressive momentum trader. You weight recent news and price action heavily. Be decisive and willing to take strong positions.`,
    },
    actuary: {
        system: `You are a conservative base-rate analyst. You anchor on historical frequencies and are skeptical of narrative-driven moves.`,
    },
};

@Injectable()
export class AgentsService {
    private client: Anthropic;
    private publicClient: any;
    private running = false;
    private getClient(): Anthropic {
        return new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY
        });
    }

    constructor(
        private supabase: SupabaseService,
        private circle: CircleService,

    ) {
        console.log('API KEY FIRST 20:', process.env.ANTHROPIC_API_KEY?.slice(0, 20));
        this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        this.publicClient = createPublicClient({
            transport: http(process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.io'),
        });
    }


    private async runAllActiveAgents() {
        const { data: activeWallets } = await this.supabase.db
            .from('agent_wallets')
            .select('*')
            .eq('status', 'active');

        if (!activeWallets?.length) return;

        console.log(`Running ${activeWallets.length} active agent(s)`);

        for (const wallet of activeWallets) {
            await this.runAgentCycle(wallet);
        }
    }

    private async runAgentCycle(wallet: any) {
        const strategies = wallet.strategy === 'both'
            ? ['newshound', 'actuary']
            : [wallet.strategy];

        for (const strategy of strategies) {
            for (const marketAddress of MARKETS) {
                // Check if agent was paused mid-cycle
                const { data: current } = await this.supabase.db
                    .from('agent_wallets')
                    .select('status')
                    .eq('id', wallet.id)
                    .single();

                if (current?.status === 'paused') {
                    console.log(`[${wallet.id}] Agent paused, stopping cycle`);
                    return;
                }

                try {
                    await this.processMarket(wallet, strategy, marketAddress);
                } catch (err) {
                    console.error(`Error on market ${marketAddress}:`, err);
                }
                await new Promise(r => setTimeout(r, 2000));
            }
        }
    }

    private async processMarket(wallet: any, strategy: string, marketAddress: `0x${string}`) {
        // Read market state
        const result = await this.publicClient.readContract({
            address: marketAddress,
            abi: MARKET_ABI,
            functionName: 'summary',
        });

        const [question, , , yesPriceWad, , , , , open] = result as any[];
        if (!open) return;

        const yesPrice = Number(yesPriceWad) / 1e18;

        // Reason with Claude
        const persona = PERSONAS[strategy] || PERSONAS.newshound;
        const response = await this.getClient().messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 300,
            system: persona.system,
            messages: [{
                role: 'user',
                content: `Market: "${question}"\nCurrent YES price: ${(yesPrice * 100).toFixed(1)}%\n\nEstimate true probability. Respond ONLY with JSON:\n{"probability": 0.65, "confidence": 0.7, "summary": "one line"}`
            }],
        });

        const text = response.content[0].type === 'text' ? response.content[0].text : '';
        const reasoning = JSON.parse(text.replace(/```json|```/g, '').trim());

        const edge = Math.abs(reasoning.probability - yesPrice);
        const isYes = reasoning.probability > yesPrice;

        // Log to Supabase regardless of trade
        if (edge < wallet.edge_threshold) {
            await this.logTrade(wallet.id, marketAddress, 'PASS', 0n, undefined, reasoning.summary, edge);
            return;
        }

        const usdcAmount = Math.floor(wallet.max_position_usdc * edge * wallet.kelly_fraction);
        console.log(`[${strategy}] ${isYes ? 'BUY_YES' : 'BUY_NO'} ${usdcAmount / 1e6} USDC on "${question}"`);

        let txHash: string | undefined = undefined;

        try {
            // Step 1: approve USDC spend by the market contract
            const approveTx = await this.circle.executeContractCall(
                wallet.circle_wallet_id,
                '0x3600000000000000000000000000000000000000', // USDC
                'approve(address,uint256)',
                [marketAddress, usdcAmount.toString()],
            );
            console.log(`[${strategy}] Approve submitted: ${approveTx.id}`);
            await this.circle.waitForTransaction(approveTx.id);

            // Step 2: execute buy
            const buyTx = await this.circle.executeContractCall(
                wallet.circle_wallet_id,
                marketAddress,
                'buy(bool,uint256,uint256)',
                [isYes, usdcAmount.toString(), '0'],
            );
            console.log(`[${strategy}] Buy submitted: ${buyTx.id}`);
            txHash = await this.circle.waitForTransaction(buyTx.id) || undefined;
            console.log(`[${strategy}] Confirmed txHash: ${txHash}`);
        } catch (err) {
            console.error(`[${strategy}] Trade execution failed:`, err);
        }

        await this.logTrade(
            wallet.id,
            marketAddress,
            isYes ? 'BUY_YES' : 'BUY_NO',
            BigInt(usdcAmount),
            txHash,
            reasoning.summary,
            edge
        );
    }

    private async logTrade(
        agentWalletId: string,
        marketAddress: string,
        action: string,
        usdcAmount: bigint,
        txHash: string | undefined,
        summary: string,
        edge: number,
    ) {
        await this.supabase.db.from('trades').insert({
            agent_wallet_id: agentWalletId,
            market_address: marketAddress,
            action,
            usdc_amount: usdcAmount.toString(),
            tx_hash: txHash,
            reasoning_summary: summary,
            edge,
        });
    }

    // Called from controller to activate/deactivate
    async setAgentStatus(walletId: string, status: 'active' | 'paused') {
        await this.supabase.db
            .from('agent_wallets')
            .update({ status })
            .eq('id', walletId);
    }

    // Get trade history for a wallet
    async getTradeHistory(walletId: string) {
        const { data } = await this.supabase.db
            .from('trades')
            .select('*')
            .eq('agent_wallet_id', walletId)
            .order('timestamp', { ascending: false })
            .limit(50);
        return data;
    }

    async runSingleCycle(walletId: string) {
        const { data: wallet } = await this.supabase.db
            .from('agent_wallets')
            .select('*')
            .eq('id', walletId)
            .single();

        if (!wallet) throw new Error('Wallet not found');
        await this.runAgentCycle(wallet);
    }
}