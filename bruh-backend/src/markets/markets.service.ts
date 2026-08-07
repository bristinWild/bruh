import {
    Injectable,
    InternalServerErrorException,
    NotFoundException,
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
    marketFactoryAbi,
} from "./markets.abi";

import type {
    MarketActivity,
    MarketPricePoint,
    PublicMarket,
} from "./markets.types";

const OUTCOMES = [
    "UNRESOLVED",
    "YES",
    "NO",
    "INVALID",
] as const;

import {
    RedisService,
} from "../redis/redis.service";



@Injectable()
export class MarketsService {
    private readonly client;

    private readonly factoryAddress:
        Address;

    constructor(
        private readonly config:
            ConfigService,

        private readonly redis:
            RedisService,
    ) {
        const rpcUrl =
            this.config.get<string>(
                "ARC_RPC_URL",
            ) ??
            "https://rpc.testnet.arc.network";

        const factoryAddress =
            this.config.get<string>(
                "MARKET_FACTORY_ADDRESS",
            );

        if (!factoryAddress) {
            throw new Error(
                "MARKET_FACTORY_ADDRESS is not configured.",
            );
        }

        this.factoryAddress =
            factoryAddress as Address;

        this.client =
            createPublicClient({
                transport:
                    http(rpcUrl),
            });
    }
    async findAll(
        offset = 0,
        limit = 100,
    ): Promise<PublicMarket[]> {
        const safeLimit =
            Math.min(
                Math.max(limit, 1),
                100,
            );

        const cacheKey =
            `markets:list:${offset}:${safeLimit}`;

        const cached =
            await this.redis.getJson<
                PublicMarket[]
            >(
                cacheKey,
            );

        if (cached) {
            return cached;
        }

        try {
            const addresses =
                await this.client.readContract({
                    address:
                        this.factoryAddress,

                    abi:
                        marketFactoryAbi,

                    functionName:
                        "getMarkets",

                    args: [
                        BigInt(offset),
                        BigInt(
                            safeLimit,
                        ),
                    ],
                });

            const markets =
                await Promise.all(
                    addresses.map(
                        (address) =>
                            this.readMarketCached(
                                address,
                            ),
                    ),
                );

            const sorted =
                markets.sort(
                    (
                        first,
                        second,
                    ) =>
                        first.closeTimeUnix -
                        second.closeTimeUnix,
                );

            await this.redis.setJson(
                cacheKey,
                sorted,
                120,
            );


            await this.redis.setJson(
                `${cacheKey}:stale`,
                sorted,
                3600,
            );

            return sorted;
        } catch (error) {
            console.error(
                "Failed to load markets:",
                error,
            );

            const stale =
                await this.redis.getJson<
                    PublicMarket[]
                >(
                    `${cacheKey}:stale`,
                );

            if (stale) {
                return stale;
            }

            throw new InternalServerErrorException({
                code:
                    "MARKETS_UNAVAILABLE",

                message:
                    "Unable to load markets from Arc.",
            });
        }
    }

    async findOne(
        address: string,
    ): Promise<PublicMarket> {
        if (
            !/^0x[a-fA-F0-9]{40}$/.test(
                address,
            )
        ) {
            throw new NotFoundException({
                code:
                    "MARKET_NOT_FOUND",

                message:
                    "Market not found.",
            });
        }

        const marketAddress =
            address as Address;

        const cached =
            await this.redis.getJson<
                PublicMarket
            >(
                `market:${address.toLowerCase()}`,
            );

        if (cached) {
            return cached;
        }

        try {
            const exists =
                await this.client.readContract({
                    address:
                        this.factoryAddress,

                    abi:
                        marketFactoryAbi,

                    functionName:
                        "isMarket",

                    args: [
                        marketAddress,
                    ],
                });

            if (!exists) {
                throw new NotFoundException({
                    code:
                        "MARKET_NOT_FOUND",

                    message:
                        "Market not found.",
                });
            }

            return this.readMarketCached(
                marketAddress,
            );
        } catch (error) {
            const stale =
                await this.redis.getJson<
                    PublicMarket
                >(
                    `market:${address.toLowerCase()}:stale`,
                );

            if (stale) {
                return stale;
            }

            if (
                error instanceof
                NotFoundException
            ) {
                throw error;
            }

            throw new InternalServerErrorException({
                code:
                    "MARKET_UNAVAILABLE",

                message:
                    "Unable to load this market from Arc.",
            });
        }
    }

