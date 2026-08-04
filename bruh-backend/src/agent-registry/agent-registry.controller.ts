import {
    Body,
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Post,
    Query,
    Request,
    UseGuards,
    Delete,
    Patch,
} from "@nestjs/common";

import {
    JwtAuthGuard,
} from "../auth/jwt.guard";

import {
    AgentRegistryService,
} from "./agent-registry.service";

import type {
    CreateAgentListingDto,
    PublishAgentVersionDto,
} from "./agent-registry.types";

import {
    AgentInstallationService,
} from "./agent-installation.service";

import type {
    InstallAgentDto,
} from "./agent-registry.types";


import {
    CustomAgentRunnerService,
} from "../custom-agents/custom-agent-runner.service";

import type {
    RunInstalledAgentDto,
} from "./agent-registry.types";

@Controller("agent-registry")
export class AgentRegistryController {
    constructor(
        private readonly registry:
            AgentRegistryService,

        private readonly installations:
            AgentInstallationService,

        private readonly runner:
            CustomAgentRunnerService,
    ) { }

    @Get()
    listPublic(
        @Query("category")
        category?: string,

        @Query("tag")
        tag?: string,

        @Query("search")
        search?: string,

        @Query(
            "limit",
            new ParseIntPipe({
                optional: true,
            }),
        )
        limit?: number,

        @Query(
            "offset",
            new ParseIntPipe({
                optional: true,
            }),
        )
        offset?: number,
    ) {
        return this.registry
            .listPublicListings({
                category,
                tag,
                search,
                limit,
                offset,
            });
    }

    @Get("public/:slug")
    getPublic(
        @Param("slug")
        slug: string,
    ) {
        return this.registry
            .getPublicListing(
                slug,
            );
    }

    @UseGuards(JwtAuthGuard)
    @Get("mine")
    listMine(
        @Request()
        request: {
            user: {
                address: string;
            };
        },
    ) {
        return this.registry
            .listOwnedListings(
                request.user.address,
            );
    }

    @UseGuards(JwtAuthGuard)
    @Post()
    createListing(
        @Request()
        request: {
            user: {
                address: string;
            };
        },

        @Body()
        body:
            CreateAgentListingDto,
    ) {
        return this.registry
            .createListing({
                publisherAddress:
                    request.user.address,

                dto:
                    body,
            });
    }

    @UseGuards(JwtAuthGuard)
    @Get("installations/mine")
    listInstalled(
        @Request()
        request: {
            user: {
                address: string;
            };
        },
    ) {
        return this.installations
            .listInstalled(
                request.user.address,
            );
    }

    @UseGuards(JwtAuthGuard)
    @Post(":id/versions")
    publishVersion(
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
            PublishAgentVersionDto,
    ) {
        return this.registry
            .publishVersion({
                listingId:
                    id,

                publisherAddress:
                    request.user.address,

                dto:
                    body,
            });
    }

    @UseGuards(JwtAuthGuard)
    @Post(":id/install")
    install(
        @Param("id")
        listingId: string,

        @Request()
        request: {
            user: {
                address: string;
            };
        },

        @Body()
        body:
            InstallAgentDto,
    ) {
        return this.installations
            .install({
                listingId,

                userAddress:
                    request.user.address,

                dto:
                    body,
            });
    }



    @UseGuards(JwtAuthGuard)
    @Patch("installations/:id/enabled")
    setEnabled(
        @Param("id")
        installationId: string,

        @Request()
        request: {
            user: {
                address: string;
            };
        },

        @Body()
        body: {
            enabled: boolean;
        },
    ) {
        return this.installations
            .setEnabled({
                installationId,

                userAddress:
                    request.user.address,

                enabled:
                    body.enabled,
            });
    }

    @UseGuards(JwtAuthGuard)
    @Post("installations/:id/upgrade")
    upgrade(
        @Param("id")
        installationId: string,

        @Request()
        request: {
            user: {
                address: string;
            };
        },

        @Body()
        body: {
            version?: string;
        },
    ) {
        return this.installations
            .upgrade({
                installationId,

                userAddress:
                    request.user.address,

                version:
                    body.version,
            });
    }

    @UseGuards(JwtAuthGuard)
    @Delete("installations/:id")
    uninstall(
        @Param("id")
        installationId: string,

        @Request()
        request: {
            user: {
                address: string;
            };
        },
    ) {
        return this.installations
            .uninstall({
                installationId,

                userAddress:
                    request.user.address,
            });
    }

    @UseGuards(JwtAuthGuard)
    @Post("installations/:id/run")
    async runInstallation(
        @Param("id")
        installationId: string,

        @Request()
        request: {
            user: {
                address: string;
            };
        },

        @Body()
        body: RunInstalledAgentDto,
    ) {
        const resolved =
            await this.installations
                .getRunnableInstallation({
                    installationId,

                    userAddress:
                        request.user.address,
                });

        return this.runner.runInstallation({
            installation:
                resolved.installation,

            listing:
                resolved.listing,

            version:
                resolved.version,

            ownerAddress:
                request.user.address,

            dto:
                body,
        });
    }

    @UseGuards(JwtAuthGuard)
    @Get("installations/:id/runs")
    getInstallationRuns(
        @Param("id")
        installationId: string,

        @Request()
        request: {
            user: {
                address: string;
            };
        },

        @Query(
            "limit",
            new ParseIntPipe({
                optional: true,
            }),
        )
        limit?: number,
    ) {
        return this.installations
            .getInstallationRuns({
                installationId,

                userAddress:
                    request.user.address,

                limit,
            });
    }
}