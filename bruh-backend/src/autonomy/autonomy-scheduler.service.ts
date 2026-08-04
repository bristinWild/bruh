import {
    Injectable,
    Logger,
} from "@nestjs/common";

import {
    Cron,
    CronExpression,
} from "@nestjs/schedule";

import {
    AgentRuntimeService,
} from "../agents/agent-runtime.service";

import {
    SupabaseService,
} from "../supabase.service";

import {
    AutonomyLockService,
} from "./autonomy-lock.service";

import {
    MarketDiscoveryService,
} from "./market-discovery.service";

import type {
    AutonomousAgentRecord,
    MarketCandidate,
} from "./autonomy.types";

@Injectable()
export class AutonomySchedulerService {
    private readonly logger =
        new Logger(
            AutonomySchedulerService.name,
        );

    constructor(
        private readonly supabase:
            SupabaseService,

        private readonly runtime:
            AgentRuntimeService,

        private readonly discovery:
            MarketDiscoveryService,

        private readonly lock:
            AutonomyLockService,
    ) { }

    @Cron(
        CronExpression.EVERY_MINUTE,
    )
    async tick(): Promise<void> {
        if (
            !this.lock.tryAcquire()
        ) {
            this.logger.warn(
                "Skipping autonomy tick because the previous tick is still running.",
            );

            return;
        }

        try {
            const agents =
                await this.loadDueAgents();

            for (const agent of agents) {
                await this.processAgent(
                    agent,
                );
            }
        } catch (error) {
            this.logger.error(
                error instanceof Error
                    ? error.stack
                    : String(error),
            );
        } finally {
            this.lock.release();
        }
    }

    private async loadDueAgents():
        Promise<
            AutonomousAgentRecord[]
        > {
        const {
            data,
            error,
        } =
            await this.supabase.db
                .from(
                    "agent_wallets",
                )
                .select("*")
                .eq(
                    "autonomous_enabled",
                    true,
                );

        if (error) {
            throw new Error(
                `Failed to load autonomous agents: ${error.message}`,
            );
        }

        const now =
            Date.now();

        return (
            data ?? []
        ).filter((agent) => {
            if (
                !agent.last_scheduled_run_at
            ) {
                return true;
            }

            const elapsedMinutes =
                (now -
                    new Date(
                        agent.last_scheduled_run_at,
                    ).getTime()) /
                60_000;

            return (
                elapsedMinutes >=
                agent.schedule_interval_minutes
            );
        }) as AutonomousAgentRecord[];
    }

    private async processAgent(
        agent:
            AutonomousAgentRecord,
    ): Promise<void> {
        this.logger.log(
            `Processing autonomous agent ${agent.id}`,
        );

        await this.markScheduled(
            agent.id,
        );

        const markets =
            await this.discovery
                .discoverOpenMarkets(
                    agent.market_scan_limit,
                );

        for (const market of markets) {
            const shouldRun =
                await this.claimMarket(
                    agent.id,
                    market,
                    agent.schedule_interval_minutes,
                );
            if (!shouldRun) {
                continue;
            }

            await this.processMarket({
                agent,
                market,
            });
        }
    }

    private async processMarket(input: {
        agent:
        AutonomousAgentRecord;

        market:
        MarketCandidate;
    }): Promise<void> {
        try {

            if (!input.agent.auto_research) {
                this.logger.log(
                    `Skipping ${input.agent.id}: auto research disabled.`,
                );
                return;
            }
            const response =
                await this.runtime.run({
                    walletId: input.agent.id,
                    userAddress: input.agent.user_address,
                    marketAddress: input.market.address,

                    autoExecute: input.agent.auto_trade,
                    autoResearch: input.agent.auto_research,
                });

            const runIds =
                response.runs.map(
                    (run) =>
                        run.runId,
                );

            await this.supabase.db
                .from(
                    "agent_market_scans",
                )
                .update({
                    status:
                        "completed",

                    run_ids:
                        runIds,

                    consensus_run_id:
                        response.consensus
                            ?.id ??
                        null,

                    last_processed_at:
                        new Date()
                            .toISOString(),

                    updated_at:
                        new Date()
                            .toISOString(),
                })
                .eq(
                    "agent_wallet_id",
                    input.agent.id,
                )
                .eq(
                    "market_address",
                    input.market.address,
                );
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Unknown autonomous run error.";

            this.logger.error(
                `Agent ${input.agent.id} failed on market ${input.market.address}: ${message}`,
            );

            await this.supabase.db
                .from(
                    "agent_market_scans",
                )
                .update({
                    status:
                        "failed",

                    error_message:
                        message,

                    last_processed_at:
                        new Date()
                            .toISOString(),

                    updated_at:
                        new Date()
                            .toISOString(),
                })
                .eq(
                    "agent_wallet_id",
                    input.agent.id,
                )
                .eq(
                    "market_address",
                    input.market.address,
                );
        }
    }
    private async claimMarket(
        walletId: string,
        market: MarketCandidate,
        intervalMinutes: number,
    ): Promise<boolean> {
        const {
            data: existing,
            error: lookupError,
        } =
            await this.supabase.db
                .from(
                    'agent_market_scans',
                )
                .select(
                    `
                id,
                status,
                last_processed_at
                `,
                )
                .eq(
                    'agent_wallet_id',
                    walletId,
                )
                .eq(
                    'market_address',
                    market.address,
                )
                .maybeSingle();

        if (lookupError) {
            throw new Error(
                `Failed to inspect market scan: ${lookupError.message}`,
            );
        }

        const now =
            new Date();

        if (!existing) {
            const {
                error: insertError,
            } =
                await this.supabase.db
                    .from(
                        'agent_market_scans',
                    )
                    .insert({
                        agent_wallet_id:
                            walletId,

                        market_address:
                            market.address,

                        status:
                            'running',

                        first_seen_at:
                            now.toISOString(),

                        updated_at:
                            now.toISOString(),
                    });

            if (insertError) {
                throw new Error(
                    `Failed to create market scan: ${insertError.message}`,
                );
            }

            return true;
        }

        if (
            existing.status ===
            'running'
        ) {
            return false;
        }

        if (
            existing.last_processed_at
        ) {
            const lastProcessedAt =
                new Date(
                    existing.last_processed_at,
                ).getTime();

            const elapsedMinutes =
                (
                    now.getTime() -
                    lastProcessedAt
                ) /
                60_000;

            if (
                elapsedMinutes <
                intervalMinutes
            ) {
                return false;
            }
        }

        const {
            error: updateError,
        } =
            await this.supabase.db
                .from(
                    'agent_market_scans',
                )
                .update({
                    status:
                        'running',

                    error_message:
                        null,

                    updated_at:
                        now.toISOString(),
                })
                .eq(
                    'id',
                    existing.id,
                );

        if (updateError) {
            throw new Error(
                `Failed to claim existing market: ${updateError.message}`,
            );
        }

        return true;
    }

    private async markScheduled(
        walletId: string,
    ): Promise<void> {
        const {
            error,
        } =
            await this.supabase.db
                .from(
                    "agent_wallets",
                )
                .update({
                    last_scheduled_run_at:
                        new Date()
                            .toISOString(),
                })
                .eq(
                    "id",
                    walletId,
                );

        if (error) {
            throw new Error(
                `Failed to update scheduler timestamp: ${error.message}`,
            );
        }
    }
}