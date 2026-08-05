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
    PublicMarket,
} from "./markets.types";

const OUTCOMES = [
    "UNRESOLVED",
    "YES",
    "NO",
    "INVALID",
] as const;

@Injectable()
export class MarketsService {
    private readonly client;

    private readonly factoryAddress:
        Address;

    constructor(
        private readonly config:
            ConfigService,
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