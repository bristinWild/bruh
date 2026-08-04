import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Request,
    UseGuards,
} from "@nestjs/common";

import {
    JwtAuthGuard,
} from "../auth/jwt.guard";

import { AutonomyService } from "src/autonomy/autonomy.service";

import type {
    UpdateAutonomyConfigDto,
} from "./autonomy.types";

@Controller("agents")
@UseGuards(JwtAuthGuard)
export class AutonomyController {
    constructor(
        private readonly autonomy:
            AutonomyService,
    ) { }

    @Get(":id/autonomy")
    getConfig(
        @Param("id")
        walletId: string,

        @Request()
        request: {
            user: {
                address: string;
            };
        },
    ) {
        return this.autonomy
            .getConfig({
                walletId,

                userAddress:
                    request.user.address,
            });
    }

    @Patch(":id/autonomy")
    updateConfig(
        @Param("id")
        walletId: string,

        @Request()
        request: {
            user: {
                address: string;
            };
        },

        @Body()
        body:
            UpdateAutonomyConfigDto,
    ) {
        return this.autonomy
            .updateConfig({
                walletId,

                userAddress:
                    request.user.address,

                config:
                    body,
            });
    }
}