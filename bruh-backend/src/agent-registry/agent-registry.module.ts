import {
    Module,
} from "@nestjs/common";

import {
    CustomAgentsModule,
} from "../custom-agents/custom-agents.module";

import {
    SupabaseService,
} from "../supabase.service";

import {
    AgentInstallationService,
} from "./agent-installation.service";

import {
    AgentRegistryController,
} from "./agent-registry.controller";

import {
    AgentRegistryService,
} from "./agent-registry.service";

@Module({
    imports: [
        CustomAgentsModule,
    ],

    controllers: [
        AgentRegistryController,
    ],

    providers: [
        SupabaseService,
        AgentRegistryService,
        AgentInstallationService,
    ],

    exports: [
        AgentRegistryService,
        AgentInstallationService,
    ],
})
export class AgentRegistryModule { }