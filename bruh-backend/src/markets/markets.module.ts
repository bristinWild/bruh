import {
    Module,
} from "@nestjs/common";

import {
    MarketsController,
} from "./markets.controller";

import {
    MarketsService,
} from "./markets.service";

import {
    MarketActivityIndexerService,
} from "./market-activity-indexer.service";

import {
    MarketActivitySchedulerService,
} from "./market-activity-scheduler.service";

@Module({
    controllers: [
        MarketsController,
    ],

    providers: [
        MarketsService,
        MarketActivityIndexerService,
        MarketActivitySchedulerService,
    ],

    exports: [
        MarketsService,
    ],
})
export class MarketsModule { }