    async getPriceHistory(
        address: string,
    ): Promise<MarketPricePoint[]> {
        /*
         * Validate the address without
         * triggering any chain request.
         */
        if (
            !/^0x[a-fA-F0-9]{40}$/.test(
                address,
            )
        ) {
            throw new NotFoundException({
                code:
                    "MARKET_NOT_FOUND",

                message:
                    "Market not found.",
            });
        }

        const normalizedAddress =
            address.toLowerCase();

        /*
         * Read the exact same indexed
         * activity used by the Activity tab.
         *
         * No eth_getLogs here.
         */
        const activities =
            await this.redis.getJson<
                MarketActivity[]
            >(
                `market-activity:indexed:${normalizedAddress}`,
            ) ?? [];

        /*
         * We still need the market's
         * creation time and current price.
         *
         * findOne() already has its own
         * Redis cache / stale fallback.
         *
         * Importantly, we're no longer
         * scanning historical event logs.
         */
        const market =
            await this.findOne(
                address,
            );

        /*
         * The activity index is stored
         * newest-first for the Activity UI.
         *
         * Charts need oldest-first.
         *
         * If multiple transactions occur
         * within one block, use the logIndex
         * embedded in:
         *
         * transactionHash:logIndex
         *
         * to preserve event order.
         */
        const sortedActivities = [
            ...activities,
        ].sort(
            (
                first,
                second,
            ) => {
                if (
                    first.blockNumber !==
                    second.blockNumber
                ) {
                    return (
                        first.blockNumber -
                        second.blockNumber
                    );
                }

                const firstLogIndex =
                    Number(
                        first.id
                            .split(":")
                            .pop() ??
                        0,
                    );

                const secondLogIndex =
                    Number(
                        second.id
                            .split(":")
                            .pop() ??
                        0,
                    );

                return (
                    firstLogIndex -
                    secondLogIndex
                );
            },
        );

        /*
         * Every indexed trade already
         * contains yesPrice / noPrice after
         * that trade.
         *
         * Therefore we don't need to query
         * the contract events again.
         */
        const tradePoints:
            MarketPricePoint[] =
            sortedActivities.map(
                (
                    activity,
                ) => ({
                    blockNumber:
                        activity.blockNumber,

                    timestamp:
                        activity.timestamp,

                    yesPrice:
                        activity.yesPrice,

                    noPrice:
                        activity.noPrice,

                    eventType:
                        activity.action,
                }),
            );

        /*
         * Prediction markets begin at
         * 50 / 50.
         */
        const history:
            MarketPricePoint[] = [
                {
                    blockNumber:
                        0,

                    timestamp:
                        market.createdAt,

                    yesPrice:
                        0.5,

                    noPrice:
                        0.5,

                    eventType:
                        "INITIAL",
                },

                ...tradePoints,
            ];

        /*
         * Compare the last indexed trade
         * price against the current market
         * contract state.
         *
         * This handles cases where the
         * background indexer has not quite
         * reached the latest block yet.
         */
        const latestPoint =
            history[
            history.length -
            1
            ];

        const currentPriceChanged =
            Math.abs(
                latestPoint.yesPrice -
                market.yesPrice,
            ) >
            0.000001;

        if (
            currentPriceChanged
        ) {
            history.push({
                /*
                 * This isn't an indexed
                 * trade block, so don't
                 * pretend we know the exact
                 * block number.
                 */
                blockNumber:
                    latestPoint.blockNumber,

                timestamp:
                    new Date()
                        .toISOString(),

                yesPrice:
                    market.yesPrice,

                noPrice:
                    market.noPrice,

                eventType:
                    "CURRENT",
            });
        }

        return history;
    }

