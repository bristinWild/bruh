import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Request,
    UseGuards,
} from "@nestjs/common";

import {
    JwtAuthGuard,
} from "../auth/jwt.guard";

import {
    CustomAgentService,
} from "./custom-agent.service";

import type {
    RegisterCustomAgentDto,
    UpdateCustomAgentDto,
} from "./custom-agent.types";

import type {
    RunCustomAgentDto,
} from "./custom-agent-run.types";

import {
    CustomAgentRunnerService,
} from "../custom-agents/custom-agent-runner.service";


@Controller("custom-agents")
@UseGuards(JwtAuthGuard)
export class CustomAgentController {
    constructor(
        private readonly customAgents:
            CustomAgentService,
        private readonly runner:
            CustomAgentRunnerService,

    ) { }

    @Post()
    register(
        @Request()
        request: {
            user: {
                address: string;
            };
        },

        @Body()
        body:
            RegisterCustomAgentDto,
    ) {
        return this.customAgents
            .register({
                ownerAddress:
                    request.user.address,

                dto:
                    body,
            });
    }

    @Get()
    list(
        @Request()
        request: {
            user: {
                address: string;
            };
        },
    ) {
        return this.customAgents
            .listOwned(
                request.user.address,
            );
    }

    @Get(":id")
    get(
        @Param("id")
        id: string,

        @Request()
        request: {
            user: {
                address: string;
            };
        },
    ) {
        return this.customAgents
            .getOwned({
                id,

                ownerAddress:
                    request.user.address,
            });
    }

    @Patch(":id")
    update(
        @Param("id")
        id: string,

        @Request()
        request: {
            user: {
                address: string;
            };
        },

        @Body()
        body:
            UpdateCustomAgentDto,
    ) {
        return this.customAgents
            .update({
                id,

                ownerAddress:
                    request.user.address,

                dto:
                    body,
            });
    }

    @Delete(":id")
    remove(
        @Param("id")
        id: string,

        @Request()
        request: {
            user: {
                address: string;
            };
        },
    ) {
        return this.customAgents
            .remove({
                id,

                ownerAddress:
                    request.user.address,
            });
    }

    @Post(":id/verify")
    verify(
        @Param("id")
        id: string,

        @Request()
        request: {
            user: {
                address: string;
            };
        },
    ) {
        return this.customAgents
            .verify({
                id,

                ownerAddress:
                    request.user.address,
            });
    }

    @Post(":id/run")
    run(
        @Param("id")
        id: string,

        @Request()
        request: {
            user: {
                address: string;
            };
        },

        @Body()
        body:
            RunCustomAgentDto,
    ) {
        return this.runner.run({
            customAgentId:
                id,

            ownerAddress:
                request.user.address,

            dto:
                body,
        });
    }
}