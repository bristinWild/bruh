import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    InternalServerErrorException,
    NotFoundException,
} from "@nestjs/common";

import {
    SupabaseService,
} from "../supabase.service";

import type {
    UpdateAutonomyConfigDto,
} from "./autonomy.types";

@Injectable()
export class AutonomyService {
    constructor(
        private readonly supabase:
            SupabaseService,
    ) { }

    async getConfig(input: {
        walletId: string;
        userAddress: string;
    }) {
        const wallet =
            await this.getOwnedWallet(
                input.walletId,
                input.userAddress,
            );

        return {
            autonomousEnabled:
                wallet.autonomous_enabled,

            scheduleIntervalMinutes:
                wallet.schedule_interval_minutes,

            autoResearch:
                wallet.auto_research,

            autoTrade:
                wallet.auto_trade,

            marketScanLimit:
                wallet.market_scan_limit,

            lastScheduledRunAt:
                wallet.last_scheduled_run_at,
        };
    }

    async updateConfig(input: {
        walletId: string;
        userAddress: string;
        config:
        UpdateAutonomyConfigDto;
    }) {
        await this.getOwnedWallet(
            input.walletId,
            input.userAddress,
        );

        const interval =
            input.config
                .scheduleIntervalMinutes;

        if (
            interval !== undefined &&
            (interval < 1 ||
                interval > 1440)
        ) {
            throw new BadRequestException(
                "scheduleIntervalMinutes must be between 1 and 1440.",
            );
        }

        const scanLimit =
            input.config
                .marketScanLimit;

        if (
            scanLimit !== undefined &&
            (scanLimit < 1 ||
                scanLimit > 100)
        ) {
            throw new BadRequestException(
                "marketScanLimit must be between 1 and 100.",
            );
        }

        const updates: Record<
            string,
            unknown
        > = {
            updated_at:
                new Date()
                    .toISOString(),
        };

        if (
            input.config
                .autonomousEnabled !==
            undefined
        ) {
            updates.autonomous_enabled =
                input.config
                    .autonomousEnabled;
        }

        if (
            interval !== undefined
        ) {
            updates.schedule_interval_minutes =
                interval;
        }

        if (
            input.config.autoResearch !==
            undefined
        ) {
            updates.auto_research =
                input.config
                    .autoResearch;
        }

        if (
            input.config.autoTrade !==
            undefined
        ) {
            updates.auto_trade =
                input.config
                    .autoTrade;
        }

        if (
            scanLimit !== undefined
        ) {
            updates.market_scan_limit =
                scanLimit;
        }

        const {
            data,
            error,
        } =
            await this.supabase.db
                .from(
                    "agent_wallets",
                )
                .update(updates)
                .eq(
                    "id",
                    input.walletId,
                )
                .select("*")
                .single();

        if (error) {
            console.error(
                "Autonomy configuration update failed:",
                error,
            );

            throw new InternalServerErrorException(
                `Failed to update autonomy configuration: ${error.message}`,
            );
        }

        if (!data) {
            throw new NotFoundException(
                "Agent wallet was not found after updating autonomy configuration.",
            );
        }

        return data;
    }

    private async getOwnedWallet(
        walletId: string,
        userAddress: string,
    ) {
        const {
            data,
            error,
        } =
            await this.supabase.db
                .from(
                    "agent_wallets",
                )
                .select("*")
                .eq(
                    "id",
                    walletId,
                )
                .single();

        if (
            error ||
            !data
        ) {
            throw new NotFoundException(
                "Agent wallet was not found.",
            );
        }

        if (
            data.user_address
                .toLowerCase() !==
            userAddress.toLowerCase()
        ) {
            throw new ForbiddenException(
                "You do not own this agent wallet.",
            );
        }

        return data;
    }
}