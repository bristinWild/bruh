import {
    Injectable,
    Logger,
} from "@nestjs/common";

import {
    Interval,
} from "@nestjs/schedule";

import type {
    Address,
} from "viem";

import {
    MarketsService,
} from "./markets.service";

import {
    MarketActivityIndexerService,
} from "./market-activity-indexer.service";

import {
    RedisService,
} from "../redis/redis.service";

import type {
    MarketActivity,
} from "./markets.types";

@Injectable()
export class MarketActivitySchedulerService {
    private readonly logger =
        new Logger(
            MarketActivitySchedulerService.name,
        );

    /*
     * Prevent overlapping scheduler runs.
     *
     * If one indexing cycle takes longer
     * than the interval, we skip the next
     * invocation instead of starting a
     * second RPC-heavy sync.
     */
    private running =
        false;

    private marketCursor =
        0;

    /*
     * On the very first indexing pass,
     * start this far behind the current
     * Arc block.
     *
     * Temporary bootstrap strategy.
     *
     * Later we can replace this with
     * the actual MarketCreated block.
     */
    private readonly INITIAL_LOOKBACK =
        2_000n;


    private readonly MAX_BLOCKS_PER_RUN =
        250n;

    private readonly LIVE_TAIL_THRESHOLD =
        300n;

    constructor(
        private readonly marketsService:
            MarketsService,

        private readonly activityIndexer:
            MarketActivityIndexerService,

        private readonly redis:
            RedisService,
    ) { }

    /*
     * Run approximately every 15 seconds.
     *
     * This is background indexing only.
     * User HTTP requests no longer
     * trigger blockchain log scans.
     */
    @Interval(30_000)
    async syncActivities():
        Promise<void> {
        if (this.running) {
            this.logger.debug(
                "Previous market activity sync is still running. Skipping.",
            );

            return;
        }

        this.running =
            true;

        try {
            await this.runSync();
        } catch (error) {
            this.logger.error(
                "Market activity scheduler failed.",
                error,
            );
        } finally {
            this.running =
                false;
        }
    }

    private async runSync():
        Promise<void> {
        /*
         * Reuse the existing market
         * discovery service.
         *
         * No new factory/indexing
         * dependency is introduced.
         */
        const markets =
            await this.marketsService
                .findAll(
                    0,
                    100,
                );

        if (
            markets.length === 0
        ) {
            return;
        }

        /*
         * Read the Arc head once for
         * the scheduler cycle.
         */
        const latestBlock =
            await this.activityIndexer
                .getLatestBlock();

        /*
         * Round-robin market selection.
         *
         * Only ONE market is processed
         * per scheduler cycle.
         */
        if (
            this.marketCursor >=
            markets.length
        ) {
            this.marketCursor =
                0;
        }

        const market =
            markets[
            this.marketCursor
            ];

        /*
         * Advance cursor so the next
         * scheduler cycle processes
         * the next market.
         */
        this.marketCursor =
            (
                this.marketCursor +
                1
            ) %
            markets.length;

        try {
            await this.syncMarket(
                market.address,
                latestBlock,
            );
        } catch (error) {
            this.logger.warn(
                `Failed to sync market activity for ${market.address}`,
            );
        }
    }

    private async syncMarket(
        address: Address,
        latestBlock: bigint,
    ): Promise<void> {
        const normalizedAddress =
            address.toLowerCase();

        const activityKey =
            `market-activity:indexed:${normalizedAddress}`;

        const checkpointKey =
            `market-activity:checkpoint:${normalizedAddress}`;

        const [
            existingActivities,
            checkpoint,
        ] =
            await Promise.all([
                this.redis.getJson<
                    MarketActivity[]
                >(
                    activityKey,
                ),

                this.redis.getJson<{
                    blockNumber: number;
                }>(
                    checkpointKey,
                ),
            ]);

        /*
         * If we already have a checkpoint,
         * continue from the following block.
         *
         * Otherwise bootstrap from 2,000
         * blocks behind the current head.
         */
        const fromBlock =
            checkpoint
                ? BigInt(
                    checkpoint.blockNumber,
                ) + 1n
                : latestBlock >
                    this.INITIAL_LOOKBACK
                    ? latestBlock -
                    this.INITIAL_LOOKBACK
                    : 0n;

        /*
         * Already synchronized with
         * the current Arc head.
         */
        if (
            fromBlock >
            latestBlock
        ) {
            return;
        }

        const blocksBehind =
            latestBlock -
            fromBlock;

        /*
         * Two operating modes:
         *
         * 1. BACKFILL
         *    We're still far behind.
         *    Only process 250 blocks.
         *
         * 2. LIVE TAIL
         *    We're close to the chain head.
         *    Process everything through
         *    latestBlock immediately.
         */
        let toBlock:
            bigint;

        if (
            blocksBehind <=
            this.LIVE_TAIL_THRESHOLD
        ) {
            toBlock =
                latestBlock;

            this.logger.debug(
                `Live-tail sync ${normalizedAddress}: ${fromBlock} -> ${toBlock}`,
            );
        } else {
            const maximumToBlock =
                fromBlock +
                this.MAX_BLOCKS_PER_RUN -
                1n;

            toBlock =
                maximumToBlock <
                    latestBlock
                    ? maximumToBlock
                    : latestBlock;

            this.logger.debug(
                `Backfill sync ${normalizedAddress}: ${fromBlock} -> ${toBlock} (${blocksBehind} blocks behind)`,
            );
        }



        await this.activityIndexer
            .syncMarket(
                address,
                fromBlock,
                toBlock,
                existingActivities ??
                [],
            );
    }
}