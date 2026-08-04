import {
    Injectable,
    Logger,
} from "@nestjs/common";

import {
    createPublicClient,
    http,
} from "viem";

import type {
    MarketCandidate,
} from "./autonomy.types";

const MARKET_FACTORY_ABI = [
    {
        name: "marketCount",
        type: "function",
        inputs: [],
        outputs: [
            {
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "view",
    },
    {
        name: "getMarkets",
        type: "function",
        inputs: [
            {
                name: "offset",
                type: "uint256",
            },
            {
                name: "limit",
                type: "uint256",
            },
        ],
        outputs: [
            {
                name: "result",
                type: "address[]",
            },
        ],
        stateMutability: "view",
    },
] as const;

const MARKET_ABI = [
    {
        name: "summary",
        type: "function",
        inputs: [],
        outputs: [
            {
                name: "question",
                type: "string",
            },
            {
                name: "closeTime",
                type: "uint256",
            },
            {
                name: "currentOutcome",
                type: "uint8",
            },
            {
                name: "yesPriceWad",
                type: "uint256",
            },
            {
                name: "noPriceWad",
                type: "uint256",
            },
            {
                name: "totalCollateral",
                type: "uint256",
            },
            {
                name: "yesShares",
                type: "uint256",
            },
            {
                name: "noShares",
                type: "uint256",
            },
            {
                name: "open",
                type: "bool",
            },
            {
                name: "resolved",
                type: "bool",
            },
        ],
        stateMutability: "view",
    },
] as const;

@Injectable()
export class MarketDiscoveryService {
    private readonly logger =
        new Logger(
            MarketDiscoveryService.name,
        );

    private readonly client =
        createPublicClient({
            transport: http(
                process.env.ARC_RPC_URL,
            ),
        });

    private readonly factoryAddress =
        process.env
            .MARKET_FACTORY_ADDRESS as
        | `0x${string}`
        | undefined;

    async discoverOpenMarkets(
        limit = 10,
    ): Promise<MarketCandidate[]> {
        if (!this.factoryAddress) {
            throw new Error(
                "MARKET_FACTORY_ADDRESS is not configured.",
            );
        }

        const totalMarkets =
            await this.client.readContract({
                address:
                    this.factoryAddress,

                abi:
                    MARKET_FACTORY_ABI,

                functionName:
                    "marketCount",
            });

        const count =
            Number(totalMarkets);

        if (count === 0) {
            return [];
        }

        const pageSize =
            Math.min(
                Math.max(limit, 1),
                100,
            );

        const offset =
            Math.max(
                count - pageSize,
                0,
            );

        const selected =
            await this.client.readContract({
                address:
                    this.factoryAddress,

                abi:
                    MARKET_FACTORY_ABI,

                functionName:
                    "getMarkets",

                args: [
                    BigInt(offset),
                    BigInt(pageSize),
                ],
            });


        const results =
            await Promise.allSettled(
                selected.map(
                    async (
                        address,
                    ): Promise<MarketCandidate | null> => {
                        const summary =
                            await this.client.readContract({
                                address,

                                abi:
                                    MARKET_ABI,

                                functionName:
                                    "summary",
                            });

                        const [
                            question,
                            closeTime,
                            ,
                            yesPriceWad,
                            noPriceWad,
                            totalCollateral,
                            ,
                            ,
                            open,
                            resolved,
                        ] = summary;

                        if (
                            !open ||
                            resolved
                        ) {
                            return null;
                        }

                        return {
                            address,

                            question,

                            closesAt:
                                new Date(
                                    Number(
                                        closeTime,
                                    ) *
                                    1_000,
                                ).toISOString(),

                            yesPrice:
                                Number(
                                    yesPriceWad,
                                ) /
                                1e18,

                            noPrice:
                                Number(
                                    noPriceWad,
                                ) /
                                1e18,

                            liquidityUsdc:
                                Number(
                                    totalCollateral,
                                ) /
                                1e6,
                        };
                    },
                ),
            );

        return results.flatMap(
            (result) => {
                if (
                    result.status ===
                    "fulfilled" &&
                    result.value
                ) {
                    return [
                        result.value,
                    ];
                }

                if (
                    result.status ===
                    "rejected"
                ) {
                    this.logger.warn(
                        `Market discovery failed: ${String(
                            result.reason,
                        )}`,
                    );
                }

                return [];
            },
        );
    }
}