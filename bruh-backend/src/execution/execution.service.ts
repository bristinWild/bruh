import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ExecutionPlan } from '@bruhmarket/agent-sdk/runtime';
import { SupabaseService } from '../supabase.service';
import { CircleMarketExecutor } from './circle-market.executor';
import type { ExecutionReceipt } from './execution.types';

interface AgentWalletRecord {
  id: string;

  circle_wallet_id: string;

  wallet_address?: string | null;

  address?: string | null;
}

export interface ExecuteStoredPlanInput {
  plan: ExecutionPlan;

  /**
   * ID from the agent_wallets table, not the Circle wallet ID.
   */
  agentWalletId: string;

  marketAddress: `0x${string}`;

  usdcAddress?: `0x${string}`;

  minimumSharesOut?: bigint;
}

@Injectable()
export class ExecutionService {
  constructor(
    private readonly executor: CircleMarketExecutor,

    private readonly supabase: SupabaseService,
  ) { }

  async executePlan(input: ExecuteStoredPlanInput): Promise<ExecutionReceipt> {
    const existing = await this.getReceiptByPlanId(input.plan.id);

    if (existing) {
      if (existing.status === 'confirmed') {
        return existing;
      }

      if (existing.status === 'submitted') {
        throw new ConflictException(
          'This execution plan is already being processed.',
        );
      }
    }

    const wallet = await this.getAgentWallet(input.agentWalletId);

    const usdcAddress = input.usdcAddress ?? resolveUsdcAddress();

    const receipt = await this.executor.execute({
      plan: input.plan,

      circleWalletId: wallet.circle_wallet_id,

      marketAddress: input.marketAddress,

      usdcAddress,

      tokenDecimals: 6,

      minimumSharesOut: input.minimumSharesOut ?? 0n,
    });

    const persisted = await this.persistReceipt({
      receipt,

      agentWalletId: wallet.id,

      marketAddress: input.marketAddress,

      usdcAddress,
    });

    if (persisted.status === 'confirmed') {
      await this.persistConfirmedTrade({
        plan: input.plan,

        receipt: persisted,

        agentWalletId: wallet.id,

        marketAddress: input.marketAddress,
      });
    }

    return persisted;
  }

  async getReceiptByPlanId(
    executionPlanId: string,
  ): Promise<ExecutionReceipt | null> {
    const { data, error } = await this.supabase.db
      .from('execution_receipts')
      .select('*')
      .eq('execution_plan_id', executionPlanId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to read execution receipt: ${error.message}`);
    }

    return data ? mapReceiptRow(data) : null;
  }

  async getReceiptById(receiptId: string): Promise<ExecutionReceipt | null> {
    const { data, error } = await this.supabase.db
      .from('execution_receipts')
      .select('*')
      .eq('id', receiptId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to read execution receipt: ${error.message}`);
    }

