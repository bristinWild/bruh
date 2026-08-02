import type { ExecutionPlan } from 'bruh-agent';

import { ExecutionService } from './execution.service';

import type { ExecutionReceipt } from './execution.types';

describe('ExecutionService', () => {
  const plan = {
    id: '11111111-1111-4111-8111-111111111111',

    runId: '22222222-2222-4222-8222-222222222222',

    agentId: 'agent-1',

    profileId: 'newshound',

    profileVersion: '1.0.0',

    marketId: 'market-1',

    marketQuestion: 'Will ETH rise?',

    network: 'eip155:5042002',

    walletAddress: '0x1111111111111111111111111111111111111111',

    action: 'BUY_YES',

    side: 'YES',

    status: 'ready',

    amountUsdc: 5,

    researchCostUsdc: 0.01,

    estimatedProbability: 0.7,

    marketProbability: 0.5,

    edge: 0.2,

    confidence: 0.8,

    expectedReturnUsdc: 7,

    expectedProfitUsdc: 2,

    riskLevel: 'medium',

    reasoning: 'Positive evidence.',

    keyFactors: [],

    risks: [],

    research: {
      summary: 'Research',

      sourceCount: 0,

      sources: [],

      costUsdc: 0.01,
    },

    riskChecks: [],

    execution: {
      requiresApproval: false,

      allowExecution: true,

      dryRun: false,

      slippageBps: 100,

      deadline: new Date(Date.now() + 60_000).toISOString(),
    },

    createdAt: new Date().toISOString(),

    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  } satisfies ExecutionPlan;

  const receipt: ExecutionReceipt = {
    id: '33333333-3333-4333-8333-333333333333',

    executionPlanId: plan.id,

    runId: plan.runId,

    agentId: plan.agentId,

    profileId: plan.profileId,

    marketId: plan.marketId,

    circleWalletId: 'circle-wallet-1',

    walletAddress: plan.walletAddress,

    network: plan.network,

    action: 'BUY_YES',

    side: 'YES',

    amountUsdc: 5,

    amountAtomic: '5000000',

    approvalTransactionId: 'approval-1',

    tradeTransactionId: 'trade-1',

    tradeTransactionHash: '0xabc',

    status: 'confirmed',

    attempts: 2,

    submittedAt: new Date().toISOString(),

    confirmedAt: new Date().toISOString(),
  };

  it('executes and persists a receipt', async () => {
    const executor = {
      execute: jest.fn().mockResolvedValue(receipt),
    };

    const maybeSingle = jest.fn().mockResolvedValue({
      data: null,
      error: null,
    });

    const receiptSingle = jest.fn().mockResolvedValue({
      data: {
        id: receipt.id,

        execution_plan_id: receipt.executionPlanId,

        run_id: receipt.runId,

        agent_id: receipt.agentId,

        profile_id: receipt.profileId,

        market_id: receipt.marketId,

        circle_wallet_id: receipt.circleWalletId,

        wallet_address: receipt.walletAddress,

        network: receipt.network,

        action: receipt.action,

        side: receipt.side,

        amount_usdc: receipt.amountUsdc,

        amount_atomic: receipt.amountAtomic,

        approval_transaction_id: receipt.approvalTransactionId,

        trade_transaction_id: receipt.tradeTransactionId,

        trade_transaction_hash: receipt.tradeTransactionHash,

        status: receipt.status,

        attempts: receipt.attempts,

        submitted_at: receipt.submittedAt,

        confirmed_at: receipt.confirmedAt,

        metadata: {},
      },

      error: null,
    });

    const from = jest.fn((table: string) => {
      if (table === 'agent_wallets') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: 'wallet-row-1',

                  circle_wallet_id: 'circle-wallet-1',
                },

                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'execution_receipts') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle,
            }),
          }),

          upsert: () => ({
            select: () => ({
              single: receiptSingle,
            }),
          }),
        };
      }

      return {
        insert: jest.fn().mockResolvedValue({
          error: null,
        }),
      };
    });

    const service = new ExecutionService(
      executor as never,

      {
        db: {
          from,
        },
      } as never,
    );

    const result = await service.executePlan({
      plan,

      agentWalletId: 'wallet-row-1',

      marketAddress: '0x2222222222222222222222222222222222222222',
    });

    expect(executor.execute).toHaveBeenCalledTimes(1);

    expect(result.status).toBe('confirmed');
  });
});
