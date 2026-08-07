import {
    Injectable,
    Logger,
} from "@nestjs/common";

import {
    ConfigService,
} from "@nestjs/config";

import {
    createPublicClient,
    formatUnits,
    http,
    type Address,
} from "viem";

import {
    marketAbi,
} from "./markets.abi";

import type {
    MarketActivity,
} from "./markets.types";

import {
    RedisService,
} from "../redis/redis.service";

import {
    MarketStreamService,
} from "./market-stream.service";

@Injectable()
export class MarketActivityIndexerService {
    private readonly logger =
        new Logger(
            MarketActivityIndexerService.name,
        );

    private readonly client;

    /*
     * Keep historical log queries small.
     *
     * Arc's public RPC rate-limits
     * aggressive eth_getLogs workloads.
     */
    private readonly CHUNK_SIZE =
        250n;

    constructor(
        private readonly config:
            ConfigService,

        private readonly redis:
            RedisService,

        private readonly marketStream:
            MarketStreamService,
    ) {
        const rpcUrl =
            this.config.get<string>(
                "ARC_RPC_URL",
            ) ??
            "https://rpc.testnet.arc.network";

        this.client =
            createPublicClient({
                transport:
                    http(
                        rpcUrl,
                        {
                            /*
                             * Disable viem's automatic
                             * transport retries.
                             *
                             * We handle retries ourselves
                             * below so we can control
                             * the delay between requests.
                             */
                            retryCount:
                                0,
                        },
                    ),
            });
    }

