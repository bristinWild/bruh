import { Injectable } from '@nestjs/common';
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';

@Injectable()
export class CircleService {
    private client;

    constructor() {
        this.client = initiateDeveloperControlledWalletsClient({
            apiKey: process.env.CIRCLE_API_KEY!,
            entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
        });
    }

    async createWalletSet(name: string) {
        const res = await this.client.createWalletSet({ name });
        return res.data?.walletSet;
    }

    async createWallet(walletSetId: string, userAddress: string) {
        const res = await this.client.createWallets({
            walletSetId,
            blockchains: ['ARC-TESTNET'],
            count: 1,
            metadata: [{ name: `agent-${userAddress}` }],
        });
        return res.data?.wallets?.[0];
    }

    async getWalletBalance(walletId: string) {
        const res = await this.client.getWalletTokenBalance({ id: walletId });
        return res.data?.tokenBalances;
    }

    async executeContractCall(
        walletId: string,
        contractAddress: string,
        abiFunctionSignature: string,
        abiParameters: any[],
    ) {
        const res = await this.client.createContractExecutionTransaction({
            walletId,
            contractAddress,
            abiFunctionSignature,
            abiParameters,
            fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
        });
        return res.data;
    }

    async getTransactionStatus(transactionId: string) {
        const res = await this.client.getTransaction({ id: transactionId });
        return res.data?.transaction;
    }

    async waitForTransaction(transactionId: string, maxAttempts = 20): Promise<string | null> {
        for (let i = 0; i < maxAttempts; i++) {
            const tx = await this.getTransactionStatus(transactionId);
            if (tx?.state === 'COMPLETE' || tx?.state === 'CONFIRMED') {
                return tx.txHash || null;
            }
            if (tx?.state === 'FAILED') {
                console.error('Transaction failed:', tx);
                return null;
            }
            await new Promise(r => setTimeout(r, 3000));
        }
        return null;
    }
}