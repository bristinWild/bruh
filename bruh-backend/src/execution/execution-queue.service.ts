import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { randomUUID } from 'node:crypto';

import type { ExecutionPlan } from '@bruhmarket/agent-sdk/runtime';

import { SupabaseService } from '../supabase.service';

import { ExecutionService } from './execution.service';

interface ExecutionJobRecord {
  id: string;

  run_id: string;

  agent_wallet_id: string;

  execution_plan_id: string;

  market_address: string;

  status: string;

  attempts: number;
}

@Injectable()
export class ExecutionQueueService implements OnModuleInit {
  private readonly logger = new Logger(ExecutionQueueService.name);

  private processing = false;

  constructor(
    private readonly supabase: SupabaseService,

    private readonly execution: ExecutionService,
  ) { }

  async onModuleInit() {
    /**
     * Resume jobs that were left pending
     * when the server restarted.
     */
    setTimeout(() => {
      void this.drain();
    }, 1_000);
  }

  async enqueue(input: {
    runId: string;

    walletId: string;

    marketAddress: `0x${string}`;

    plan: ExecutionPlan;
  }): Promise<{
    jobId: string;
    status: string;
  }> {
    const existing = await this.findByPlanId(input.plan.id);

    if (existing) {
      return {
        jobId: existing.id,
        status: existing.status,
      };
    }

    const jobId = randomUUID();

    const { error } = await this.supabase.db.from('execution_jobs').insert({
      id: jobId,

      run_id: input.runId,

      agent_wallet_id: input.walletId,

      execution_plan_id: input.plan.id,

      market_address: input.marketAddress,

      status: 'pending',

      attempts: 0,
    });

    if (error) {
      throw new Error(`Failed to queue execution: ${error.message}`);
    }

    await this.supabase.db
      .from('agent_runs')
      .update({
        status: 'execution_queued',

        updated_at: new Date().toISOString(),
      })
      .eq('id', input.runId);

    void this.drain();

    return {
      jobId,
      status: 'pending',
    };
  }

  async drain(): Promise<void> {
    if (this.processing) {
      return;
    }

    this.processing = true;

    try {
      while (true) {
        const job = await this.claimNextJob();

        if (!job) {
          break;
        }

        await this.processJob(job);
      }
    } finally {
      this.processing = false;
    }
  }

  private async claimNextJob(): Promise<ExecutionJobRecord | null> {
    const { data, error } = await this.supabase.db
      .from('execution_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', {
        ascending: true,
      })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to read execution queue: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    const { data: claimed, error: claimError } = await this.supabase.db
      .from('execution_jobs')
      .update({
        status: 'processing',

        started_at: new Date().toISOString(),

        attempts: data.attempts + 1,

        updated_at: new Date().toISOString(),
      })
      .eq('id', data.id)
      .eq('status', 'pending')
      .select('*')
      .maybeSingle();

    if (claimError || !claimed) {
      return null;
    }

    return claimed as ExecutionJobRecord;
  }

  private async processJob(job: ExecutionJobRecord): Promise<void> {
    try {
      await this.supabase.db
        .from('agent_runs')
        .update({
          status: 'executing',

          updated_at: new Date().toISOString(),
        })
        .eq('id', job.run_id);

      const run = await this.getRun(job.run_id);

      const plan = run.execution_plan as ExecutionPlan;

      const receipt = await this.execution.executePlan({
        plan,

        agentWalletId: job.agent_wallet_id,

        marketAddress: job.market_address as `0x${string}`,
      });

      const successful = receipt.status === 'confirmed';

      await this.supabase.db
        .from('execution_jobs')
        .update({
          status: successful ? 'completed' : 'failed',

          error_message: receipt.errorMessage ?? null,

          completed_at: new Date().toISOString(),

          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      await this.supabase.db
        .from('agent_runs')
        .update({
          status: successful ? 'executed' : 'execution_failed',

          execution_receipt_id: receipt.id,

          error_message: receipt.errorMessage ?? null,

          updated_at: new Date().toISOString(),
        })
        .eq('id', job.run_id);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown queue execution error.';

      this.logger.error(`Execution job ${job.id} failed: ${message}`);

      await this.supabase.db
        .from('execution_jobs')
        .update({
          status: 'failed',

          error_message: message,

          completed_at: new Date().toISOString(),

          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      await this.supabase.db
        .from('agent_runs')
        .update({
          status: 'execution_failed',

          error_message: message,

          updated_at: new Date().toISOString(),
        })
        .eq('id', job.run_id);
    }
  }

  private async getRun(runId: string) {
    const { data, error } = await this.supabase.db
      .from('agent_runs')
      .select('*')
      .eq('id', runId)
      .single();

    if (error || !data) {
      throw new Error(`Agent run ${runId} was not found.`);
    }

    if (!data.execution_plan) {
      throw new Error(`Agent run ${runId} has no execution plan.`);
    }

    return data;
  }

  private async findByPlanId(
    executionPlanId: string,
  ): Promise<ExecutionJobRecord | null> {
    const { data, error } = await this.supabase.db
      .from('execution_jobs')
      .select('*')
      .eq('execution_plan_id', executionPlanId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to check execution queue: ${error.message}`);
    }

    return data as ExecutionJobRecord | null;
  }
}
