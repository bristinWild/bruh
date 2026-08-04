import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from "@nestjs/common";

import {
    createHash,
} from "node:crypto";

import {
    validateAgentManifest,
} from "@bruhmarket/agent-sdk";

import {
    SupabaseService,
} from "../supabase.service";

import type {
    CustomAgentRecord,
} from "../custom-agents/custom-agent.types";

import type {
    AgentListingRecord,
    AgentVersionRecord,
    CreateAgentListingDto,
    PublishAgentVersionDto,
} from "./agent-registry.types";

@Injectable()
export class AgentRegistryService {
    constructor(
        private readonly supabase:
            SupabaseService,
    ) { }

    async createListing(input: {
        publisherAddress: string;
        dto: CreateAgentListingDto;
    }): Promise<AgentListingRecord> {
        const publisherAddress =
            input.publisherAddress.toLowerCase();

        const customAgent =
            await this.getOwnedCustomAgent({
                customAgentId:
                    input.dto.customAgentId,

                publisherAddress,
            });

        if (
            customAgent.verification_status !==
            "verified"
        ) {
            throw new BadRequestException(
                "The custom agent must be verified before creating a listing.",
            );
        }

        if (!customAgent.active) {
            throw new BadRequestException(
                "The custom agent must be active before creating a listing.",
            );
        }

        const slug =
            this.normalizeSlug(
                input.dto.slug,
            );

        const name =
            this.requireNonEmptyString(
                input.dto.name,
                "name",
            );

        const shortDescription =
            this.requireNonEmptyString(
                input.dto.shortDescription,
                "shortDescription",
            );

        if (
            shortDescription.length >
            240
        ) {
            throw new BadRequestException(
                "shortDescription must not exceed 240 characters.",
            );
        }

        const existingSlug =
            await this.findListingBySlug(
                slug,
            );

        if (existingSlug) {
            throw new ConflictException(
                `The listing slug "${slug}" is already in use.`,
            );
        }

        const now =
            new Date().toISOString();

        const {
            data,
            error,
        } =
            await this.supabase.db
                .from("agent_listings")
                .insert({
                    custom_agent_id:
                        customAgent.id,

                    publisher_address:
                        publisherAddress,

                    slug,

                    name,

                    short_description:
                        shortDescription,

                    long_description:
                        input.dto
                            .longDescription ??
                        null,

                    categories:
                        this.normalizeStringArray(
                            input.dto.categories,
                        ),

                    tags:
                        this.normalizeStringArray(
                            input.dto.tags,
                        ),

                    icon_url:
                        this.normalizeOptionalUrl(
                            input.dto.iconUrl,
                            "iconUrl",
                        ),

                    banner_url:
                        this.normalizeOptionalUrl(
                            input.dto.bannerUrl,
                            "bannerUrl",
                        ),

                    visibility:
                        input.dto.visibility ??
                        "private",

                    verification_status:
                        "pending",

                    latest_version:
                        null,

                    installation_count:
                        0,

                    rating_count:
                        0,

                    active:
                        true,

                    created_at:
                        now,

                    updated_at:
                        now,
                })
                .select("*")
                .single();

        if (error || !data) {
            throw new Error(
                `Failed to create agent listing: ${error?.message}`,
            );
        }

        return data as AgentListingRecord;
    }

    async publishVersion(input: {
        listingId: string;
        publisherAddress: string;
        dto: PublishAgentVersionDto;
    }): Promise<AgentVersionRecord> {
        const listing =
            await this.getOwnedListing({
                listingId:
                    input.listingId,

                publisherAddress:
                    input.publisherAddress,
            });

        const customAgent =
            await this.getCustomAgentById(
                listing.custom_agent_id,
            );

        if (
            customAgent.verification_status !==
            "verified"
        ) {
            throw new BadRequestException(
                "The custom agent must be verified before publishing a version.",
            );
        }

        if (!customAgent.active) {
            throw new BadRequestException(
                "The custom agent must be active before publishing a version.",
            );
        }

        const version =
            this.normalizeVersion(
                input.dto.version,
            );

        if (
            version !==
            customAgent.manifest.version
        ) {
            throw new BadRequestException(
                `Published version "${version}" must match the custom agent manifest version "${customAgent.manifest.version}".`,
            );
        }

        const validation =
            validateAgentManifest(
                customAgent.manifest,
            );

        if (!validation.valid) {
            throw new BadRequestException({
                message:
                    "The custom agent manifest is invalid.",

                errors:
                    validation.errors,
            });
        }

        const existingVersion =
            await this.findVersion({
                listingId:
                    listing.id,

                version,
            });

        if (existingVersion) {
            throw new ConflictException(
                `Version ${version} has already been published for this listing.`,
            );
        }

        const publishedAt =
            new Date().toISOString();

        const checksum =
            this.createVersionChecksum({
                manifest:
                    customAgent.manifest,

                endpointUrl:
                    customAgent.endpoint_url,

                protocolVersion:
                    customAgent.protocol_version,

                signingPublicKey:
                    customAgent.signing_public_key,
            });

        const {
            data,
            error,
        } =
            await this.supabase.db
                .from("agent_versions")
                .insert({
                    listing_id:
                        listing.id,

                    version,

                    manifest:
                        customAgent.manifest,

                    endpoint_url:
                        customAgent.endpoint_url,

                    protocol_version:
                        customAgent.protocol_version,

                    signing_public_key:
                        customAgent
                            .signing_public_key,

                    release_notes:
                        input.dto
                            .releaseNotes ??
                        null,

                    checksum,

                    status:
                        "published",

                    published_at:
                        publishedAt,

                    created_at:
                        publishedAt,
                })
                .select("*")
                .single();

        if (error || !data) {
            throw new Error(
                `Failed to publish agent version: ${error?.message}`,
            );
        }

        const {
            error:
            listingUpdateError,
        } =
            await this.supabase.db
                .from("agent_listings")
                .update({
                    latest_version:
                        version,

                    updated_at:
                        publishedAt,
                })
                .eq(
                    "id",
                    listing.id,
                );

        if (listingUpdateError) {
            // Best-effort cleanup because publishing should
            // not leave a version without updating the listing.
            await this.supabase.db
                .from("agent_versions")
                .delete()
                .eq(
                    "id",
                    data.id,
                );

            throw new Error(
                `Failed to update listing version: ${listingUpdateError.message}`,
            );
        }

        return data as AgentVersionRecord;
    }

