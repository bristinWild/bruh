import {
    Body,
    Controller,
    Get,
    Param,
    Post,
    Query,
    Request,
    UseGuards,
} from "@nestjs/common";

import {
    JwtAuthGuard,
} from "../auth/jwt.guard";

import {
    AgentRuntimeService,
} from "./agent-runtime.service";

import type {
    RunAgentDto,
} from "./dto/run-agent.dto";

@Controller("agents")
@UseGuards(JwtAuthGuard)
export class AgentsController {
    constructor(
        private readonly runtime:
            AgentRuntimeService,
    ) { }

    @Post(":id/run")
    run(
        @Param("id")
        walletId: string,

        @Request()
        request: {
            user: {
                address: string;
            };
        },

        @Body()
        body: RunAgentDto,
    ) {
        return this.runtime.run({
            walletId,

            userAddress:
                request.user.address,

            marketAddress:
                body.marketAddress,

            autoExecute:
                body.autoExecute ??
                false,
        });
    }

    @Get(":id/runs")
    listRuns(
        @Param("id")
        walletId: string,

        @Request()
        request: {
            user: {
                address: string;
            };
        },

        @Query("limit")
        limit?: string,
    ) {
        return this.runtime.getRuns({
            walletId,

            userAddress:
                request.user.address,

            limit:
                limit
                    ? Number(limit)
                    : 20,
        });
    }

    @Get("runs/:runId")
    getRun(
        @Param("runId")
        runId: string,

        @Request()
        request: {
            user: {
                address: string;
            };
        },
    ) {
        return this.runtime.getRun({
            runId,

            userAddress:
                request.user.address,
        });
    }
}