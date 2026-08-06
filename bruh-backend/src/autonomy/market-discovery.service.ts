import {
    Injectable,
    Logger,
} from "@nestjs/common";

import { MarketsService } from "src/markets/markets.service";

import type {
    MarketCandidate,
} from "./autonomy.types";

@Injectable()
export class MarketDiscoveryService {

    constructor(
        private readonly markets:
            MarketsService,
    ) { }
    private readonly logger =
        new Logger(
            MarketDiscoveryService.name,
        );

    async discoverOpenMarkets(
        limit = 10,
    ): Promise<MarketCandidate[]> {
        const safeLimit =
            Math.min(
                Math.max(
                    limit,
                    1,
                ),
                100,
            );

        try {
            const markets =
                await this.markets.findAll(
                    0,
                    100,
                );

            return markets
                .filter(
                    (market) =>
                        market.open &&
                        !market.resolved,
                )
                .slice(
                    0,
                    safeLimit,
                )
                .map(
                    (
                        market,
                    ): MarketCandidate => ({
                        address:
                            market.address,

                        question:
                            market.question,

                        closesAt:
                            market.closeTime,

                        yesPrice:
                            market.yesPrice,

                        noPrice:
                            market.noPrice,

                        liquidityUsdc:
                            market.collateralUsdc,
                    }),
                );
        } catch (error) {
            this.logger.warn(
                `Market discovery failed: ${error instanceof Error
                    ? error.message
                    : String(
                        error,
                    )
                }`,
            );

            return [];
        }
    }
}