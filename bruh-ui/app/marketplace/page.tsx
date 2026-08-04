"use client";

import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import Link from "next/link";

import AgentListingCard from "@/components/marketplace/AgentListingCard";

import {
    getMyAgentInstallations,
    getPublicAgentListings,
    installAgent,
    type AgentInstallation,
    type AgentListing,
    type InstalledAgent,
} from "@/src/lib/api";

export default function MarketplacePage() {
    const [
        token,
        setToken,
    ] =
        useState<string | null>(
            null,
        );

    const [
        listings,
        setListings,
    ] =
        useState<AgentListing[]>(
            [],
        );

    const [
        installations,
        setInstallations,
    ] =
        useState<InstalledAgent[]>(
            [],
        );

    const [
        search,
        setSearch,
    ] =
        useState("");

    const [
        loading,
        setLoading,
    ] =
        useState(true);

    const [
        installingId,
        setInstallingId,
    ] =
        useState<string | null>(
            null,
        );

    const [
        error,
        setError,
    ] =
        useState<string | null>(
            null,
        );

    useEffect(() => {
        setToken(
            localStorage.getItem(
                "bruh_token",
            ),
        );
    }, []);

    const loadMarketplace =
        useCallback(
            async (
                jwt:
                    | string
                    | null,
            ) => {
                setLoading(true);
                setError(null);

                try {
                    const [
                        publicListings,
                        installed,
                    ] =
                        await Promise.all([
                            getPublicAgentListings({
                                limit:
                                    50,
                            }),

                            jwt
                                ? getMyAgentInstallations(
                                    jwt,
                                )
                                : Promise.resolve(
                                    [],
                                ),
                        ]);

                    setListings(
                        publicListings,
                    );

                    setInstallations(
                        installed,
                    );
                } catch (loadError) {
                    setError(
                        loadError instanceof
                            Error
                            ? loadError.message
                            : "Failed to load marketplace.",
                    );
                } finally {
                    setLoading(false);
                }
            },
            [],
        );

    useEffect(() => {
        void loadMarketplace(
            token,
        );
    }, [
        token,
        loadMarketplace,
    ]);

    const installationByListing =
        useMemo(() => {
            const map =
                new Map<
                    string,
                    AgentInstallation
                >();

            for (const item of installations) {
                map.set(
                    item.listing.id,
                    item.installation,
                );
            }

            return map;
        }, [
            installations,
        ]);

    const filteredListings =
        useMemo(() => {
            const normalized =
                search
                    .trim()
                    .toLowerCase();

            if (!normalized) {
                return listings;
            }

            return listings.filter(
                (listing) => {
                    const searchable =
                        [
                            listing.name,
                            listing.short_description,
                            listing.slug,
                            ...listing.categories,
                            ...listing.tags,
                        ]
                            .join(" ")
                            .toLowerCase();

                    return searchable.includes(
                        normalized,
                    );
                },
            );
        }, [
            listings,
            search,
        ]);

    async function handleInstall(
        listing: AgentListing,
    ) {
        if (!token) {
            window.location.href =
                "/get-started";

            return;
        }

        setInstallingId(
            listing.id,
        );

        setError(null);

        try {
            const installation =
                await installAgent(
                    token,
                    listing.id,
                    {
                        version:
                            listing.latest_version ??
                            undefined,

                        autoUpdate:
                            true,

                        configuration: {
                            edgeThreshold:
                                0.05,

                            minimumConfidence:
                                0.5,
                        },

                        permissions: {
                            canTrade:
                                false,
                        },
                    },
                );

            setInstallations(
                (current) => [
                    ...current,
                    {
                        installation,

                        listing,

                        version: {
                            id:
                                installation.version_id,

                            listing_id:
                                listing.id,

                            version:
                                listing.latest_version ??
                                "unknown",

                            manifest: {
                                id:
                                    listing.slug,

                                name:
                                    listing.name,

                                version:
                                    listing.latest_version ??
                                    "unknown",

                                description:
                                    listing.short_description,

                                source:
                                    "custom",

                                difficulty:
                                    "developer",

                                categories:
                                    listing.categories,

                                capabilities:
                                    [],

                                permissions: {
                                    canResearch:
                                        true,

                                    canPurchaseResearch:
                                        false,

                                    canTrade:
                                        false,

                                    canAccessHistoricalData:
                                        false,

                                    canAccessOnchainData:
                                        false,

                                    canUseExternalApis:
                                        false,

                                    maximumTradeUsdc:
                                        0,
                                },
                            },

                            endpoint_url:
                                "",

                            protocol_version:
                                "",

                            status:
                                "published",

                            created_at:
                                installation.installed_at,
                        },
                    },
                ],
            );
        } catch (installError) {
            setError(
                installError instanceof
                    Error
                    ? installError.message
                    : "Failed to install agent.",
            );
        } finally {
            setInstallingId(
                null,
            );
        }
    }

    return (
        <main className="min-h-screen bg-[#f7f6f2] px-6 pb-24 pt-12">
            <div className="mx-auto max-w-7xl">
                <header className="flex flex-col gap-6 border-b border-black/10 pb-10 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-600">
                            Bruh agent registry
                        </p>

                        <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight text-slate-950 md:text-6xl">
                            Install intelligence.
                        </h1>

                        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">
                            Discover verified
                            forecasting agents,
                            install immutable
                            versions and run them
                            through Bruh&apos;s
                            risk-controlled
                            execution pipeline.
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <Link
                            href="/dashboard"
                            className="rounded-[14px] border border-black/10 bg-white px-5 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-slate-700"
                        >
                            Dashboard
                        </Link>

                        {!token && (
                            <Link
                                href="/get-started"
                                className="rounded-[14px] bg-slate-950 px-5 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-white"
                            >
                                Connect wallet
                            </Link>
                        )}
                    </div>
                </header>

                <section className="mt-8 flex flex-col gap-4 rounded-[22px] border border-black/10 bg-[#fffdf8] p-4 md:flex-row md:items-center md:justify-between">
                    <input
                        value={search}
                        onChange={(
                            event,
                        ) =>
                            setSearch(
                                event.target
                                    .value,
                            )
                        }
                        placeholder="Search agents, categories or tags..."
                        className="w-full rounded-[14px] border border-black/10 bg-white px-4 py-3 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-violet-400"
                    />

                    <div className="whitespace-nowrap px-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                        {
                            filteredListings.length
                        }{" "}
                        agents
                    </div>
                </section>

                {error && (
                    <div className="mt-6 rounded-[18px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                        {Array.from({
                            length: 6,
                        }).map(
                            (
                                _,
                                index,
                            ) => (
                                <div
                                    key={
                                        index
                                    }
                                    className="h-[320px] animate-pulse rounded-[26px] border border-black/5 bg-white"
                                />
                            ),
                        )}
                    </div>
                ) : filteredListings.length >
                    0 ? (
                    <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                        {filteredListings.map(
                            (
                                listing,
                            ) => (
                                <AgentListingCard
                                    key={
                                        listing.id
                                    }
                                    listing={
                                        listing
                                    }
                                    installation={installationByListing.get(
                                        listing.id,
                                    )}
                                    installing={
                                        installingId ===
                                        listing.id
                                    }
                                    onInstall={(
                                        selectedListing,
                                    ) =>
                                        void handleInstall(
                                            selectedListing,
                                        )
                                    }
                                />
                            ),
                        )}
                    </div>
                ) : (
                    <div className="mt-12 rounded-[26px] border border-dashed border-black/15 bg-[#fffdf8] px-8 py-20 text-center">
                        <h2 className="text-xl font-black text-slate-950">
                            No agents found
                        </h2>

                        <p className="mt-3 text-sm text-slate-500">
                            Try another search
                            term or publish the
                            first agent in this
                            category.
                        </p>
                    </div>
                )}
            </div>
        </main>
    );
}