    async getActivity(
        address: string,
    ): Promise<MarketActivity[]> {
        if (
            !/^0x[a-fA-F0-9]{40}$/.test(
                address,
            )
        ) {
            throw new NotFoundException({
                code:
                    "MARKET_NOT_FOUND",

                message:
                    "Market not found.",
            });
        }

        const normalizedAddress =
            address.toLowerCase();

        const activityKey =
            `market-activity:indexed:${normalizedAddress}`;

        const pendingKey =
            `market-activity:pending:${normalizedAddress}`;

        const [
            indexed,
            pending,
        ] =
            await Promise.all([
                this.redis.getJson<
                    MarketActivity[]
                >(
                    activityKey,
                ),

                this.redis.getJson<
                    MarketActivity[]
                >(
                    pendingKey,
                ),
            ]);

        const indexedActivities =
            indexed ?? [];

        const pendingActivities =
            pending ?? [];

        /*
         * Once the real indexed event exists,
         * remove its temporary pending version.
         */
        const indexedTransactionHashes =
            new Set(
                indexedActivities.map(
                    (
                        activity,
                    ) =>
                        activity.transactionHash
                            .toLowerCase(),
                ),
            );

        const unresolvedPending =
            pendingActivities.filter(
                (
                    activity,
                ) =>
                    !indexedTransactionHashes.has(
                        activity.transactionHash
                            .toLowerCase(),
                    ),
            );

        /*
         * Clean Redis when pending trades
         * have been reconciled.
         */
        if (
            unresolvedPending.length !==
            pendingActivities.length
        ) {
            await this.redis.setJson(
                pendingKey,
                unresolvedPending,
                3600,
            );
        }

        return [
            ...unresolvedPending,
            ...indexedActivities,
        ].sort(
            (
                first,
                second,
            ) =>
                new Date(
                    second.timestamp,
                ).getTime() -
                new Date(
                    first.timestamp,
                ).getTime(),
        );
    }


    async addConfirmedActivity(
        address: string,
        input: {
            transactionHash: string;
            trader: string;
            side:
            | "YES"
            | "NO";
            usdcAmount: number;
            yesPrice: number;
            noPrice: number;
            timestamp?: string;
        },
    ): Promise<MarketActivity> {
        if (
            !/^0x[a-fA-F0-9]{40}$/.test(
                address,
            )
        ) {
            throw new NotFoundException({
                code:
                    "MARKET_NOT_FOUND",

                message:
                    "Market not found.",
            });
        }

        if (
            !/^0x[a-fA-F0-9]{64}$/.test(
                input.transactionHash,
            )
        ) {
            throw new InternalServerErrorException({
                code:
                    "INVALID_TRANSACTION_HASH",

                message:
                    "Invalid transaction hash.",
            });
        }

        if (
            !/^0x[a-fA-F0-9]{40}$/.test(
                input.trader,
            )
        ) {
            throw new InternalServerErrorException({
                code:
                    "INVALID_TRADER",

                message:
                    "Invalid trader address.",
            });
        }

        const normalizedAddress =
            address.toLowerCase();

        const pendingKey =
            `market-activity:pending:${normalizedAddress}`;

        const existing =
            await this.redis.getJson<
                MarketActivity[]
            >(
                pendingKey,
            ) ?? [];

        const activity:
            MarketActivity = {
            /*
             * Temporary ID.
             *
             * Once the indexer finds the
             * actual log, its real
             * txHash:logIndex ID wins.
             */
            id:
                `pending:${input.transactionHash}`,

            transactionHash:
                input.transactionHash as `0x${string}`,

            /*
             * Unknown until the on-chain
             * event is indexed.
             */
            blockNumber:
                0,

            timestamp:
                input.timestamp ??
                new Date().toISOString(),

            trader:
                input.trader as `0x${string}`,

            action:
                "BUY",

            side:
                input.side,

            usdcAmount:
                input.usdcAmount,

            /*
             * Exact values are filled by
             * the real indexed event later.
             */
            shares:
                0,

            feeUsdc:
                0,

            yesPrice:
                input.yesPrice,

            noPrice:
                input.noPrice,

            pending:
                true,
        };

        /*
         * Dedupe pending records by txHash.
         */
        const updated =
            [
                activity,

                ...existing.filter(
                    (
                        item,
                    ) =>
                        item.transactionHash
                        !==
                        activity.transactionHash,
                ),
            ];

        await this.redis.setJson(
            pendingKey,
            updated,
            3600,
        );

        return activity;
    }

