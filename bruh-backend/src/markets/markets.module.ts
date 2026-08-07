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

import {
    MarketStreamService,
} from "./market-stream.service";

import {
    SupabaseService,
} from "../supabase.service";

@Module({
    controllers: [
        MarketsController,
    ],

    providers: [
        MarketsService,
        MarketActivityIndexerService,
        MarketActivitySchedulerService,
        MarketStreamService,
        SupabaseService,
    ],

    exports: [
        MarketsService,
    ],
})
export class MarketsModule { }