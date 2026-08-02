import type { ExecutionPlan } from 'bruh-agent';

export type ExecutionReceiptStatus =
  'submitted' | 'confirmed' | 'failed' | 'rejected' | 'expired';

export interface ExecutionReceipt {
  id: string;

  executionPlanId: string;

  runId: string;

  agentId?: string;

  profileId: string;

  marketId: string;

  circleWalletId: string;

  walletAddress?: string;

  network: string;

  action: 'BUY_YES' | 'BUY_NO';

  side: 'YES' | 'NO';

  amountUsdc: number;

  amountAtomic: string;

  approvalTransactionId?: string;

  approvalTransactionHash?: string;

  tradeTransactionId?: string;

  tradeTransactionHash?: string;

  status: ExecutionReceiptStatus;

  attempts: number;

  submittedAt: string;

  confirmedAt?: string;

  failedAt?: string;

  errorCode?: string;

  errorMessage?: string;

  metadata?: Record<string, unknown>;
}

export interface ExecutePlanInput {
  plan: ExecutionPlan;

  circleWalletId: string;

  marketAddress: `0x${string}`;

  usdcAddress: `0x${string}`;

  /**
   * USDC normally has six decimal places.
   */
  tokenDecimals?: number;

  /**
   * Minimum market shares accepted.
   *
   * Use zero for the current MVP only.
   */
  minimumSharesOut?: bigint;
}

export interface ExecutionAttemptContext {
  attempt: number;

  maximumAttempts: number;

  startedAt: string;
}

export interface ExecutionAdapter {
  readonly id: string;

  execute(input: ExecutePlanInput): Promise<ExecutionReceipt>;
}
