import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from "@nestjs/common";

import {
    SupabaseService,
} from "../supabase.service";

import type {
    AgentInstallationRecord,
    AgentListingRecord,
    AgentVersionRecord,
    InstallAgentDto,
} from "./agent-registry.types";

@Injectable()
export class AgentInstallationService {
    constructor(
        private readonly supabase:
            SupabaseService,
    ) { }

    async install(input: {
        listingId: string;
        userAddress: string;
        dto: InstallAgentDto;
    }): Promise<AgentInstallationRecord> {
        const userAddress =
            input.userAddress.toLowerCase();

        const listing =
            await this.getInstallableListing(
                input.listingId,
            );

        const existing =
            await this.findInstallation({
                listingId:
                    listing.id,
                userAddress,
            });

        if (existing) {
            throw new ConflictException(
                "This agent is already installed.",
            );
        }

        const version =
            await this.resolveVersion({
                listing,
                requestedVersion:
                    input.dto.version,
            });

        if (
            input.dto.agentWalletId
        ) {
            await this.assertOwnedWallet({
                walletId:
                    input.dto.agentWalletId,
                userAddress,
            });
        }

        const now =
            new Date().toISOString();

        const {
            data,
            error,
        } =
            await this.supabase.db
                .from("agent_installations")
                .insert({
                    listing_id:
                        listing.id,

                    version_id:
                        version.id,

                    user_address:
                        userAddress,

                    agent_wallet_id:
                        input.dto
                            .agentWalletId ??
                        null,

                    enabled:
                        true,

                    auto_update:
                        input.dto
                            .autoUpdate ??
                        false,

                    pinned_version:
                        input.dto.version ??
                        null,

                    configuration:
                        input.dto
                            .configuration ??
                        {},

                    permissions:
                        input.dto
                            .permissions ??
                        {},

                    installed_at:
                        now,

                    updated_at:
                        now,
                })
                .select("*")
                .single();

        if (error || !data) {
            throw new Error(
                `Failed to install agent: ${error?.message}`,
            );
        }

        await this.incrementInstallCount(
            listing.id,
        );

        return data as AgentInstallationRecord;
    }

    async listInstalled(
        userAddress: string,
    ): Promise<
        Array<{
            installation:
            AgentInstallationRecord;

            listing:
            AgentListingRecord;

            version:
            AgentVersionRecord;
        }>
    > {
        const {
            data,
            error,
        } =
            await this.supabase.db
                .from("agent_installations")
                .select(`
                    *,
                    listing:agent_listings(*),
                    version:agent_versions(*)
                `)
                .eq(
                    "user_address",
                    userAddress
                        .toLowerCase(),
                )
                .order(
                    "installed_at",
                    {
                        ascending: false,
                    },
                );

        if (error) {
            throw new Error(
                `Failed to load installed agents: ${error.message}`,
            );
        }

        return (data ?? []).map((row) => {
            const {
                listing,
                version,
                ...installation
            } = row;

            return {
                installation:
                    installation as AgentInstallationRecord,

                listing:
                    listing as AgentListingRecord,

                version:
                    version as AgentVersionRecord,
            };
        });
    }

    async setEnabled(input: {
        installationId: string;
        userAddress: string;
        enabled: boolean;
    }): Promise<AgentInstallationRecord> {
        await this.getOwnedInstallation({
            installationId:
                input.installationId,
            userAddress:
                input.userAddress,
        });

        const {
            data,
            error,
        } =
            await this.supabase.db
                .from("agent_installations")
                .update({
                    enabled:
                        input.enabled,

                    updated_at:
                        new Date()
                            .toISOString(),
                })
                .eq(
                    "id",
                    input.installationId,
                )
                .select("*")
                .single();

        if (error || !data) {
            throw new Error(
                `Failed to update installation: ${error?.message}`,
            );
        }

        return data as AgentInstallationRecord;
    }

