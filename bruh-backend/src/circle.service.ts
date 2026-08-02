import { Injectable } from '@nestjs/common';
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';

export interface CircleTransactionResult {
  id: string;

  state: string;

  txHash?: string;

  raw: unknown;
}

export class CircleTransactionError extends Error {
  readonly transactionId: string;

  readonly state?: string;

  readonly raw?: unknown;

  constructor(input: {
    message: string;

    transactionId: string;

    state?: string;

    raw?: unknown;
  }) {
    super(input.message);

    this.name = 'CircleTransactionError';

    this.transactionId = input.transactionId;

    this.state = input.state;

    this.raw = input.raw;
  }
}

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

  async waitForTransaction(
    transactionId: string,
    maxAttempts = 20,
  ): Promise<string | null> {
    for (let i = 0; i < maxAttempts; i++) {
      const tx = await this.getTransactionStatus(transactionId);
      if (tx?.state === 'COMPLETE' || tx?.state === 'CONFIRMED') {
        return tx.txHash || null;
      }
      if (tx?.state === 'FAILED') {
        console.error('Transaction failed:', tx);
        return null;
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
    return null;
  }

  async waitForTransactionResult(
    transactionId: string,
    options?: { maximumAttempts?: number; pollingIntervalMs?: number },
  ): Promise<CircleTransactionResult> {
    const maximumAttempts = options?.maximumAttempts ?? 20;

    const pollingIntervalMs = options?.pollingIntervalMs ?? 3_000;

    for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
      const transaction = await this.getTransactionStatus(transactionId);

      const state = transaction?.state ?? 'UNKNOWN';

      if (state === 'COMPLETE' || state === 'CONFIRMED') {
        return {
          id: transactionId,

          state,

          ...(transaction?.txHash
            ? {
                txHash: transaction.txHash,
              }
            : {}),

          raw: transaction,
        };
      }

      if (state === 'FAILED' || state === 'CANCELLED' || state === 'DENIED') {
        throw new CircleTransactionError({
          transactionId,

          state,

          raw: transaction,

          message: `Circle transaction ${transactionId} ended in state ${state}.`,
        });
      }

      await new Promise((resolve) => {
        setTimeout(resolve, pollingIntervalMs);
      });
    }

    throw new CircleTransactionError({
      transactionId,

      state: 'TIMEOUT',

      message: `Circle transaction ${transactionId} did not confirm after ${maximumAttempts} polling attempts.`,
    });
  }
}
