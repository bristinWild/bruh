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

        const cacheKey =
            `market-history:${address.toLowerCase()}`;

        const cached =
            await this.redis.getJson<
                MarketPricePoint[]
            >(
                cacheKey,
            );
        if (cached) {
            console.log("✅ Redis cache HIT:", cacheKey);
            return cached;
        }

        console.log("❌ Redis cache MISS:", cacheKey);

        try {
            const market =
                await this.findOne(
                    address,
                );

            const marketAddress =
                market.address as Address;

            const latestBlock =
                await this.client
                    .getBlockNumber();

            // Keep the RPC query small enough for Arc.
            // These markets were created recently, so 50k blocks is sufficient.

            const MAX_BLOCK_RANGE = 10_000n;
            const fromBlock =
                latestBlock > MAX_BLOCK_RANGE
                    ? latestBlock - MAX_BLOCK_RANGE
                    : 0n;

            const [
                boughtLogs,
                soldLogs,
            ] =
                await Promise.all([
                    this.client
                        .getContractEvents({
                            address:
                                marketAddress,

                            abi:
                                marketAbi,

                            eventName:
                                "SharesBought",

                            fromBlock,

                            toBlock:
                                latestBlock,
                        }),

                    this.client
                        .getContractEvents({
                            address:
                                marketAddress,

                            abi:
                                marketAbi,

                            eventName:
                                "SharesSold",

                            fromBlock,

                            toBlock:
                                latestBlock,
                        }),
                ]);

            const logs = [
                ...boughtLogs
                    .filter(
                        (
                            log,
                        ): log is typeof log & {
                            blockNumber: bigint;
                        } =>
                            log.blockNumber !==
                            null &&
                            log.args
                                .yesPriceAfter !==
                            undefined,
                    )
                    .map((log) => ({
                        blockNumber:
                            log.blockNumber,

                        yesPriceAfter:
                            log.args
                                .yesPriceAfter as bigint,

                        eventType:
                            "BUY" as const,
                    })),

                ...soldLogs
                    .filter(
                        (
                            log,
                        ): log is typeof log & {
                            blockNumber: bigint;
                        } =>
                            log.blockNumber !==
                            null &&
                            log.args
                                .yesPriceAfter !==
                            undefined,
                    )
                    .map((log) => ({
                        blockNumber:
                            log.blockNumber,

                        yesPriceAfter:
                            log.args
                                .yesPriceAfter as bigint,

                        eventType:
                            "SELL" as const,
                    })),
            ].sort(
                (
                    first,
                    second,
                ) =>
                    first.blockNumber <
                        second.blockNumber
                        ? -1
                        : first.blockNumber >
                            second.blockNumber
                            ? 1
                            : 0,
            );

            const uniqueBlocks =
                Array.from(
                    new Set(
                        logs.map(
                            (log) =>
                                log.blockNumber,
                        ),
                    ),
                );

            const blockEntries =
                await Promise.all(
                    uniqueBlocks.map(
                        async (
                            blockNumber,
                        ) => {
                            const block =
                                await this.client
                                    .getBlock({
                                        blockNumber,
                                    });

                            return [
                                blockNumber,
                                block.timestamp,
                            ] as const;
                        },
                    ),
                );

            const timestamps =
                new Map(
                    blockEntries,
                );

            const points:
                MarketPricePoint[] =
                logs.map(
                    (log) => {
                        const yesPrice =
                            Number(
                                formatUnits(
                                    log.yesPriceAfter,
                                    18,
                                ),
                            );

                        const blockTimestamp =
                            timestamps.get(
                                log.blockNumber,
                            );

                        return {
                            blockNumber:
                                Number(
                                    log.blockNumber,
                                ),

                            timestamp:
                                new Date(
                                    Number(
                                        blockTimestamp ??
                                        0n,
                                    ) *
                                    1000,
                                ).toISOString(),

                            yesPrice,

                            noPrice:
                                1 -
                                yesPrice,

                            eventType:
                                log.eventType,
                        };
                    },
                );

            const history: MarketPricePoint[] = [
                {
                    blockNumber: 0,
                    timestamp: market.createdAt,
                    yesPrice: 0.5,
                    noPrice: 0.5,
                    eventType: "INITIAL",
                },

                ...points,
            ];

            const latestPoint =
                history[history.length - 1];

            const currentPriceChanged =
                Math.abs(
                    latestPoint.yesPrice -
                    market.yesPrice,
                ) > 0.000001;

            if (currentPriceChanged) {
                history.push({
                    blockNumber:
                        Number(
                            latestBlock,
                        ),

                    timestamp:
                        new Date().toISOString(),

                    yesPrice:
                        market.yesPrice,

                    noPrice:
                        market.noPrice,

                    eventType:
                        "CURRENT",
                });
            }

            await this.redis.setJson(
                cacheKey,
                history,
                120,
            );

            return history;
        } catch (error) {
            console.error(
                "Failed to load market price history:",
                error,
            );

            const market =
                await this.findOne(
                    address,
                );

            const fallback:
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

                    {
                        blockNumber:
                            0,

                        timestamp:
                            new Date().toISOString(),

                        yesPrice:
                            market.yesPrice,

                        noPrice:
                            market.noPrice,

                        eventType:
                            "CURRENT",
                    },
                ];

            await this.redis.setJson(
                cacheKey,
                fallback,
                30,
            );

            return fallback;
        }
    }

    async getActivity(
        address: string,
    ): Promise<MarketActivity[]> {
        const normalizedAddress =
            address.toLowerCase();

        const cacheKey =
            `market-activity:${normalizedAddress}`;

        const staleKey =
            `${cacheKey}:stale`;

        const cached =
            await this.redis.getJson<
                MarketActivity[]
            >(
                cacheKey,
            );

        if (cached) {
            return cached;
        }

        try {
            const market =
                await this.findOne(
                    address,
                );

            const marketAddress =
                market.address as Address;

            const latestBlock =
                await this.client
                    .getBlockNumber();

            /*
             * Public Arc RPC limits eth_getLogs
             * to 10,000 blocks per request.
             */
            const CHUNK_SIZE =
                BigInt(9_500);

            /*
             * Start from approximately the
             * market creation period.
             *
             * We already know these markets
             * are recent, so scan backwards
             * until we cover the required
             * activity window.
             */
            const MAX_SCAN_RANGE =
                BigInt(100_000);

            const firstBlock =
                latestBlock >
                    MAX_SCAN_RANGE
                    ? latestBlock -
                    MAX_SCAN_RANGE
                    : BigInt(0);

            const boughtLogs:
                Awaited<
                    ReturnType<
                        typeof this.client.getContractEvents
                    >
                > = [];

            const soldLogs:
                Awaited<
                    ReturnType<
                        typeof this.client.getContractEvents
                    >
                > = [];

            let fromBlock =
                firstBlock;

            while (
                fromBlock <=
                latestBlock
            ) {
                const toBlock =
                    fromBlock +
                        CHUNK_SIZE >
                        latestBlock
                        ? latestBlock
                        : fromBlock +
                        CHUNK_SIZE;

                const [
                    buys,
                    sells,
                ] =
                    await Promise.all([
                        this.client
                            .getContractEvents({
                                address:
                                    marketAddress,

                                abi:
                                    marketAbi,

                                eventName:
                                    "SharesBought",

                                fromBlock,

                                toBlock,
                            }),

                        this.client
                            .getContractEvents({
                                address:
                                    marketAddress,

                                abi:
                                    marketAbi,

                                eventName:
                                    "SharesSold",

                                fromBlock,

                                toBlock,
                            }),
                    ]);

                boughtLogs.push(
                    ...buys,
                );

                soldLogs.push(
                    ...sells,
                );

                if (
                    toBlock ===
                    latestBlock
                ) {
                    break;
                }

                fromBlock =
                    toBlock +
                    BigInt(1);
            }

            const rawActivities = [
                ...boughtLogs
                    .filter(
                        (log) =>
                            log.blockNumber !==
                            null &&
                            log.transactionHash !==
                            null,
                    )
                    .map(
                        (log) => ({
                            transactionHash:
                                log.transactionHash!,

                            blockNumber:
                                log.blockNumber!,

                            logIndex:
                                log.logIndex ?? 0,

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
                        (log) =>
                            log.blockNumber !==
                            null &&
                            log.transactionHash !==
                            null,
                    )
                    .map(
                        (log) => ({
                            transactionHash:
                                log.transactionHash!,

                            blockNumber:
                                log.blockNumber!,

                            logIndex:
                                log.logIndex ?? 0,

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
            ].sort(
                (
                    first,
                    second,
                ) => {
                    if (
                        first.blockNumber ===
                        second.blockNumber
                    ) {
                        return (
                            first.logIndex -
                            second.logIndex
                        );
                    }

                    return first.blockNumber <
                        second.blockNumber
                        ? -1
                        : 1;
                },
            );

            const uniqueBlocks =
                Array.from(
                    new Set(
                        rawActivities.map(
                            (activity) =>
                                activity.blockNumber,
                        ),
                    ),
                );

            const blockEntries =
                await Promise.all(
                    uniqueBlocks.map(
                        async (
                            blockNumber,
                        ) => {
                            const block =
                                await this.client
                                    .getBlock({
                                        blockNumber,
                                    });

                            return [
                                blockNumber,
                                block.timestamp,
                            ] as const;
                        },
                    ),
                );

            const timestamps =
                new Map(
                    blockEntries,
                );

            const activities:
                MarketActivity[] =
                rawActivities
                    .map(
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

                            const timestamp =
                                timestamps.get(
                                    activity
                                        .blockNumber,
                                );

                            return {
                                id:
                                    `${activity.transactionHash}:${activity.logIndex}`,

                                transactionHash:
                                    activity.transactionHash,

                                blockNumber:
                                    Number(
                                        activity.blockNumber,
                                    ),

                                timestamp:
                                    new Date(
                                        Number(
                                            timestamp ??
                                            BigInt(
                                                0,
                                            ),
                                        ) *
                                        1000,
                                    ).toISOString(),

                                trader:
                                    activity.trader,

                                action:
                                    activity.action,

                                side:
                                    activity.side,

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
                    )
                    .reverse();

            await this.redis.setJson(
                cacheKey,
                activities,
                30,
            );

            await this.redis.setJson(
                staleKey,
                activities,
                3600,
            );

            return activities;
        } catch (error) {
            console.error(
                "Failed to load market activity:",
                error,
            );

            const stale =
                await this.redis.getJson<
                    MarketActivity[]
                >(
                    staleKey,
                );

            if (stale) {
                return stale;
            }

            throw new InternalServerErrorException({
                code:
                    "MARKET_ACTIVITY_UNAVAILABLE",

                message:
                    "Unable to load market activity from Arc.",
            });
        }
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



