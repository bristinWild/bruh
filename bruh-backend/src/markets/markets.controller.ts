import {
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Query,
    Body,
    Post,
} from "@nestjs/common";

import {
    MarketsService,
} from "./markets.service";

@Controller("markets")
export class MarketsController {
    constructor(
        private readonly markets:
            MarketsService,
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