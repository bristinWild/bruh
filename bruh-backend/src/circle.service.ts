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
            blockchains: ['ARB-SEPOLIA'], // Arc testnet
            count: 1,
            metadata: [{ name: `agent-${userAddress}` }],
        });
        return res.data?.wallets?.[0];
    }

    async getWalletBalance(walletId: string) {
        const res = await this.client.getWalletTokenBalance({ id: walletId });
        return res.data?.tokenBalances;
    }
}