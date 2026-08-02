import { Module } from '@nestjs/common';

import { ExecutionModule } from '../execution/execution.module';

import { SupabaseService } from '../supabase.service';

import { AgentsController } from './agents.controller';

import { AgentRuntimeService } from './agent-runtime.service';

import { ConsensusService } from './consensus.service';

@Module({
  imports: [ExecutionModule],

  providers: [SupabaseService, ConsensusService, AgentRuntimeService],

  controllers: [AgentsController],

  exports: [AgentRuntimeService, ConsensusService],
})
export class AgentsModule {}