    async upgrade(input: {
        installationId: string;
        userAddress: string;
        version?: string;
    }): Promise<AgentInstallationRecord> {
        const installation =
            await this.getOwnedInstallation({
                installationId:
                    input.installationId,

                userAddress:
                    input.userAddress,
            });

        const {
            data:
            listingData,
            error:
            listingError,
        } =
            await this.supabase.db
                .from("agent_listings")
                .select("*")
                .eq(
                    "id",
                    installation
                        .listing_id,
                )
                .single();

        if (
            listingError ||
            !listingData
        ) {
            throw new NotFoundException(
                "Agent listing was not found.",
            );
        }

        const listing =
            listingData as
            AgentListingRecord;

        const version =
            await this.resolveVersion({
                listing,

                requestedVersion:
                    input.version,
            });

        const {
            data,
            error,
        } =
            await this.supabase.db
                .from("agent_installations")
                .update({
                    version_id:
                        version.id,

                    pinned_version:
                        input.version ??
                        null,

                    updated_at:
                        new Date()
                            .toISOString(),
                })
                .eq(
                    "id",
                    installation.id,
                )
                .select("*")
                .single();

        if (error || !data) {
            throw new Error(
                `Failed to upgrade agent installation: ${error?.message}`,
            );
        }

        return data as AgentInstallationRecord;
    }

    async uninstall(input: {
        installationId: string;
        userAddress: string;
    }): Promise<{
        deleted: true;
    }> {
        const installation =
            await this.getOwnedInstallation({
                installationId:
                    input.installationId,

                userAddress:
                    input.userAddress,
            });

        const {
            error,
        } =
            await this.supabase.db
                .from("agent_installations")
                .delete()
                .eq(
                    "id",
                    installation.id,
                );

        if (error) {
            throw new Error(
                `Failed to uninstall agent: ${error.message}`,
            );
        }

        await this.decrementInstallCount(
            installation.listing_id,
        );

        return {
            deleted: true,
        };
    }

    async getRunnableInstallation(input: {
        installationId: string;
        userAddress: string;
    }): Promise<{
        installation: AgentInstallationRecord;
        listing: AgentListingRecord;
        version: AgentVersionRecord;
    }> {
        const installation =
            await this.getOwnedInstallation({
                installationId:
                    input.installationId,

                userAddress:
                    input.userAddress,
            });

        if (!installation.enabled) {
            throw new BadRequestException(
                "This agent installation is disabled.",
            );
        }

        const {
            data: listingData,
            error: listingError,
        } =
            await this.supabase.db
                .from("agent_listings")
                .select("*")
                .eq(
                    "id",
                    installation.listing_id,
                )
                .eq(
                    "active",
                    true,
                )
                .single();

        if (
            listingError ||
            !listingData
        ) {
            throw new NotFoundException(
                "The installed agent listing is unavailable.",
            );
        }

        const listing =
            listingData as AgentListingRecord;

        const {
            data: versionData,
            error: versionError,
        } =
            await this.supabase.db
                .from("agent_versions")
                .select("*")
                .eq(
                    "id",
                    installation.version_id,
                )
                .eq(
                    "status",
                    "published",
                )
                .single();

        if (
            versionError ||
            !versionData
        ) {
            throw new NotFoundException(
                "The installed agent version is unavailable.",
            );
        }

        return {
            installation,
            listing,
            version:
                versionData as AgentVersionRecord,
        };
    }

    private async getInstallableListing(
        listingId: string,
    ): Promise<AgentListingRecord> {
        const {
            data,
            error,
        } =
            await this.supabase.db
                .from("agent_listings")
                .select("*")
                .eq(
                    "id",
                    listingId,
                )
                .eq(
                    "active",
                    true,
                )
                .single();

        if (error || !data) {
            throw new NotFoundException(
                "Agent listing was not found.",
            );
        }

        const listing =
            data as AgentListingRecord;

        const publicAndVerified =
            listing.visibility ===
            "public" &&
            listing
                .verification_status ===
            "verified";

        const unlistedAndVerified =
            listing.visibility ===
            "unlisted" &&
            listing
                .verification_status ===
            "verified";

        if (
            !publicAndVerified &&
            !unlistedAndVerified
        ) {
            throw new BadRequestException(
                "This agent listing is not available for installation.",
            );
        }

        if (!listing.latest_version) {
            throw new BadRequestException(
                "This listing has no published version.",
            );
        }

        return listing;
    }

