import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { randomUUID } from 'node:crypto';

import Anthropic from '@anthropic-ai/sdk';

import { createPublicClient, http } from 'viem';

import { getAgentProfile, runAgentRuntime } from 'bruh-agent';

import type {
  AgentMarket,
  AgentProviders,
  AgentRuntimeResult,
  ExecutionPlan,
} from 'bruh-agent';

import { SupabaseService } from '../supabase.service';

import { ExecutionQueueService } from '../execution/execution-queue.service';

import { ConsensusService, type ConsensusResult } from './consensus.service';

interface EstimatePromptInput {
  market: {
    question: string;

    description?: string;
  };

  marketProbability: number;

  research: {
    summary: string;

    evidence: unknown[];
  };

  instructions: string;
}

const MARKET_ABI = [
  {
    name: 'summary',
    type: 'function',
    inputs: [],
    outputs: [
      {
        name: 'question',
        type: 'string',
      },
      {
        name: 'closeTime',
        type: 'uint256',
      },
      {
        name: 'currentOutcome',
        type: 'uint8',
      },
      {
        name: 'yesPriceWad',
        type: 'uint256',
      },
      {
        name: 'noPriceWad',
        type: 'uint256',
      },
      {
        name: 'totalCollateral',
        type: 'uint256',
      },
      {
        name: 'yesShares',
        type: 'uint256',
      },
      {
        name: 'noShares',
        type: 'uint256',
      },
      {
        name: 'open',
        type: 'bool',
      },
      {
        name: 'resolved',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
  },
] as const;

interface AgentWalletRecord {
  id: string;

  user_address: string;

  agent_id?: string | null;

  agent_name?: string | null;

  strategy: string;

  circle_wallet_id: string;

  circle_wallet_address?: string | null;

  edge_threshold?: number | null;

  kelly_fraction?: number | null;

  max_position_usdc?: number | null;

  status?: string | null;
}

export interface RunAgentResult {
  walletId: string;

  runs: Array<{
    runId: string;

    profileId: string;

    status: string;

    executionPlan?: ExecutionPlan;
  }>;

  consensus?: ConsensusResult;
}

@Injectable()
export class AgentRuntimeService {
  private readonly publicClient = createPublicClient({
    transport: http(process.env.ARC_RPC_URL ?? 'https://rpc.testnet.arc.io'),
  });

  private readonly anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  constructor(
    private readonly supabase: SupabaseService,

    private readonly executionQueue: ExecutionQueueService,

    private readonly consensus: ConsensusService,
  ) {}

  async run(input: {
    walletId: string;
    userAddress: string;
    marketAddress: `0x${string}`;
    autoExecute?: boolean;
  }): Promise<RunAgentResult> {
    try {
      validateAddress(input.marketAddress, 'marketAddress');

      const wallet = await this.getOwnedWallet(
        input.walletId,
        input.userAddress,
      );

      const market = await this.loadMarket(input.marketAddress);

      const profileIds = resolveProfileIds(wallet.strategy);

      const profileOutputs = await Promise.all(
        profileIds.map(async (profileId) =>
          this.runProfile({
            wallet,

            market,

            marketAddress: input.marketAddress,

            profileId,
          }),
        ),
      );

      const publicRuns = profileOutputs.map(({ runtimeResult, ...run }) => run);

      let consensus: ConsensusResult | undefined;

      if (profileOutputs.length > 1) {
        consensus = this.consensus.build({
          agentId: wallet.agent_id ?? wallet.id,

          ...(wallet.circle_wallet_address
            ? {
                walletAddress: wallet.circle_wallet_address,
              }
            : {}),

          network: 'eip155:5042002',

          marketId: market.id,

          marketQuestion: market.question,

          marketAddress: input.marketAddress,

          edgeThreshold: wallet.edge_threshold ?? 0.05,

          results: profileOutputs.map((output) => output.runtimeResult),

          expiresInSeconds: 300,
        });

        await this.persistConsensusRun({
          wallet,

          market,

          marketAddress: input.marketAddress,

          consensus,
        });

        if (
          input.autoExecute &&
          consensus.executionPlan.execution.allowExecution &&
          !consensus.executionPlan.execution.dryRun
        ) {
          await this.executionQueue.enqueue({
            runId: consensus.id,

            walletId: wallet.id,

            marketAddress: input.marketAddress,

            plan: consensus.executionPlan,
          });
        }
      }

      /*
       * Single-profile wallets execute their own final plan.
       */
      if (profileOutputs.length === 1 && input.autoExecute) {
        const only = profileOutputs[0];

        if (
          only.executionPlan?.execution.allowExecution &&
          !only.executionPlan.execution.dryRun
        ) {
          await this.executionQueue.enqueue({
            runId: only.runId,

            walletId: wallet.id,

            marketAddress: input.marketAddress,

            plan: only.executionPlan,
          });
        }
      }
      return {
        walletId: wallet.id,

        runs: publicRuns,

        ...(consensus
          ? {
              consensus,
            }
          : {}),
      };
    } catch (error) {
      console.error('Agent runtime failed:', error);

      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Unknown agent runtime error.',
      );
    }
  }

  private async persistConsensusRun(input: {
    wallet: AgentWalletRecord;

    market: AgentMarket;

    marketAddress: string;

    consensus: ConsensusResult;
  }): Promise<void> {
    const now = new Date().toISOString();

    const { error } = await this.supabase.db.from('agent_runs').insert({
      id: input.consensus.id,

      agent_wallet_id: input.wallet.id,

      agent_id: input.wallet.agent_id ?? null,

      profile_id: 'ensemble',

      profile_version: '1.0.0',

      market_id: input.market.id,

      market_address: input.marketAddress,

      market_question: input.market.question,

      status: input.consensus.executionPlan.execution.allowExecution
        ? 'planned'
        : 'passed',

      research: {
        summary: `Consensus created from ${input.consensus.members.length} profiles.`,

        members: input.consensus.members,
      },

      estimate: {
        probability: input.consensus.probability,

        confidence: input.consensus.confidence,

        reasoning: input.consensus.reasoning,
      },

      decision: {
        action: input.consensus.action,

        probability: input.consensus.probability,

        marketProbability: input.consensus.marketProbability,

        edge: input.consensus.edge,

        confidence: input.consensus.confidence,

        amountUsdc: input.consensus.amountUsdc,

        reasoning: input.consensus.reasoning,

        agreement: input.consensus.agreement,
      },

      execution_plan: input.consensus.executionPlan,

      started_at: now,

      completed_at: now,

      metadata: {
        consensus: true,

        memberRunIds: input.consensus.members.map((member) => member.runId),
      },
    });

    if (error) {
      throw new Error(`Failed to persist consensus run: ${error.message}`);
    }
  }

  async getRuns(input: {
    walletId: string;

    userAddress: string;

    limit?: number;
  }) {
    await this.getOwnedWallet(input.walletId, input.userAddress);

    const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);

    const { data, error } = await this.supabase.db
      .from('agent_runs')
      .select('*')
      .eq('agent_wallet_id', input.walletId)
      .order('created_at', {
        ascending: false,
      })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to load agent runs: ${error.message}`);
    }

    return data ?? [];
  }

  async getRun(input: {
    runId: string;

    userAddress: string;
  }) {
    const { data, error } = await this.supabase.db
      .from('agent_runs')
      .select(
        `
                    *,
                    agent_wallets!inner(user_address)
                    `,
      )
      .eq('id', input.runId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Agent run was not found.');
    }

    if (
      normalizeAddress(data.agent_wallets.user_address) !==
      normalizeAddress(input.userAddress)
    ) {
      throw new ForbiddenException('You do not own this agent run.');
    }

    return data;
  }

  private async runProfile(input: {
    wallet: AgentWalletRecord;

    market: AgentMarket;

    marketAddress: `0x${string}`;

    profileId: string;
  }): Promise<{
    runId: string;

    profileId: string;

    status: string;

    executionPlan?: ExecutionPlan;

    runtimeResult: AgentRuntimeResult;
  }> {
    const profile = getAgentProfile(input.profileId);

    const runId = randomUUID();

    const startedAt = new Date().toISOString();

    await this.insertInitialRun({
      runId,
      wallet: input.wallet,
      profileId: profile.id,
      profileVersion: profile.version,
      market: input.market,
      marketAddress: input.marketAddress,
      startedAt,
    });

    let result: AgentRuntimeResult;

    try {
      result = await runAgentRuntime({
        runId,

        agentId: input.wallet.agent_id ?? input.wallet.id,

        profile,

        market: input.market,

        providers: this.createProviders(),

        walletAddress: input.wallet.circle_wallet_address ?? undefined,

        network: 'eip155:5042002',

        executionPlanExpiresInSeconds: 300,

        config: {
          ...profile.defaults,

          edgeThreshold:
            input.wallet.edge_threshold ?? profile.defaults.edgeThreshold,

          kellyFraction:
            input.wallet.kelly_fraction ?? profile.defaults.kellyFraction,

          maxPositionUsdc:
            input.wallet.max_position_usdc ?? profile.defaults.maxPositionUsdc,

          availableBalanceUsdc:
            input.wallet.max_position_usdc ?? profile.defaults.maxPositionUsdc,

          currentMarketExposureUsdc: 0,

          dailyProfitLossUsdc: 0,

          allowTrading: true,

          dryRun: false,
        },

        metadata: {
          agentWalletId: input.wallet.id,

          marketAddress: input.marketAddress,

          requestedBy: input.wallet.user_address,
        },
      });
    } catch (error) {
      await this.markRunFailed(runId, error);

      throw error;
    }

    const runStatus = resolveRunStatus(result);

    await this.persistRuntimeResult({
      runId,
      result,
      status: runStatus,
    });

    return {
      runId,

      profileId: profile.id,

      status: runStatus,

      ...(result.executionPlan
        ? {
            executionPlan: result.executionPlan,
          }
        : {}),

      runtimeResult: result,
    };
  }

  /**
   * Temporary backend provider bridge.
   *
   * Replace the research methods with your actual Tavily,
   * Supabase and Dune adapters when those environment
   * integrations are enabled.
   */
  private createProviders(): AgentProviders {
    return {
      news: {
        async search(input) {
          return {
            provider: 'backend-news-bridge',

            summary: `No external news adapter was enabled. Analysing available market context for "${input.query}".`,

            costUsdc: 0,

            items: [],
          };
        },
      },

      historical: {
        async analyze(input) {
          return {
            provider: 'backend-historical-bridge',

            summary: `No historical comparator was enabled for "${input.question}".`,

            baseRate: 0.5,

            sampleSize: 0,

            confidenceInterval: {
              lower: 0,
              upper: 1,
            },

            costUsdc: 0,

            comparables: [],
          };
        },
      },

      onchain: {
        async analyze(input) {
          return {
            provider: 'backend-onchain-bridge',

            summary: `No onchain adapter was enabled for "${input.question}".`,

            costUsdc: 0,

            netExchangeFlowUsd: 0,

            netBridgeFlowUsd: 0,

            accumulationScore: 0.5,

            signals: [],
          };
        },
      },

      llm: {
        estimate: async (input) => {
          const response = await this.anthropic.messages.create({
            model: 'claude-sonnet-4-6',

            max_tokens: 700,

            system: input.systemPrompt,

            messages: [
              {
                role: 'user',

                content: buildEstimatePrompt(input),
              },
            ],
          });

          const text =
            response.content[0]?.type === 'text'
              ? response.content[0].text
              : '';

          return parseEstimate(text, input.marketProbability);
        },
      },
    };
  }

  private async loadMarket(marketAddress: `0x${string}`): Promise<AgentMarket> {
    console.log('Reading market:', marketAddress);
    console.log('RPC:', process.env.ARC_RPC_URL);

    try {
      const result = await this.publicClient.readContract({
        address: marketAddress,
        abi: MARKET_ABI,
        functionName: 'summary',
      });

      console.log('Market summary result:', result);

      const [
        question,
        closeTime,
        currentOutcome,
        yesPriceWad,
        noPriceWad,
        totalCollateral,
        yesShares,
        noShares,
        open,
        resolved,
      ] = result;

      if (!open || resolved) {
        throw new BadRequestException({
          message: 'Market is not currently open.',

          marketAddress,

          open,

          resolved,
        });
      }

      return {
        id: marketAddress,

        question,

        description: question,

        categories: ['prediction-market'],

        resolutionCriteria:
          'Resolves according to the deployed market contract.',

        yesPrice: Number(yesPriceWad) / 1e18,

        noPrice: Number(noPriceWad) / 1e18,

        liquidityUsdc: Number(totalCollateral) / 1e6,

        volumeUsdc: 0,

        closesAt: new Date(Number(closeTime) * 1_000).toISOString(),

        metadata: {
          contractAddress: marketAddress,

          currentOutcome: Number(currentOutcome),

          yesShares: yesShares.toString(),

          noShares: noShares.toString(),

          open,

          resolved,
        },
      };
    } catch (error) {
      console.error('Market read failed:', error);

      throw error;
    }
  }

  private async getOwnedWallet(
    walletId: string,
    userAddress: string,
  ): Promise<AgentWalletRecord> {
    const { data, error } = await this.supabase.db
      .from('agent_wallets')
      .select('*')
      .eq('id', walletId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Agent wallet was not found.');
    }

    if (normalizeAddress(data.user_address) !== normalizeAddress(userAddress)) {
      throw new ForbiddenException('You do not own this agent wallet.');
    }

    return data as AgentWalletRecord;
  }

  private async insertInitialRun(input: {
    runId: string;

    wallet: AgentWalletRecord;

    profileId: string;

    profileVersion: string;

    market: AgentMarket;

    marketAddress: string;

    startedAt: string;
  }): Promise<void> {
    const { error } = await this.supabase.db.from('agent_runs').insert({
      id: input.runId,

      agent_wallet_id: input.wallet.id,

      agent_id: input.wallet.agent_id ?? null,

      profile_id: input.profileId,

      profile_version: input.profileVersion,

      market_id: input.market.id,

      market_address: input.marketAddress,

      market_question: input.market.question,

      status: 'running',

      started_at: input.startedAt,

      metadata: {},
    });

    if (error) {
      throw new Error(`Failed to create agent run: ${error.message}`);
    }
  }

  private async persistRuntimeResult(input: {
    runId: string;

    result: AgentRuntimeResult;

    status: string;
  }): Promise<void> {
    const { error } = await this.supabase.db
      .from('agent_runs')
      .update({
        status: input.status,

        research: input.result.research ?? null,

        estimate: input.result.estimate ?? null,

        decision: input.result.decision ?? null,

        execution_plan: input.result.executionPlan ?? null,

        error_message: input.result.error?.message ?? null,

        completed_at: input.result.completedAt,

        metadata: input.result.metadata ?? {},

        updated_at: new Date().toISOString(),
      })
      .eq('id', input.runId);

    if (error) {
      throw new Error(`Failed to persist agent run: ${error.message}`);
    }
  }

  private async markRunFailed(runId: string, error: unknown): Promise<void> {
    await this.supabase.db
      .from('agent_runs')
      .update({
        status: 'failed',

        error_message:
          error instanceof Error ? error.message : 'Unknown runtime error.',

        completed_at: new Date().toISOString(),

        updated_at: new Date().toISOString(),
      })
      .eq('id', runId);
  }
}

function resolveProfileIds(strategy: string): string[] {
  if (strategy === 'both') {
    return ['newshound', 'actuary'];
  }

  if (strategy === 'whale-hunter') {
    return ['whale-hunter'];
  }

  return [strategy || 'newshound'];
}

function resolveRunStatus(result: AgentRuntimeResult): string {
  if (result.status === 'failed') {
    return 'failed';
  }

  if (!result.executionPlan || result.executionPlan.action === 'PASS') {
    return 'passed';
  }

  return 'planned';
}

function validateAddress(
  address: string,
  field: string,
): asserts address is `0x${string}` {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new BadRequestException(`${field} must be a valid EVM address.`);
  }
}

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

function buildEstimatePrompt(input: EstimatePromptInput): string {
  return `
Market:
${input.market.question}

Description:
${input.market.description ?? 'N/A'}

Current market probability:
${input.marketProbability}

Research summary:
${input.research.summary}

Evidence:
${JSON.stringify(input.research.evidence)}

Instructions:
${input.instructions}

Return only valid JSON:

{
  "probability": 0.0,
  "confidence": 0.0,
  "reasoning": "Detailed reasoning",
  "keyFactors": ["factor"],
  "risks": ["risk"],
  "recommendedAction": "BUY_YES"
}
`.trim();
}

function parseEstimate(raw: string, marketProbability: number) {
  const cleaned = raw.replace(/```json|```/g, '').trim();

  const parsed = JSON.parse(cleaned);

  const probability = clampProbability(Number(parsed.probability));

  const confidence = clampProbability(Number(parsed.confidence));

  return {
    probability,

    confidence,

    reasoning: String(parsed.reasoning ?? 'No reasoning supplied.'),

    keyFactors: Array.isArray(parsed.keyFactors)
      ? parsed.keyFactors.map(String)
      : [],

    risks: Array.isArray(parsed.risks) ? parsed.risks.map(String) : [],

    recommendedAction:
      parsed.recommendedAction === 'BUY_NO' ||
      parsed.recommendedAction === 'PASS'
        ? parsed.recommendedAction
        : probability > marketProbability
          ? 'BUY_YES'
          : 'BUY_NO',
  } as const;
}

function clampProbability(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.5;
  }

  return Math.min(Math.max(value, 0), 1);
}
