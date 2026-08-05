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
                            Math.min(
                                Math.max(limit, 1),
                                100,
                            ),
                        ),
                    ],
                });

            const markets =
                await Promise.all(
                    addresses.map(
                        (address) =>
                            this.readMarket(
                                address,
                            ),
                    ),
                );

            return markets.sort(
                (first, second) =>
                    first.closeTimeUnix -
                    second.closeTimeUnix,
            );
        } catch (error) {
            console.error(
                "Failed to load markets:",
                error,
            );

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

        return this.readMarket(
            marketAddress,
        );
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