    return data ? mapReceiptRow(data) : null;
  }

  async listWalletReceipts(
    agentWalletId: string,
    limit = 50,
  ): Promise<ExecutionReceipt[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 100);

    const { data, error } = await this.supabase.db
      .from('execution_receipts')
      .select('*')
      .eq('agent_wallet_id', agentWalletId)
      .order('created_at', {
        ascending: false,
      })
      .limit(safeLimit);

    if (error) {
      throw new Error(`Failed to list execution receipts: ${error.message}`);
    }

    return (data ?? []).map(mapReceiptRow);
  }

  private async getAgentWallet(walletId: string): Promise<AgentWalletRecord> {
    const { data, error } = await this.supabase.db
      .from('agent_wallets')
      .select('id, circle_wallet_id, wallet_address, address')
      .eq('id', walletId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Agent wallet was not found.');
    }

    if (!data.circle_wallet_id) {
      throw new NotFoundException(
        'Agent wallet does not have a Circle wallet ID.',
      );
    }

    return data as AgentWalletRecord;
  }

  private async persistReceipt(input: {
    receipt: ExecutionReceipt;

    agentWalletId: string;

    marketAddress: string;

    usdcAddress: string;
  }): Promise<ExecutionReceipt> {
    const receipt = input.receipt;

    const { data, error } = await this.supabase.db
      .from('execution_receipts')
      .upsert(
        {
          id: receipt.id,

          execution_plan_id: receipt.executionPlanId,

          run_id: receipt.runId,

          agent_wallet_id: input.agentWalletId,

          agent_id: receipt.agentId ?? null,

          profile_id: receipt.profileId,

          market_id: receipt.marketId,

          circle_wallet_id: receipt.circleWalletId,

          wallet_address: receipt.walletAddress ?? null,

          network: receipt.network,

          market_address: input.marketAddress,

          usdc_address: input.usdcAddress,

          action: receipt.action,

          side: receipt.side,

          amount_usdc: receipt.amountUsdc,

          amount_atomic: receipt.amountAtomic,

          approval_transaction_id: receipt.approvalTransactionId ?? null,

          approval_transaction_hash: receipt.approvalTransactionHash ?? null,

          trade_transaction_id: receipt.tradeTransactionId ?? null,

          trade_transaction_hash: receipt.tradeTransactionHash ?? null,

          status: receipt.status,

          attempts: receipt.attempts,

          submitted_at: receipt.submittedAt,

          confirmed_at: receipt.confirmedAt ?? null,

          failed_at: receipt.failedAt ?? null,

          error_code: receipt.errorCode ?? null,

          error_message: receipt.errorMessage ?? null,

          metadata: receipt.metadata ?? {},

          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'execution_plan_id',
        },
      )
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(
        `Failed to persist execution receipt: ${error?.message ?? 'No receipt was returned.'
        }`,
      );
    }

    return mapReceiptRow(data);
  }

  private async persistConfirmedTrade(input: {
    plan: ExecutionPlan;

    receipt: ExecutionReceipt;

    agentWalletId: string;

    marketAddress: string;
  }): Promise<void> {
    const { error } = await this.supabase.db.from('trades').insert({
      agent_wallet_id: input.agentWalletId,

      market_address: input.marketAddress,

      action: input.receipt.action,

      /**
       * Existing trades table currently stores
       * atomic USDC as a string.
       */
      usdc_amount: input.receipt.amountAtomic,

      tx_hash: input.receipt.tradeTransactionHash ?? null,

      reasoning_summary: input.plan.reasoning,

      edge: input.plan.edge,
    });

    if (error) {
      throw new Error(
        `Receipt was saved, but the trade record could not be created: ${error.message}`,
      );
    }
  }
}

function resolveUsdcAddress(): `0x${string}` {
  const value =
    process.env.ARC_USDC_ADDRESS ??
    '0x3600000000000000000000000000000000000000';

  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error('ARC_USDC_ADDRESS must be a valid EVM address.');
  }

  return value as `0x${string}`;
}

function mapReceiptRow(row: Record<string, any>): ExecutionReceipt {
  return {
    id: row.id,

    executionPlanId: row.execution_plan_id,

    runId: row.run_id,

    ...(row.agent_id
      ? {
        agentId: row.agent_id,
      }
      : {}),

    profileId: row.profile_id,

    marketId: row.market_id,

    circleWalletId: row.circle_wallet_id,

    ...(row.wallet_address
      ? {
        walletAddress: row.wallet_address,
      }
      : {}),

    network: row.network,

    action: row.action,

    side: row.side,

    amountUsdc: Number(row.amount_usdc),

    amountAtomic: String(row.amount_atomic),

    ...(row.approval_transaction_id
      ? {
        approvalTransactionId: row.approval_transaction_id,
      }
      : {}),

    ...(row.approval_transaction_hash
      ? {
        approvalTransactionHash: row.approval_transaction_hash,
      }
      : {}),

    ...(row.trade_transaction_id
      ? {
        tradeTransactionId: row.trade_transaction_id,
      }
      : {}),

    ...(row.trade_transaction_hash
      ? {
        tradeTransactionHash: row.trade_transaction_hash,
      }
      : {}),

    status: row.status,

    attempts: row.attempts,

    submittedAt: row.submitted_at,

    ...(row.confirmed_at
      ? {
        confirmedAt: row.confirmed_at,
      }
      : {}),

    ...(row.failed_at
      ? {
        failedAt: row.failed_at,
      }
      : {}),

    ...(row.error_code
      ? {
        errorCode: row.error_code,
      }
      : {}),

    ...(row.error_message
      ? {
        errorMessage: row.error_message,
      }
      : {}),

    metadata: row.metadata ?? {},
  };
}
