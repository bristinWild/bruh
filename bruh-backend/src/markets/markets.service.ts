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
    MarketAgentDecision,
    MarketPortfolio,
    MarketPricePoint,
    MarketStats,
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

import {
    MarketStreamService,
} from "./market-stream.service";

import {
    SupabaseService,
} from "../supabase.service";



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

        private readonly marketStream:
            MarketStreamService,

        private readonly supabase:
            SupabaseService,
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

    async getMarketStats(
        address: string,
    ): Promise<MarketStats> {
        const market =
            await this.findOne(
                address,
            );

        const normalizedAddress =
            address.toLowerCase();

        const indexed =
            await this.redis.getJson<
                MarketActivity[]
            >(
                `market-activity:indexed:${normalizedAddress}`,
            ) ?? [];

        /*
         * Count total USDC exchanged.
         *
         * BUY:
         *   usdcAmount = amount entering market
         *
         * SELL:
         *   usdcAmount = amount leaving market
         *
         * For "trading volume", both sides
         * still count as traded notional.
         */
        const totalVolumeUsdc =
            indexed.reduce(
                (
                    total,
                    activity,
                ) =>
                    total +
                    activity.usdcAmount,
                0,
            );

        return {
            /*
             * Current collateral sitting
             * inside the market.
             *
             * This is liquidity, NOT volume.
             */
            liquidityUsdc:
                market.collateralUsdc,

            totalVolumeUsdc,

            yesPrice:
                market.yesPrice,

            noPrice:
                market.noPrice,

            yesShares:
                market.totalSharesYes,

            noShares:
                market.totalSharesNo,

            tradeCount:
                indexed.length,
        };
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

        this.marketStream
            .publishTrade(
                normalizedAddress,
                activity,
                "pending",
            );

        return activity;
    }

    async getPortfolio(
        address: string,
        wallet: string,
    ): Promise<MarketPortfolio> {
        if (
            !/^0x[a-fA-F0-9]{40}$/.test(
                address,
            ) ||
            !/^0x[a-fA-F0-9]{40}$/.test(
                wallet,
            )
        ) {
            throw new NotFoundException({
                code:
                    "INVALID_ADDRESS",

                message:
                    "Invalid market or wallet address.",
            });
        }

        const normalizedMarket =
            address.toLowerCase();

        const normalizedWallet =
            wallet.toLowerCase();

        const marketAddress =
            address as Address;

        const walletAddress =
            wallet as Address;

        const market =
            await this.findOne(
                address,
            );

        /*
         * ------------------------------------------------
         * 1. Read authoritative share balances on-chain
         * ------------------------------------------------
         *
         * These are the actual balances maintained
         * by Market.sol.
         */
        const [
            yesSharesRaw,
            noSharesRaw,
        ] =
            await Promise.all([
                this.client.readContract({
                    address:
                        marketAddress,

                    abi:
                        marketAbi,

                    functionName:
                        "sharesYes",

                    args: [
                        walletAddress,
                    ],
                }),

                this.client.readContract({
                    address:
                        marketAddress,

                    abi:
                        marketAbi,

                    functionName:
                        "sharesNo",

                    args: [
                        walletAddress,
                    ],
                }),
            ]);

        const yesShares =
            Number(
                formatUnits(
                    yesSharesRaw,
                    6,
                ),
            );

        const noShares =
            Number(
                formatUnits(
                    noSharesRaw,
                    6,
                ),
            );

        /*
         * ------------------------------------------------
         * 2. Get actual current exit value
         * ------------------------------------------------
         *
         * previewSell() uses the contract's CPMM
         * calculation and includes the sell fee.
         *
         * This is much more accurate than:
         *
         * shares * probability
         */
        const [
            yesPreview,
            noPreview,
        ] =
            await Promise.all([
                yesSharesRaw >
                    0n
                    ? this.client.readContract({
                        address:
                            marketAddress,

                        abi:
                            marketAbi,

                        functionName:
                            "previewSell",

                        args: [
                            true,
                            yesSharesRaw,
                        ],
                    })
                    : Promise.resolve(
                        [
                            0n,
                            0n,
                        ] as const,
                    ),

                noSharesRaw >
                    0n
                    ? this.client.readContract({
                        address:
                            marketAddress,

                        abi:
                            marketAbi,

                        functionName:
                            "previewSell",

                        args: [
                            false,
                            noSharesRaw,
                        ],
                    })
                    : Promise.resolve(
                        [
                            0n,
                            0n,
                        ] as const,
                    ),
            ]);

        const [
            yesUsdcOutRaw,
        ] =
            yesPreview;

        const [
            noUsdcOutRaw,
        ] =
            noPreview;

        const yesCurrentValue =
            Number(
                formatUnits(
                    yesUsdcOutRaw,
                    6,
                ),
            );

        const noCurrentValue =
            Number(
                formatUnits(
                    noUsdcOutRaw,
                    6,
                ),
            );

        /*
         * ------------------------------------------------
         * 3. Use indexed history for cost accounting
         * ------------------------------------------------
         *
         * Blockchain balances tell us WHAT the user owns.
         *
         * Indexed trade history tells us HOW MUCH
         * they paid for it.
         */
        const indexed =
            await this.redis.getJson<
                MarketActivity[]
            >(
                `market-activity:indexed:${normalizedMarket}`,
            ) ?? [];

        const trades =
            indexed
                .filter(
                    (
                        activity,
                    ) =>
                        activity.trader
                            .toLowerCase() ===
                        normalizedWallet,
                )
                .sort(
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

                        return (
                            first.timestamp.localeCompare(
                                second.timestamp,
                            )
                        );
                    },
                );

        type CostState = {
            shares:
            number;

            costBasis:
            number;

            realizedPnl:
            number;
        };

        const yesCost:
            CostState = {
            shares:
                0,

            costBasis:
                0,

            realizedPnl:
                0,
        };

        const noCost:
            CostState = {
            shares:
                0,

            costBasis:
                0,

            realizedPnl:
                0,
        };

        for (
            const trade
            of trades
        ) {
            const state =
                trade.side ===
                    "YES"
                    ? yesCost
                    : noCost;

            if (
                trade.action ===
                "BUY"
            ) {
                state.shares +=
                    trade.shares;

                state.costBasis +=
                    trade.usdcAmount;

                continue;
            }

            /*
             * SELL:
             * remove cost basis using weighted
             * average acquisition cost.
             */
            if (
                state.shares <=
                0
            ) {
                continue;
            }

            const averageCost =
                state.costBasis /
                state.shares;

            const sharesSold =
                Math.min(
                    trade.shares,
                    state.shares,
                );

            const removedCost =
                sharesSold *
                averageCost;

            state.shares -=
                sharesSold;

            state.costBasis -=
                removedCost;

            state.realizedPnl +=
                trade.usdcAmount -
                removedCost;

            if (
                state.shares <
                0.000001
            ) {
                state.shares =
                    0;

                state.costBasis =
                    0;
            }
        }
        const buildPosition = (
            side:
                "YES"
                | "NO",

            authoritativeShares:
                number,

            state:
                CostState,

            currentValueUsdc:
                number,

            currentPrice:
                number,
        ) => {
            /*
             * Cost basis should normally correspond
             * to the authoritative balance once the
             * indexer is caught up.
             */
            const costBasis =
                state.costBasis;

            /*
             * Acquisition cost per CPMM share.
             *
             * Note: this is NOT necessarily the same
             * thing as implied probability.
             */
            const avgEntry =
                authoritativeShares >
                    0 &&
                    costBasis >
                    0
                    ? costBasis /
                    authoritativeShares
                    : 0;

            const unrealizedPnlUsdc =
                currentValueUsdc -
                costBasis;

            const unrealizedPnlPercent =
                costBasis >
                    0
                    ? (
                        unrealizedPnlUsdc /
                        costBasis
                    ) *
                    100
                    : 0;

            return {
                side,

                shares:
                    authoritativeShares,

                avgEntry,

                currentPrice,

                costBasisUsdc:
                    costBasis,

                currentValueUsdc,

                unrealizedPnlUsdc,

                unrealizedPnlPercent,

                realizedPnlUsdc:
                    state.realizedPnl,
            };
        };

        const yesPosition =
            buildPosition(
                "YES",

                yesShares,

                yesCost,

                yesCurrentValue,

                market.yesPrice,
            );

        const noPosition =
            buildPosition(
                "NO",

                noShares,

                noCost,

                noCurrentValue,

                market.noPrice,
            );

        return {
            marketAddress:
                market.address,

            wallet:
                walletAddress,

            yes:
                yesPosition,

            no:
                noPosition,

            totalCurrentValueUsdc:
                yesPosition
                    .currentValueUsdc +
                noPosition
                    .currentValueUsdc,

            totalUnrealizedPnlUsdc:
                yesPosition
                    .unrealizedPnlUsdc +
                noPosition
                    .unrealizedPnlUsdc,

            totalRealizedPnlUsdc:
                yesPosition
                    .realizedPnlUsdc +
                noPosition
                    .realizedPnlUsdc,
        };
    }


    async getAgentDecisions(
        address: string,
        limit =
            20,
    ): Promise<MarketAgentDecision[]> {
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

        const safeLimit =
            Math.min(
                Math.max(
                    limit,
                    1,
                ),
                50,
            );

        const {
            data,
            error,
        } =
            await this.supabase.db
                .from(
                    "agent_runs",
                )
                .select(`
                id,
                agent_wallet_id,
                agent_id,
                profile_id,
                market_address,
                market_question,
                status,
                research,
                estimate,
                decision,
                execution_receipt_id,
                created_at,
                completed_at,
                agent_wallets (
                    agent_name
                ),
                execution_receipts (
                    trade_transaction_hash
                )
            `)
                .eq(
                    "market_address",
                    address.toLowerCase(),
                )
                .order(
                    "created_at",
                    {
                        ascending:
                            false,
                    },
                )
                .limit(
                    safeLimit,
                );

        if (error) {
            throw new Error(
                `Failed to load market agent decisions: ${error.message}`,
            );
        }

        return (
            data ?? []
        )
            .filter(
                (
                    row,
                ) =>
                    row.decision,
            )
            .map(
                (
                    row,
                ) => {
                    const decision =
                        row.decision as {
                            action?:
                            | "BUY_YES"
                            | "BUY_NO"
                            | "PASS";

                            probability?:
                            number;

                            marketProbability?:
                            number;

                            edge?:
                            number;

                            confidence?:
                            number;

                            amountUsdc?:
                            number;

                            reasoning?:
                            string;
                        };

                    const estimate =
                        row.estimate as {
                            keyFactors?:
                            string[];

                            risks?:
                            string[];
                        } | null;

                    const research =
                        row.research as {
                            summary?:
                            string;
                        } | null;

                    const walletRelation =
                        Array.isArray(
                            row.agent_wallets,
                        )
                            ? row
                                .agent_wallets[
                            0
                            ]
                            : row.agent_wallets;

                    const receiptRelation =
                        Array.isArray(
                            row.execution_receipts,
                        )
                            ? row
                                .execution_receipts[
                            0
                            ]
                            : row.execution_receipts;

                    return {
                        id:
                            row.id,

                        agentWalletId:
                            row.agent_wallet_id,

                        agentId:
                            row.agent_id ??
                            null,

                        agentName:
                            walletRelation
                                ?.agent_name ??
                            null,

                        profileId:
                            row.profile_id,

                        marketAddress:
                            row.market_address,

                        marketQuestion:
                            row.market_question,

                        status:
                            row.status,

                        action:
                            decision.action ??
                            "PASS",

                        probability:
                            Number(
                                decision.probability ??
                                0.5,
                            ),

                        marketProbability:
                            Number(
                                decision.marketProbability ??
                                0.5,
                            ),

                        edge:
                            Number(
                                decision.edge ??
                                0,
                            ),

                        confidence:
                            Number(
                                decision.confidence ??
                                0,
                            ),

                        amountUsdc:
                            Number(
                                decision.amountUsdc ??
                                0,
                            ),

                        reasoning:
                            decision.reasoning ??
                            "No reasoning supplied.",

                        researchSummary:
                            research?.summary ??
                            null,

                        keyFactors:
                            estimate
                                ?.keyFactors ??
                            [],

                        risks:
                            estimate
                                ?.risks ??
                            [],

                        transactionHash:
                            receiptRelation
                                ?.trade_transaction_hash ??
                            null,

                        createdAt:
                            row.created_at,

                        completedAt:
                            row.completed_at ??
                            null,
                    };
                },
            );
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



