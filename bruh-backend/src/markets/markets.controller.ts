import {
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Query,
    Body,
    Post,
    Sse,
} from "@nestjs/common";

import {
    MarketsService,
} from "./markets.service";

import {
    MarketStreamService,
} from "./market-stream.service";

@Controller("markets")
export class MarketsController {
    constructor(
        private readonly markets:
            MarketsService,

        private readonly marketStream:
            MarketStreamService,
    ) { }

    @Get()
    findAll(
        @Query(
            "offset",
            new ParseIntPipe({
                optional:
                    true,
            }),
        )
        offset = 0,

        @Query(
            "limit",
            new ParseIntPipe({
                optional:
                    true,
            }),
        )
        limit = 100,
    ) {
        return this.markets.findAll(
            offset,
            limit,
        );
    }

    @Get(":address/history")
    getHistory(
        @Param("address")
        address: string,
    ) {
        return this.markets
            .getPriceHistory(
                address,
            );
    }

    @Get(":address/activity")
    getActivity(
        @Param("address")
        address: string,
    ) {
        return this.markets
            .getActivity(
                address,
            );
    }

    @Post(
        ":address/activity/confirmed",
    )
    async addConfirmedActivity(
        @Param("address")
        address: string,

        @Body()
        body: {
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
    ) {
        return this.markets
            .addConfirmedActivity(
                address,
                body,
            );
    }

    @Sse(
        ":address/stream",
    )
    stream(
        @Param("address")
        address: string,
    ) {
        return this.marketStream
            .stream(
                address,
            );
    }

    @Get(
        ":address/stats",
    )
    stats(
        @Param("address")
        address: string,
    ) {
        return this.markets
            .getMarketStats(
                address,
            );
    }

    @Get(
        ":address/portfolio/:wallet",
    )
    portfolio(
        @Param("address")
        address: string,

        @Param("wallet")
        wallet: string,
    ) {
        return this.markets
            .getPortfolio(
                address,
                wallet,
            );
    }

    @Get(
        ":address/agents",
    )
    agentDecisions(
        @Param("address")
        address: string,

        @Query(
            "limit",
        )
        limit?: string,
    ) {
        return this.markets
            .getAgentDecisions(
                address,
                Number(
                    limit ??
                    20,
                ),
            );
    }

    @Get(":address")
    findOne(
        @Param("address")
        address: string,
    ) {
        return this.markets.findOne(
            address,
        );
    }


}