    /**
     * Synchronize activity for one market.
     *
     * Important:
     * progress is persisted after EVERY
     * successful chunk.
     *
     * Therefore, if Arc rate-limits us
     * halfway through a backfill, the
     * next sync can resume from the last
     * successful checkpoint.
     */
    async syncMarket(
        address: Address,
        fromBlock: bigint,
        toBlock: bigint,

        existingActivities:
            MarketActivity[] = [],

        publishLiveEvents =
            false,
    ): Promise<MarketActivity[]> {
        const normalizedAddress =
            address.toLowerCase();

        const activityKey =
            `market-activity:indexed:${normalizedAddress}`;

        const checkpointKey =
            `market-activity:checkpoint:${normalizedAddress}`;

        /*
         * Start with whatever activity
         * MarketsService already loaded
         * from Redis.
         */
        let activities:
            MarketActivity[] = [
                ...existingActivities,
            ];

        let cursor =
            fromBlock;

        while (
            cursor <= toBlock
        ) {
            const possibleChunkEnd =
                cursor +
                this.CHUNK_SIZE -
                1n;

            const chunkEnd =
                possibleChunkEnd >
                    toBlock
                    ? toBlock
                    : possibleChunkEnd;

            this.logger.debug(
                `Indexing ${normalizedAddress}: ${cursor} -> ${chunkEnd}`,
            );

            /*
             * ------------------------------------------------
             * 1. Load BUY logs
             * ------------------------------------------------
             *
             * Do NOT run BUY and SELL requests
             * with Promise.all().
             *
             * We intentionally make them
             * sequential to reduce burst load
             * against Arc's public RPC.
             */
            const boughtLogs =
                await this.withRetry(
                    async () =>
                        await this.client
                            .getContractEvents({
                                address,
                                abi: marketAbi,
                                eventName:
                                    "SharesBought",
                                fromBlock:
                                    cursor,
                                toBlock:
                                    chunkEnd,
                            }),

                    `SharesBought ${cursor}-${chunkEnd}`,
                );

            /*
             * Give the RPC some breathing room
             * before sending the SELL query.
             */
            await this.sleep(
                300,
            );

            /*
             * ------------------------------------------------
             * 2. Load SELL logs
             * ------------------------------------------------
             */
            const soldLogs =
                await this.withRetry(
                    async () =>
                        await this.client
                            .getContractEvents({
                                address,
                                abi: marketAbi,
                                eventName:
                                    "SharesSold",
                                fromBlock:
                                    cursor,
                                toBlock:
                                    chunkEnd,
                            }),

                    `SharesSold ${cursor}-${chunkEnd}`,
                );

            /*
             * ------------------------------------------------
             * 3. Normalize the event logs
             * ------------------------------------------------
             */
            const rawActivities = [
                ...boughtLogs
                    .filter(
                        (
                            log,
                        ) =>
                            log.blockNumber !==
                            null &&
                            log.transactionHash !==
                            null,
                    )
                    .map(
                        (
                            log,
                        ) => ({
                            transactionHash:
                                log.transactionHash!,

                            blockNumber:
                                log.blockNumber!,

                            logIndex:
                                log.logIndex ??
                                0,

                            trader:
                                log.args
                                    .buyer as Address,

                            action:
                                "BUY" as const,

                            side:
                                log.args
                                    .isYes
                                    ? ("YES" as const)
                                    : ("NO" as const),

                            usdcAmount:
                                log.args
                                    .usdcIn as bigint,

                            shares:
                                log.args
                                    .sharesOut as bigint,

                            fee:
                                log.args
                                    .feeCharged as bigint,

                            yesPriceAfter:
                                log.args
                                    .yesPriceAfter as bigint,
                        }),
                    ),

                ...soldLogs
                    .filter(
                        (
                            log,
                        ) =>
                            log.blockNumber !==
                            null &&
                            log.transactionHash !==
                            null,
                    )
                    .map(
                        (
                            log,
                        ) => ({
                            transactionHash:
                                log.transactionHash!,

                            blockNumber:
                                log.blockNumber!,

                            logIndex:
                                log.logIndex ??
                                0,

                            trader:
                                log.args
                                    .seller as Address,

                            action:
                                "SELL" as const,

                            side:
                                log.args
                                    .isYes
                                    ? ("YES" as const)
                                    : ("NO" as const),

                            usdcAmount:
                                log.args
                                    .usdcOut as bigint,

                            shares:
                                log.args
                                    .sharesIn as bigint,

                            fee:
                                log.args
                                    .feeCharged as bigint,

                            yesPriceAfter:
                                log.args
                                    .yesPriceAfter as bigint,
                        }),
                    ),
            ];

            /*
             * ------------------------------------------------
             * 4. Fetch timestamps for blocks
             * ------------------------------------------------
             *
             * Multiple trades may exist in
             * one block, so only fetch each
             * block once.
             */
            const uniqueBlocks =
                Array.from(
                    new Set(
                        rawActivities.map(
                            (
                                activity,
                            ) =>
                                activity.blockNumber,
                        ),
                    ),
                );

            const timestamps =
                new Map<
                    bigint,
                    bigint
                >();

            /*
             * Fetch blocks sequentially instead
             * of Promise.all() so a busy market
             * doesn't create another RPC burst.
             */
            for (
                const blockNumber
                of uniqueBlocks
            ) {
                const block =
                    await this.withRetry(
                        async () =>
                            await this.client
                                .getBlock({
                                    blockNumber,
                                }),

                        `getBlock ${blockNumber}`,
                    );

                timestamps.set(
                    blockNumber,
                    block.timestamp,
                );

                /*
                 * Small delay between block
                 * lookups.
                 */
                await this.sleep(
                    100,
                );
            }

            /*
             * ------------------------------------------------
             * 5. Convert logs to MarketActivity
             * ------------------------------------------------
             */
            const chunkActivities:
                MarketActivity[] =
                rawActivities.map(
                    (
                        activity,
                    ) => {
                        const yesPrice =
                            Number(
                                formatUnits(
                                    activity
                                        .yesPriceAfter,
                                    18,
                                ),
                            );

                        const blockTimestamp =
                            timestamps.get(
                                activity
                                    .blockNumber,
                            );

                        return {
                            id:
                                `${activity.transactionHash}:${activity.logIndex}`,

                            transactionHash:
                                activity
                                    .transactionHash,

                            blockNumber:
                                Number(
                                    activity
                                        .blockNumber,
                                ),

                            timestamp:
                                new Date(
                                    Number(
                                        blockTimestamp ??
                                        0n,
                                    ) *
                                    1000,
                                ).toISOString(),

                            trader:
                                activity
                                    .trader,

                            action:
                                activity
                                    .action,

                            side:
                                activity
                                    .side,

                            usdcAmount:
                                Number(
                                    formatUnits(
                                        activity
                                            .usdcAmount,
                                        6,
                                    ),
                                ),

                            shares:
                                Number(
                                    formatUnits(
                                        activity
                                            .shares,
                                        6,
                                    ),
                                ),

                            feeUsdc:
                                Number(
                                    formatUnits(
                                        activity
                                            .fee,
                                        6,
                                    ),
                                ),

                            yesPrice,

                            noPrice:
                                1 -
                                yesPrice,
                        };
                    },
                );

            /*
             * ------------------------------------------------
             * 6. Merge existing + new activity
             * ------------------------------------------------
             */
            activities = [
                ...activities,
                ...chunkActivities,
            ];

            /*
             * transactionHash + logIndex
             * uniquely identify an EVM log.
             *
             * This means repeating a chunk
             * is harmless.
             */
            activities =
                Array.from(
                    new Map(
                        activities.map(
                            (
                                activity,
                            ) => [
                                    activity.id,
                                    activity,
                                ],
                        ),
                    ).values(),
                ).sort(
                    (
                        first,
                        second,
                    ) =>
                        second.blockNumber -
                        first.blockNumber,
                );

            /*
             * ------------------------------------------------
             * 7. Persist THIS chunk immediately
             * ------------------------------------------------
             *
             * Do not wait until the whole
             * 2k/10k backfill is complete.
             */
            await this.redis.setJson(
                activityKey,
                activities,
                604800,
            );

            if (
                publishLiveEvents
            ) {
                for (
                    const activity
                    of chunkActivities
                ) {
                    this.marketStream
                        .publishTrade(
                            normalizedAddress,
                            activity,
                            "indexed",
                        );
                }
            }

            /*
             * ------------------------------------------------
             * 8. Save progress checkpoint
             * ------------------------------------------------
             */
            await this.redis.setJson(
                checkpointKey,
                {
                    blockNumber:
                        Number(
                            chunkEnd,
                        ),
                },
                604800,
            );

            this.logger.debug(
                `Checkpoint saved ${normalizedAddress}: ${chunkEnd}`,
            );

            /*
             * Move to next range.
             */
            cursor =
                chunkEnd + 1n;

            /*
             * Important:
             *
             * Wait before hitting Arc with
             * another pair of eth_getLogs
             * requests.
             */
            await this.sleep(
                750,
            );
        }

        return activities;
    }

