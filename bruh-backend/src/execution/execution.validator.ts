import { BadRequestException } from '@nestjs/common';

import type { ExecutionPlan } from 'bruh-agent';

export function validateExecutionPlan(plan: ExecutionPlan): void {
  if (!plan) {
    throw new BadRequestException('Execution plan is required.');
  }

  if (plan.action === 'PASS' || plan.side === null) {
    throw new BadRequestException('PASS execution plans cannot be executed.');
  }

  if (!Number.isFinite(plan.amountUsdc) || plan.amountUsdc <= 0) {
    throw new BadRequestException(
      'Execution amount must be greater than zero.',
    );
  }

  if (!plan.execution) {
    throw new BadRequestException('Execution policy is missing from the plan.');
  }

  if (!plan.execution.allowExecution) {
    throw new BadRequestException('Execution plan does not permit execution.');
  }

  if (plan.execution.dryRun) {
    throw new BadRequestException(
      'Dry-run execution plans cannot be submitted.',
    );
  }

  const deadline = Date.parse(plan.execution.deadline);

  if (!Number.isFinite(deadline)) {
    throw new BadRequestException(
      'Execution plan contains an invalid deadline.',
    );
  }

  if (deadline <= Date.now()) {
    throw new BadRequestException('Execution plan has expired.');
  }

  const failedRiskChecks = plan.riskChecks.filter((check) => !check.passed);

  if (failedRiskChecks.length > 0) {
    throw new BadRequestException({
      message: 'Execution plan contains failed risk checks.',

      failedRiskChecks: failedRiskChecks.map((check) => ({
        id: check.id,
        message: check.message,
      })),
    });
  }

  if (plan.action === 'BUY_YES' && plan.side !== 'YES') {
    throw new BadRequestException('BUY_YES plans must use the YES side.');
  }

  if (plan.action === 'BUY_NO' && plan.side !== 'NO') {
    throw new BadRequestException('BUY_NO plans must use the NO side.');
  }

  if (!plan.network?.trim()) {
    throw new BadRequestException('Execution plan requires a network.');
  }
}
