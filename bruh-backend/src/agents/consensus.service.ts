import { Injectable } from '@nestjs/common';

import { randomUUID } from 'node:crypto';

import type { AgentRuntimeResult, ExecutionPlan } from 'bruh-agent';

export interface ConsensusMember {
  runId: string;

  profileId: string;

  action: 'BUY_YES' | 'BUY_NO' | 'PASS';

  probability: number;

  confidence: number;

  edge: number;

  amountUsdc: number;

  reasoning: string;
}

export interface ConsensusResult {
  id: string;

  action: 'BUY_YES' | 'BUY_NO' | 'PASS';

  probability: number;

  marketProbability: number;

  edge: number;

  confidence: number;

  amountUsdc: number;

  reasoning: string;

  agreement: 'unanimous' | 'partial' | 'conflicted' | 'none';

  members: ConsensusMember[];

  executionPlan: ExecutionPlan;
}

export interface BuildConsensusInput {
  agentId: string;

  walletAddress?: string;

  network: string;

  marketId: string;

  marketQuestion: string;

  marketAddress: `0x${string}`;

  edgeThreshold: number;

  results: AgentRuntimeResult[];

  expiresInSeconds?: number;
}

@Injectable()
export class ConsensusService {
  build(input: BuildConsensusInput): ConsensusResult {
    const usable = input.results.filter(
      (
        result,
      ): result is AgentRuntimeResult & {
        decision: NonNullable<AgentRuntimeResult['decision']>;

        executionPlan: ExecutionPlan;
      } => Boolean(result.decision && result.executionPlan),
    );

    if (usable.length === 0) {
      throw new Error(
        'Consensus requires at least one completed profile result.',
      );
    }

    const members: ConsensusMember[] = usable.map((result) => ({
      runId: result.runId,

      profileId: result.profileId,

      action: result.decision.action,

      probability: result.decision.probability,

      confidence: result.decision.confidence,

      edge: result.decision.edge,

      amountUsdc: result.decision.amountUsdc,

      reasoning: result.decision.reasoning,
    }));

    const marketProbability = usable[0].decision.marketProbability;

    const probability = weightedAverage(
      members.map((member) => ({
        value: member.probability,

        weight: Math.max(member.confidence, 0.01),
      })),
    );

    const confidence = weightedAverage(
      members.map((member) => ({
        value: member.confidence,

        weight: Math.max(member.confidence, 0.01),
      })),
    );

    const edge = probability - marketProbability;

    const yesMembers = members.filter((member) => member.action === 'BUY_YES');

    const noMembers = members.filter((member) => member.action === 'BUY_NO');

    const passMembers = members.filter((member) => member.action === 'PASS');

    const { action, agreement } = resolveConsensusAction({
      yesCount: yesMembers.length,

      noCount: noMembers.length,

      passCount: passMembers.length,

      total: members.length,

      edge,

      edgeThreshold: input.edgeThreshold,

      confidence,
    });

    const side =
      action === 'BUY_YES' ? 'YES' : action === 'BUY_NO' ? 'NO' : null;

    const activeMembers = members.filter(
      (member) => member.action === action && member.amountUsdc > 0,
    );

    const amountUsdc =
      action === 'PASS' || activeMembers.length === 0
        ? 0
        : Math.min(...activeMembers.map((member) => member.amountUsdc));

    const allowExecution =
      action !== 'PASS' &&
      amountUsdc > 0 &&
      Math.abs(edge) >= input.edgeThreshold;

    const now = new Date();

    const expiresAt = new Date(
      now.getTime() + (input.expiresInSeconds ?? 300) * 1_000,
    );

    const consensusId = randomUUID();

    const reasoning = buildConsensusReasoning({
      action,
      agreement,
      members,
      probability,
      marketProbability,
      edge,
      confidence,
    });

    const riskChecks = usable.flatMap((result) => result.decision.riskChecks);

    const allChecksPassed = riskChecks.every((check) => check.passed);

    const finalAllowExecution = allowExecution && allChecksPassed;

    const executionPlan: ExecutionPlan = {
      id: consensusId,

      runId: consensusId,

      agentId: input.agentId,

      profileId: 'ensemble',

      profileVersion: '1.0.0',

      marketId: input.marketId,

      marketQuestion: input.marketQuestion,

      network: input.network,

      ...(input.walletAddress
        ? {
            walletAddress: input.walletAddress,
          }
        : {}),

      action,

      side,

      status: finalAllowExecution ? 'ready' : 'skipped',

      amountUsdc,

      researchCostUsdc: usable.reduce(
        (total, result) => total + (result.research?.costUsdc ?? 0),
        0,
      ),

      estimatedProbability: probability,

      marketProbability,

      edge,

      confidence,

      expectedReturnUsdc: calculateExpectedReturn({
        action,
        amountUsdc,
        marketProbability,
      }),

      expectedProfitUsdc: calculateExpectedProfit({
        action,
        amountUsdc,
        probability,
        marketProbability,
      }),

      riskLevel: finalAllowExecution ? 'medium' : 'blocked',

      reasoning,

      keyFactors: members.map(
        (member) =>
          `${member.profileId}: ${member.action} at ${(member.probability * 100).toFixed(1)}%`,
      ),

      risks: [
        ...(agreement === 'conflicted'
          ? ['Profiles produced conflicting directional recommendations.']
          : []),

        ...(confidence < 0.5 ? ['Consensus confidence is below 50%.'] : []),
      ],

      research: {
        summary: `Consensus generated from ${members.length} profiles.`,

        sourceCount: members.length,

        sources: [],

        costUsdc: usable.reduce(
          (total, result) => total + (result.research?.costUsdc ?? 0),
          0,
        ),
      },

      riskChecks,

      execution: {
        requiresApproval: true,

        allowExecution: finalAllowExecution,

        dryRun: false,

        expectedContract: input.marketAddress,

        slippageBps: 100,

        deadline: expiresAt.toISOString(),
      },

      createdAt: now.toISOString(),

      expiresAt: expiresAt.toISOString(),

      metadata: {
        consensus: {
          agreement,

          memberRunIds: members.map((member) => member.runId),

          memberProfiles: members.map((member) => member.profileId),
        },
      },
    };

    return {
      id: consensusId,

      action,

      probability,

      marketProbability,

      edge,

      confidence,

      amountUsdc,

      reasoning,

      agreement,

      members,

      executionPlan,
    };
  }
}

