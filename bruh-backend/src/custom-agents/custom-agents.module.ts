import {
    Module,
} from "@nestjs/common";

import {
    SupabaseService,
} from "../supabase.service";

import {
    CustomAgentController,
} from "./custom-agent.controller";

import {
    CustomAgentRunnerService,
} from "./custom-agent-runner.service";

import {
    CustomAgentService,
} from "./custom-agent.service";

@Module({
    controllers: [
        CustomAgentController,
    ],

    providers: [
        SupabaseService,
        CustomAgentService,
        CustomAgentRunnerService,
    ],

    exports: [
        CustomAgentService,
        CustomAgentRunnerService,
    ],
})
export class CustomAgentsModule { }