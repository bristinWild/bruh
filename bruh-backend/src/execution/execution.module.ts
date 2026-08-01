import {
    Module,
} from "@nestjs/common";

import {
    CircleService,
} from "../circle.service";

import {
    SupabaseService,
} from "../supabase.service";

import {
    CircleMarketExecutor,
} from "./circle-market.executor";

import {
    ExecutionService,
} from "./execution.service";

import {
    ExecutionQueueService,
} from "./execution-queue.service";

@Module({
    providers: [
        CircleService,

        SupabaseService,

        CircleMarketExecutor,

        ExecutionService,
        ExecutionQueueService,
    ],

    exports: [
        CircleMarketExecutor,

        ExecutionService,
        ExecutionQueueService,
    ],
})
export class ExecutionModule { }