    private async readMarketCached(
        address: Address,
    ): Promise<PublicMarket> {
        const normalizedAddress =
            address.toLowerCase();

        const cacheKey =
            `market:${normalizedAddress}`;

        const cached =
            await this.redis.getJson<
                PublicMarket
            >(
                cacheKey,
            );

        if (cached) {
            return cached;
        }

        try {
            const market =
                await this.readMarket(
                    address,
                );

            await this.redis.setJson(
                cacheKey,
                market,
                60,
            );

            await this.redis.setJson(
                `${cacheKey}:stale`,
                market,
                3600,
            );

            return market;
        } catch (error) {
            const stale =
                await this.redis.getJson<
                    PublicMarket
                >(
                    `${cacheKey}:stale`,
                );

            if (stale) {
                return stale;
            }

            throw error;
        }
    }

    private async readMarket(
        address: Address,
    ): Promise<PublicMarket> {
        const [
            summary,
            info,
            oracle,
            feeBps,
            actualNoPriceWad,
        ] =
            await Promise.all([
                this.client.readContract({
                    address,

                    abi:
                        marketAbi,

                    functionName:
                        "summary",
                }),

                this.client.readContract({
                    address,

                    abi:
                        marketAbi,

                    functionName:
                        "info",
                }),

                this.client.readContract({
                    address,

                    abi:
                        marketAbi,

                    functionName:
                        "oracle",
                }),

                this.client.readContract({
                    address,

                    abi:
                        marketAbi,

                    functionName:
                        "feeBps",
                }),

                this.client.readContract({
                    address,
                    abi: marketAbi,
                    functionName: "noPrice",
                }),
            ]);

        const [
            question,
            closeTime,
            currentOutcome,
            yesPriceWad,
            _incorrectSummaryNoPriceWad,
            totalCollateral,
            yesShares,
            noShares,
            open,
            resolved,
        ] = summary;

        const [
            ,
            ,
            createdAt,
            creator,
        ] = info;

        const outcome =
            OUTCOMES[
            Number(
                currentOutcome,
            )
            ] ??
            "UNRESOLVED";

        return {
            id:
                address.toLowerCase(),

            address,

            question,

            closeTime:
                new Date(
                    Number(
                        closeTime,
                    ) * 1000,
                ).toISOString(),

            closeTimeUnix:
                Number(
                    closeTime,
                ),

            createdAt:
                new Date(
                    Number(
                        createdAt,
                    ) * 1000,
                ).toISOString(),

            creator,

            oracle,

            outcome,

            yesPrice:
                Number(
                    formatUnits(
                        yesPriceWad,
                        18,
                    ),
                ),

            noPrice:
                Number(
                    formatUnits(
                        actualNoPriceWad,
                        18,
                    ),
                ),

            collateralUsdc:
                Number(
                    formatUnits(
                        totalCollateral,
                        6,
                    ),
                ),

            totalSharesYes:
                Number(
                    formatUnits(
                        yesShares,
                        6,
                    ),
                ),

            totalSharesNo:
                Number(
                    formatUnits(
                        noShares,
                        6,
                    ),
                ),

            feeBps:
                Number(
                    feeBps,
                ),

            open,

            resolved,

            network:
                "eip155:5042002",
        };
    }
}