function resolveConsensusAction(input: {
  yesCount: number;

  noCount: number;

  passCount: number;

  total: number;

  edge: number;

  edgeThreshold: number;

  confidence: number;
}): {
  action: 'BUY_YES' | 'BUY_NO' | 'PASS';

  agreement: 'unanimous' | 'partial' | 'conflicted' | 'none';
} {
  if (input.yesCount > 0 && input.noCount > 0) {
    return {
      action: 'PASS',
      agreement: 'conflicted',
    };
  }

  if (input.yesCount === 0 && input.noCount === 0) {
    return {
      action: 'PASS',
      agreement: 'none',
    };
  }

  const proposedAction = input.yesCount > 0 ? 'BUY_YES' : 'BUY_NO';

  const directionalCount = input.yesCount + input.noCount;

  const unanimous = directionalCount === input.total;

  const strongPartial =
    directionalCount >= Math.ceil(input.total / 2) &&
    input.confidence >= 0.7 &&
    Math.abs(input.edge) >= input.edgeThreshold * 2;

  if (Math.abs(input.edge) < input.edgeThreshold) {
    return {
      action: 'PASS',
      agreement: unanimous ? 'unanimous' : 'partial',
    };
  }

  if (!unanimous && !strongPartial) {
    return {
      action: 'PASS',
      agreement: 'partial',
    };
  }

  return {
    action: proposedAction,

    agreement: unanimous ? 'unanimous' : 'partial',
  };
}

function weightedAverage(
  values: Array<{
    value: number;
    weight: number;
  }>,
): number {
  const totalWeight = values.reduce((total, item) => total + item.weight, 0);

  if (totalWeight <= 0) {
    return 0;
  }

  return (
    values.reduce((total, item) => total + item.value * item.weight, 0) /
    totalWeight
  );
}

function buildConsensusReasoning(input: {
  action: string;

  agreement: string;

  members: ConsensusMember[];

  probability: number;

  marketProbability: number;

  edge: number;

  confidence: number;
}): string {
  const summaries = input.members
    .map(
      (member) =>
        `${member.profileId} recommended ${member.action} with ${(member.confidence * 100).toFixed(1)}% confidence and ${(member.edge * 100).toFixed(2)}% edge.`,
    )
    .join(' ');

  return [
    `Consensus result: ${input.action}.`,

    `Agreement level: ${input.agreement}.`,

    `Combined probability: ${(input.probability * 100).toFixed(2)}%.`,

    `Market probability: ${(input.marketProbability * 100).toFixed(2)}%.`,

    `Combined edge: ${(input.edge * 100).toFixed(2)}%.`,

    `Combined confidence: ${(input.confidence * 100).toFixed(2)}%.`,

    summaries,
  ].join(' ');
}

function calculateExpectedReturn(input: {
  action: 'BUY_YES' | 'BUY_NO' | 'PASS';

  amountUsdc: number;

  marketProbability: number;
}): number {
  if (input.action === 'PASS' || input.amountUsdc <= 0) {
    return 0;
  }

  const price =
    input.action === 'BUY_YES'
      ? input.marketProbability
      : 1 - input.marketProbability;

  if (price <= 0 || price >= 1) {
    return 0;
  }

  return Number((input.amountUsdc / price).toFixed(6));
}

function calculateExpectedProfit(input: {
  action: 'BUY_YES' | 'BUY_NO' | 'PASS';

  amountUsdc: number;

  probability: number;

  marketProbability: number;
}): number {
  if (input.action === 'PASS' || input.amountUsdc <= 0) {
    return 0;
  }

  const contractPrice =
    input.action === 'BUY_YES'
      ? input.marketProbability
      : 1 - input.marketProbability;

  const winProbability =
    input.action === 'BUY_YES' ? input.probability : 1 - input.probability;

  if (contractPrice <= 0 || contractPrice >= 1) {
    return 0;
  }

  const shares = input.amountUsdc / contractPrice;

  const expectedValue = shares * winProbability;

  return Number((expectedValue - input.amountUsdc).toFixed(6));
}