    async listPublicListings(input?: {
        category?: string;
        tag?: string;
        search?: string;
        limit?: number;
        offset?: number;
    }): Promise<AgentListingRecord[]> {
        const limit =
            Math.min(
                Math.max(
                    input?.limit ??
                    20,
                    1,
                ),
                100,
            );

        const offset =
            Math.max(
                input?.offset ??
                0,
                0,
            );

        let query =
            this.supabase.db
                .from("agent_listings")
                .select("*")
                .eq(
                    "visibility",
                    "public",
                )
                .eq(
                    "verification_status",
                    "verified",
                )
                .eq(
                    "active",
                    true,
                )
                .not(
                    "latest_version",
                    "is",
                    null,
                );

        if (input?.category) {
            query =
                query.contains(
                    "categories",
                    [
                        input.category
                            .trim()
                            .toLowerCase(),
                    ],
                );
        }

        if (input?.tag) {
            query =
                query.contains(
                    "tags",
                    [
                        input.tag
                            .trim()
                            .toLowerCase(),
                    ],
                );
        }

        if (
            input?.search?.trim()
        ) {
            const search =
                input.search
                    .trim()
                    .replace(
                        /[%_,]/g,
                        "",
                    );

            query =
                query.or(
                    `name.ilike.%${search}%,short_description.ilike.%${search}%,slug.ilike.%${search}%`,
                );
        }

        const {
            data,
            error,
        } =
            await query
                .order(
                    "installation_count",
                    {
                        ascending:
                            false,
                    },
                )
                .order(
                    "created_at",
                    {
                        ascending:
                            false,
                    },
                )
                .range(
                    offset,
                    offset +
                    limit -
                    1,
                );

        if (error) {
            throw new Error(
                `Failed to load public agent listings: ${error.message}`,
            );
        }

        return (
            data ?? []
        ) as AgentListingRecord[];
    }