    /**
     * Get Arc's latest block.
     */
    async getLatestBlock():
        Promise<bigint> {
        return this.withRetry(
            () =>
                this.client
                    .getBlockNumber(),

            "getLatestBlock",
        );
    }

    /**
     * Controlled RPC retry.
     *
     * Viem HTTP retries are disabled,
     * because otherwise viem may retry
     * rapidly while Arc is rate-limiting.
     */
    private async withRetry<T>(
        request:
            () => Promise<T>,

        operation:
            string,
    ): Promise<T> {
        const delays = [
            5000
        ];

        let lastError:
            unknown;

        /*
         * Initial request + up to
         * three delayed retries.
         */
        for (
            let attempt = 0;
            attempt <=
            delays.length;
            attempt++
        ) {
            try {
                return await request();
            } catch (error) {
                lastError =
                    error;

                /*
                 * No delays left,
                 * propagate the error.
                 */
                if (
                    attempt ===
                    delays.length
                ) {
                    break;
                }

                const delay =
                    delays[
                    attempt
                    ];

                this.logger.warn(
                    `${operation} failed. Retry ${attempt + 1
                    }/${delays.length} in ${delay}ms`,
                );

                await this.sleep(
                    delay,
                );
            }
        }

        throw lastError;
    }

    /**
     * Simple async delay helper.
     */
    private async sleep(
        ms: number,
    ): Promise<void> {
        await new Promise<void>(
            (
                resolve,
            ) =>
                setTimeout(
                    resolve,
                    ms,
                ),
        );
    }
}