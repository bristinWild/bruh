import {
  Module,
} from "@nestjs/common";

import {
  ExecutionModule,
} from "../execution/execution.module";

import {
  SupabaseService,
} from "../supabase.service";

import {
  AgentsController,
} from "./agents.controller";

import {
  AgentRuntimeService,
} from "./agent-runtime.service";

@Module({
  imports: [
    ExecutionModule,
  ],

  providers: [
    SupabaseService,

    AgentRuntimeService,
  ],

  controllers: [
    AgentsController,
  ],

  exports: [
    AgentRuntimeService,
  ],
})
export class AgentsModule { }