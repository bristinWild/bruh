import {
    Module,
} from "@nestjs/common";

import {
    AgentsModule,
} from "../agents/agents.module";

import {
    SupabaseService,
} from "../supabase.service";

import {
    AutonomyController,
} from "./autonomy.controller";

import {
    AutonomyLockService,
} from "./autonomy-lock.service";

import {
    AutonomySchedulerService,
} from "./autonomy-scheduler.service";

import {
    AutonomyService,
} from "./autonomy.service";

import {
    MarketDiscoveryService,
} from "./market-discovery.service";

import { MarketsModule } from "src/markets/markets.module";

@Module({
    imports: [
        AgentsModule,
        MarketsModule,
    ],

    controllers: [
        AutonomyController,
    ],

    providers: [
        SupabaseService,
        AutonomyService,
        AutonomyLockService,
        MarketDiscoveryService,
        AutonomySchedulerService,
    ],

    exports: [
        AutonomyService,
    ],
})
export class AutonomyModule { }