    private async resolveVersion(input: {
        listing:
        AgentListingRecord;

        requestedVersion?: string;
    }): Promise<AgentVersionRecord> {
        const version =
            input.requestedVersion ??
            input.listing
                .latest_version;

        if (!version) {
            throw new BadRequestException(
                "No installable agent version is available.",
            );
        }

        const {
            data,
            error,
        } =
            await this.supabase.db
                .from("agent_versions")
                .select("*")
                .eq(
                    "listing_id",
                    input.listing.id,
                )
                .eq(
                    "version",
                    version,
                )
                .eq(
                    "status",
                    "published",
                )
                .single();

        if (error || !data) {
            throw new NotFoundException(
                `Published version ${version} was not found.`,
            );
        }

        return data as AgentVersionRecord;
    }

    private async findInstallation(input: {
        listingId: string;
        userAddress: string;
    }): Promise<AgentInstallationRecord | null> {
        const {
            data,
            error,
        } =
            await this.supabase.db
                .from("agent_installations")
                .select("*")
                .eq(
                    "listing_id",
                    input.listingId,
                )
                .eq(
                    "user_address",
                    input.userAddress,
                )
                .maybeSingle();

        if (error) {
            throw new Error(
                `Failed to check installation: ${error.message}`,
            );
        }

        return data as
            | AgentInstallationRecord
            | null;
    }

    private async getOwnedInstallation(input: {
        installationId: string;
        userAddress: string;
    }): Promise<AgentInstallationRecord> {
        const {
            data,
            error,
        } =
            await this.supabase.db
                .from("agent_installations")
                .select("*")
                .eq(
                    "id",
                    input.installationId,
                )
                .single();

        if (error || !data) {
            throw new NotFoundException(
                "Agent installation was not found.",
            );
        }

        const installation =
            data as AgentInstallationRecord;

        if (
            installation.user_address
                .toLowerCase() !==
            input.userAddress
                .toLowerCase()
        ) {
            throw new ForbiddenException(
                "You do not own this installation.",
            );
        }

        return installation;
    }

    private async assertOwnedWallet(input: {
        walletId: string;
        userAddress: string;
    }): Promise<void> {
        const {
            data,
            error,
        } =
            await this.supabase.db
                .from("agent_wallets")
                .select("id")
                .eq(
                    "id",
                    input.walletId,
                )
                .eq(
                    "user_address",
                    input.userAddress,
                )
                .single();

        if (error || !data) {
            throw new BadRequestException(
                "The selected agent wallet does not belong to this user.",
            );
        }
    }

    private async incrementInstallCount(
        listingId: string,
    ): Promise<void> {
        const listing =
            await this.getListingCount(
                listingId,
            );

        await this.supabase.db
            .from("agent_listings")
            .update({
                installation_count:
                    listing.installation_count +
                    1,

                updated_at:
                    new Date()
                        .toISOString(),
            })
            .eq(
                "id",
                listingId,
            );
    }

    private async decrementInstallCount(
        listingId: string,
    ): Promise<void> {
        const listing =
            await this.getListingCount(
                listingId,
            );

        await this.supabase.db
            .from("agent_listings")
            .update({
                installation_count:
                    Math.max(
                        listing.installation_count -
                        1,
                        0,
                    ),

                updated_at:
                    new Date()
                        .toISOString(),
            })
            .eq(
                "id",
                listingId,
            );
    }

    private async getListingCount(
        listingId: string,
    ): Promise<{
        installation_count: number;
    }> {
        const {
            data,
            error,
        } =
            await this.supabase.db
                .from("agent_listings")
                .select(
                    "installation_count",
                )
                .eq(
                    "id",
                    listingId,
                )
                .single();

        if (error || !data) {
            throw new Error(
                "Failed to load listing installation count.",
            );
        }

        return {
            installation_count:
                Number(
                    data.installation_count ??
                    0,
                ),
        };
    }

    async getInstallationRuns(input: {
        installationId: string;
        userAddress: string;
        limit?: number;
    }) {
        await this.getOwnedInstallation({
            installationId:
                input.installationId,

            userAddress:
                input.userAddress,
        });

        const safeLimit =
            Math.min(
                Math.max(
                    input.limit ?? 30,
                    1,
                ),
                100,
            );

        const {
            data,
            error,
        } =
            await this.supabase.db
                .from("agent_runs")
                .select("*")
                .eq(
                    "agent_installation_id",
                    input.installationId,
                )
                .order(
                    "created_at",
                    {
                        ascending: false,
                    },
                )
                .limit(
                    safeLimit,
                );

        if (error) {
            throw new Error(
                `Failed to load installation runs: ${error.message}`,
            );
        }

        return data ?? [];
    }
}