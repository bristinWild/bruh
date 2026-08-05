import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { SupabaseService } from 'src/supabase.service';
import { AuthController } from 'src/auth/auth.controller';
import { WalletsController } from 'src/wallets/wallets.controller';
import { CircleService } from 'src/circle.service';
import { AuthService } from 'src/auth/auth.service';
import { JwtStrategy } from 'src/auth/jwt.strategy';
import { WalletsService } from 'src/wallets/wallets.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { WalletsModule } from './wallets/wallets.module';
import { AgentsModule } from './agents/agents.module';
import { TradesModule } from './trades/trades.module';
import { ExecutionModule } from 'src/execution/execution.module';
import {
  ScheduleModule,
} from "@nestjs/schedule";

import {
  AutonomyModule,
} from "./autonomy/autonomy.module";
import { CustomAgentsModule } from 'src/custom-agents/custom-agents.module';

import {
  AgentRegistryModule,
} from "./agent-registry/agent-registry.module";

import {
  MarketsModule,
} from "./markets/markets.module";


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
    ExecutionModule,
    AgentsModule,
    AutonomyModule,
    CustomAgentsModule,
    AgentRegistryModule,
    MarketsModule,
  ],
  controllers: [AuthController, WalletsController],
  providers: [
    SupabaseService,
    CircleService,
    AuthService,
    JwtStrategy,
    WalletsService,
  ],
})
export class AppModule { }