    async getPublicListing(
        slug: string,
    ): Promise<{
        listing:
        AgentListingRecord;

        versions:
        AgentVersionRecord[];
    }> {
        const normalizedSlug =
            this.normalizeSlug(
                slug,
            );

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
                    "slug",
                    normalizedSlug,
                )
                .eq(
                    "visibility",
                    "public",
                )
                .eq(
                    "verification_status",
                    "verified",
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
                "Agent listing was not found.",
            );
        }

        const {
            data:
            versionData,
            error:
            versionError,
        } =
            await this.supabase.db
                .from("agent_versions")
                .select("*")
                .eq(
                    "listing_id",
                    listingData.id,
                )
                .eq(
                    "status",
                    "published",
                )
                .order(
                    "published_at",
                    {
                        ascending:
                            false,
                    },
                );

        if (versionError) {
            throw new Error(
                `Failed to load agent versions: ${versionError.message}`,
            );
        }

        return {
            listing:
                listingData as
                AgentListingRecord,

            versions:
                (
                    versionData ??
                    []
                ) as AgentVersionRecord[],
        };
    }

    async listOwnedListings(
        publisherAddress: string,
    ): Promise<AgentListingRecord[]> {
        const {
            data,
            error,
        } =
            await this.supabase.db
                .from("agent_listings")
                .select("*")
                .eq(
                    "publisher_address",
                    publisherAddress
                        .toLowerCase(),
                )
                .order(
                    "created_at",
                    {
                        ascending:
                            false,
                    },
                );

        if (error) {
            throw new Error(
                `Failed to load owned agent listings: ${error.message}`,
            );
        }

        return (
            data ?? []
        ) as AgentListingRecord[];
    }

    async getOwnedListing(input: {
        listingId: string;
        publisherAddress: string;
    }): Promise<AgentListingRecord> {
        const {
            data,
            error,
        } =
            await this.supabase.db
                .from("agent_listings")
                .select("*")
                .eq(
                    "id",
                    input.listingId,
                )
                .single();

        if (error || !data) {
            throw new NotFoundException(
                "Agent listing was not found.",
            );
        }

        const listing =
            data as AgentListingRecord;

        if (
            listing.publisher_address
                .toLowerCase() !==
            input.publisherAddress
                .toLowerCase()
        ) {
            throw new ForbiddenException(
                "You do not own this agent listing.",
            );
        }

        return listing;
    }

    private async getOwnedCustomAgent(input: {
        customAgentId: string;
        publisherAddress: string;
    }): Promise<CustomAgentRecord> {
        const customAgent =
            await this.getCustomAgentById(
                input.customAgentId,
            );

        if (
            customAgent.owner_address
                .toLowerCase() !==
            input.publisherAddress
                .toLowerCase()
        ) {
            throw new ForbiddenException(
                "You do not own this custom agent.",
            );
        }

        return customAgent;
    }

    private async getCustomAgentById(
        id: string,
    ): Promise<CustomAgentRecord> {
        const {
            data,
            error,
        } =
            await this.supabase.db
                .from("custom_agents")
                .select("*")
                .eq(
                    "id",
                    id,
                )
                .single();

        if (error || !data) {
            throw new NotFoundException(
                "Custom agent was not found.",
            );
        }

        return data as CustomAgentRecord;
    }

    private async findListingBySlug(
        slug: string,
    ): Promise<AgentListingRecord | null> {
        const {
            data,
            error,
        } =
            await this.supabase.db
                .from("agent_listings")
                .select("*")
                .eq(
                    "slug",
                    slug,
                )
                .maybeSingle();

        if (error) {
            throw new Error(
                `Failed to check listing slug: ${error.message}`,
            );
        }

        return (
            data as
            | AgentListingRecord
            | null
        );
    }

    private async findVersion(input: {
        listingId: string;
        version: string;
    }): Promise<AgentVersionRecord | null> {
        const {
            data,
            error,
        } =
            await this.supabase.db
                .from("agent_versions")
                .select("*")
                .eq(
                    "listing_id",
                    input.listingId,
                )
                .eq(
                    "version",
                    input.version,
                )
                .maybeSingle();

        if (error) {
            throw new Error(
                `Failed to check agent version: ${error.message}`,
            );
        }

        return (
            data as
            | AgentVersionRecord
            | null
        );
    }

    private normalizeSlug(
        value: string,
    ): string {
        const slug =
            value
                ?.trim()
                .toLowerCase()
                .replace(
                    /[^a-z0-9]+/g,
                    "-",
                )
                .replace(
                    /^-+|-+$/g,
                    "",
                );

        if (
            !slug ||
            slug.length < 3 ||
            slug.length > 64
        ) {
            throw new BadRequestException(
                "slug must contain between 3 and 64 lowercase letters, numbers or hyphens.",
            );
        }

        return slug;
    }

    private normalizeVersion(
        value: string,
    ): string {
        const version =
            value?.trim();

        if (
            !version ||
            !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(
                version,
            )
        ) {
            throw new BadRequestException(
                "version must be a valid semantic version, such as 1.0.0 or 1.0.0-beta.1.",
            );
        }

        return version;
    }

    private normalizeStringArray(
        values:
            | string[]
            | undefined,
    ): string[] {
        return [
            ...new Set(
                (
                    values ??
                    []
                )
                    .map(
                        (value) =>
                            value
                                .trim()
                                .toLowerCase(),
                    )
                    .filter(Boolean),
            ),
        ].slice(
            0,
            20,
        );
    }

    private normalizeOptionalUrl(
        value:
            | string
            | undefined,

        field:
            string,
    ): string | null {
        if (!value) {
            return null;
        }

        let url: URL;

        try {
            url =
                new URL(value);
        } catch {
            throw new BadRequestException(
                `${field} must be a valid URL.`,
            );
        }

        if (
            url.protocol !==
            "https:" &&
            process.env.NODE_ENV ===
            "production"
        ) {
            throw new BadRequestException(
                `${field} must use HTTPS.`,
            );
        }

        return url.toString();
    }

    private requireNonEmptyString(
        value: string,
        field: string,
    ): string {
        const normalized =
            value?.trim();

        if (!normalized) {
            throw new BadRequestException(
                `${field} must be a non-empty string.`,
            );
        }

        return normalized;
    }

    private createVersionChecksum(
        input: {
            manifest: unknown;
            endpointUrl: string;
            protocolVersion: string;
            signingPublicKey?:
            | string
            | null;
        },
    ): string {
        return createHash(
            "sha256",
        )
            .update(
                JSON.stringify(
                    input,
                ),
            )
            .digest(
                "hex",
            );
    }
}