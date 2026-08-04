"use client";

import Link from "next/link";
import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import { useParams } from "next/navigation";

import {
    getMyAgentInstallations,
    getPublicAgentListing,
    installAgent,
    setAgentInstallationEnabled,
    uninstallAgent,
    upgradeAgentInstallation,
    type AgentInstallation,
    type AgentListing,
    type AgentVersion,
    type InstalledAgent,
    runInstalledAgent,
} from "@/src/lib/api";

import {
    type InstalledAgentRunResult,
} from "@/src/lib/api";


const DEFAULT_MARKET = {
    id: "fed-september-2026",
    address:
        "0xcae8072e80e78ab243d42f74819b037dde623b7b",
    question:
        "Will the Fed announce a rate cut in September 2026?",
    yesPrice:
        0.4791735856582144,
    noPrice:
        0.5208264143417856,
    open:
        true,
    resolved:
        false,
    network:
        "eip155:5042002",
};

export default function AgentDetailsPage() {
    const params =
        useParams<{
            slug: string;
        }>();

    const slug =
        params.slug;

    const [
        token,
        setToken,
    ] =
        useState<string | null>(
            null,
        );

    const [
        listing,
        setListing,
    ] =
        useState<AgentListing | null>(
            null,
        );

    const [
        versions,
        setVersions,
    ] =
        useState<AgentVersion[]>(
            [],
        );

    const [
        installation,
        setInstallation,
    ] =
        useState<AgentInstallation | null>(
            null,
        );

    const [
        loading,
        setLoading,
    ] =
        useState(true);

    const [
        actionLoading,
        setActionLoading,
    ] =
        useState(false);

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

    const [
        running,
        setRunning,
    ] =
        useState(false);

    const [
        runResult,
        setRunResult,
    ] =
        useState<
            InstalledAgentRunResult | null
        >(null);

    const loadPage =
        useCallback(
            async (
                jwt:
                    | string
                    | null,
            ) => {
                setLoading(true);
                setError(null);

                try {
                    const details =
                        await getPublicAgentListing(
                            slug,
                        );

                    setListing(
                        details.listing,
                    );

                    setVersions(
                        details.versions,
                    );

                    if (!jwt) {
                        setInstallation(
                            null,
                        );

                        return;
                    }

                    const installed =
                        await getMyAgentInstallations(
                            jwt,
                        );

                    const matched =
                        installed.find(
                            (
                                item:
                                    InstalledAgent,
                            ) =>
                                item.listing
                                    .id ===
                                details
                                    .listing
                                    .id,
                        );

                    setInstallation(
                        matched
                            ?.installation ??
                        null,
                    );
                } catch (loadError) {
                    setError(
                        loadError instanceof
                            Error
                            ? loadError.message
                            : "Failed to load agent.",
                    );
                } finally {
                    setLoading(false);
                }
            },
            [
                slug,
            ],
        );

    useEffect(() => {
        void loadPage(
            token,
        );
    }, [
        token,
        loadPage,
    ]);

    const latestVersion =
        useMemo(
            () =>
                versions.find(
                    (version) =>
                        version.version ===
                        listing
                            ?.latest_version,
                ) ??
                versions[0] ??
                null,
            [
                versions,
                listing,
            ],
        );

    async function handleInstall() {
        if (!listing) {
            return;
        }

        if (!token) {
            window.location.href =
                "/get-started";

            return;
        }

        setActionLoading(true);
        setError(null);

        try {
            const created =
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

            setInstallation(
                created,
            );
        } catch (actionError) {
            setError(
                actionError instanceof
                    Error
                    ? actionError.message
                    : "Failed to install agent.",
            );
        } finally {
            setActionLoading(false);
        }
    }

    async function handleToggleEnabled() {
        if (
            !token ||
            !installation
        ) {
            return;
        }

        setActionLoading(true);
        setError(null);

        try {
            const updated =
                await setAgentInstallationEnabled(
                    token,
                    installation.id,
                    !installation.enabled,
                );

            setInstallation(
                updated,
            );
        } catch (actionError) {
            setError(
                actionError instanceof
                    Error
                    ? actionError.message
                    : "Failed to update installation.",
            );
        } finally {
            setActionLoading(false);
        }
    }

    async function handleUpgrade(
        version?: string,
    ) {
        if (
            !token ||
            !installation
        ) {
            return;
        }

        setActionLoading(true);
        setError(null);

        try {
            const updated =
                await upgradeAgentInstallation(
                    token,
                    installation.id,
                    version,
                );

            setInstallation(
                updated,
            );
        } catch (actionError) {
            setError(
                actionError instanceof
                    Error
                    ? actionError.message
                    : "Failed to upgrade agent.",
            );
        } finally {
            setActionLoading(false);
        }
    }

    async function handleUninstall() {
        if (
            !token ||
            !installation
        ) {
            return;
        }

        const confirmed =
            window.confirm(
                "Uninstall this agent?",
            );

        if (!confirmed) {
            return;
        }

        setActionLoading(true);
        setError(null);

        try {
            await uninstallAgent(
                token,
                installation.id,
            );

            setInstallation(
                null,
            );
        } catch (actionError) {
            setError(
                actionError instanceof
                    Error
                    ? actionError.message
                    : "Failed to uninstall agent.",
            );
        } finally {
            setActionLoading(false);
        }
    }

    async function handleRun() {
        if (
            !token ||
            !installation?.id
        ) {
            return;
        }

        setRunning(true);
        setError(null);
        setRunResult(null);

        try {
            const result =
                await runInstalledAgent(
                    token,
                    installation.id,
                    {
                        market:
                            DEFAULT_MARKET,
                    },
                );

            setRunResult(
                result,
            );
        } catch (runError) {
            setError(
                runError instanceof Error
                    ? runError.message
                    : "Failed to run agent.",
            );
        } finally {
            setRunning(false);
        }
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-[#f7f6f2] px-6 py-16">
                <div className="mx-auto max-w-6xl">
                    <div className="h-[520px] animate-pulse rounded-[32px] bg-white" />
                </div>
            </main>
        );
    }

    if (
        error &&
        !listing
    ) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#f7f6f2] px-6">
                <div className="max-w-md rounded-[28px] border border-red-200 bg-red-50 p-8 text-center">
                    <h1 className="text-xl font-black text-red-800">
                        Agent unavailable
                    </h1>

                    <p className="mt-3 text-sm text-red-700">
                        {error}
                    </p>

                    <Link
                        href="/marketplace"
                        className="mt-6 inline-flex rounded-[14px] bg-slate-950 px-5 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-white"
                    >
                        Back to marketplace
                    </Link>
                </div>
            </main>
        );
    }

    if (
        !listing ||
        !latestVersion
    ) {
        return null;
    }

    const manifest =
        latestVersion.manifest;

    const initials =
        listing.name
            .split(/\s+/)
            .map(
                (word) =>
                    word[0],
            )
            .join("")
            .slice(0, 2)
            .toUpperCase();

    return (
        <main className="min-h-screen bg-[#f7f6f2] px-6 pb-24 pt-10">
            <div className="mx-auto max-w-6xl">
                <div className="mb-8 flex items-center justify-between">
                    <Link
                        href="/marketplace"
                        className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500"
                    >
                        ← Marketplace
                    </Link>

                    <Link
                        href="/dashboard"
                        className="rounded-[14px] border border-black/10 bg-white px-5 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-slate-700"
                    >
                        Dashboard
                    </Link>

                    {/* <Link
                        href={`/dashboard?installation=${installation?.id}`}
                        className="mt-6 flex w-full items-center justify-center rounded-[14px] bg-slate-950 px-5 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-white"
                    >
                        Run agent →
                    </Link> */}
                </div>

                {error && (
                    <div className="mb-6 rounded-[18px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
                        {error}
                    </div>
                )}

                <section className="overflow-hidden rounded-[32px] border border-black/10 bg-[#fffdf8]">
                    <div className="h-36 bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-400" />

                    <div className="grid gap-10 p-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-10">
                        <div>
                            <div className="-mt-16 flex items-end gap-5">
                                {listing.icon_url ? (
                                    <img
                                        src={
                                            listing.icon_url
                                        }
                                        alt=""
                                        className="h-28 w-28 rounded-[28px] border-4 border-[#fffdf8] object-cover shadow-xl"
                                    />
                                ) : (
                                    <div className="flex h-28 w-28 items-center justify-center rounded-[28px] border-4 border-[#fffdf8] bg-slate-950 text-2xl font-black text-white shadow-xl">
                                        {initials}
                                    </div>
                                )}

                                <div className="pb-2">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <h1 className="text-3xl font-black text-slate-950 md:text-5xl">
                                            {
                                                listing.name
                                            }
                                        </h1>

                                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-emerald-700">
                                            Verified
                                        </span>
                                    </div>

                                    <p className="mt-2 text-sm text-slate-500">
                                        v
                                        {
                                            latestVersion.version
                                        }{" "}
                                        · Published by{" "}
                                        {
                                            manifest
                                                .author
                                                ?.name ??
                                            "Unknown publisher"
                                        }
                                    </p>
                                </div>
                            </div>

                            <p className="mt-8 max-w-3xl text-base leading-8 text-slate-600">
                                {
                                    listing.long_description ??
                                    listing.short_description
                                }
                            </p>

                            <div className="mt-6 flex flex-wrap gap-2">
                                {listing.categories.map(
                                    (
                                        category,
                                    ) => (
                                        <span
                                            key={
                                                category
                                            }
                                            className="rounded-full bg-violet-50 px-3 py-2 text-[9px] font-black uppercase tracking-[0.1em] text-violet-600"
                                        >
                                            {
                                                category
                                            }
                                        </span>
                                    ),
                                )}

                                {listing.tags.map(
                                    (
                                        tag,
                                    ) => (
                                        <span
                                            key={
                                                tag
                                            }
                                            className="rounded-full bg-slate-100 px-3 py-2 text-[9px] font-black uppercase tracking-[0.1em] text-slate-500"
                                        >
                                            #
                                            {
                                                tag
                                            }
                                        </span>
                                    ),
                                )}
                            </div>

                            <div className="mt-10 grid gap-4 sm:grid-cols-3">
                                <Stat
                                    label="Installations"
                                    value={String(
                                        listing.installation_count,
                                    )}
                                />

                                <Stat
                                    label="Rating"
                                    value={
                                        listing.average_rating
                                            ? `${Number(
                                                listing.average_rating,
                                            ).toFixed(
                                                1,
                                            )} ★`
                                            : "New"
                                    }
                                />

                                <Stat
                                    label="Protocol"
                                    value={
                                        latestVersion.protocol_version
                                    }
                                />
                            </div>
                        </div>

                        <aside className="rounded-[24px] border border-black/10 bg-white p-6">
                            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                                Installation
                            </p>

                            {!installation ? (
                                <>
                                    <h2 className="mt-4 text-xl font-black text-slate-950">
                                        Add this agent
                                    </h2>

                                    <p className="mt-3 text-sm leading-6 text-slate-500">
                                        Install the
                                        published version
                                        and run it through
                                        Bruh&apos;s risk
                                        pipeline.
                                    </p>

                                    <button
                                        type="button"
                                        disabled={
                                            actionLoading
                                        }
                                        onClick={() =>
                                            void handleInstall()
                                        }
                                        className="mt-6 w-full rounded-[15px] bg-gradient-to-r from-violet-500 to-blue-500 px-5 py-4 text-[10px] font-black uppercase tracking-[0.13em] text-white disabled:opacity-50"
                                    >
                                        {actionLoading
                                            ? "Installing…"
                                            : "Install agent"}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div className="mt-4 flex items-center justify-between">
                                        <div>
                                            <h2 className="text-xl font-black text-slate-950">
                                                Installed
                                            </h2>

                                            <p className="mt-1 text-xs text-slate-500">
                                                {installation.pinned_version
                                                    ? `Pinned to ${installation.pinned_version}`
                                                    : "Following latest version"}
                                            </p>
                                        </div>

                                        <span
                                            className={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${installation.enabled
                                                ? "bg-emerald-50 text-emerald-700"
                                                : "bg-slate-100 text-slate-500"
                                                }`}
                                        >
                                            {installation.enabled
                                                ? "Enabled"
                                                : "Disabled"}
                                        </span>
                                    </div>

                                    <button
                                        type="button"
                                        disabled={
                                            running ||
                                            actionLoading ||
                                            !installation?.enabled
                                        }
                                        onClick={() =>
                                            void handleRun()
                                        }
                                        className="mt-6 w-full rounded-[15px] bg-slate-950 px-5 py-4 text-[10px] font-black uppercase tracking-[0.13em] text-white disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {running
                                            ? "Running agent…"
                                            : "Run agent →"}
                                    </button>

                                    <button
                                        type="button"
                                        disabled={
                                            actionLoading
                                        }
                                        onClick={() =>
                                            void handleToggleEnabled()
                                        }
                                        className="mt-6 w-full rounded-[14px] border border-black/10 px-5 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-slate-700 disabled:opacity-50"
                                    >
                                        {installation.enabled
                                            ? "Disable agent"
                                            : "Enable agent"}
                                    </button>

                                    <button
                                        type="button"
                                        disabled={
                                            actionLoading
                                        }
                                        onClick={() =>
                                            void handleUpgrade()
                                        }
                                        className="mt-3 w-full rounded-[14px] border border-violet-200 bg-violet-50 px-5 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-violet-700 disabled:opacity-50"
                                    >
                                        Upgrade to latest
                                    </button>

                                    <button
                                        type="button"
                                        disabled={
                                            actionLoading
                                        }
                                        onClick={() =>
                                            void handleUninstall()
                                        }
                                        className="mt-3 w-full rounded-[14px] border border-red-200 bg-red-50 px-5 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-red-700 disabled:opacity-50"
                                    >
                                        Uninstall
                                    </button>


                                </>
                            )}
                        </aside>
                    </div>
                </section>


                <div className="mt-8 grid items-start gap-6 lg:grid-cols-2">
                    <SectionCard
                        title="Capabilities"
                    >
                        <div className="flex flex-wrap gap-2">
                            {manifest.capabilities.map(
                                (
                                    capability,
                                ) => (
                                    <Pill
                                        key={
                                            capability
                                        }
                                    >
                                        {
                                            capability
                                        }
                                    </Pill>
                                ),
                            )}
                        </div>
                    </SectionCard>

                    <SectionCard
                        title="Permissions"
                    >
                        <div className="space-y-3">
                            <PermissionRow
                                label="Research"
                                enabled={
                                    manifest.permissions
                                        .canResearch
                                }
                            />

                            <PermissionRow
                                label="External APIs"
                                enabled={
                                    manifest.permissions
                                        .canUseExternalApis
                                }
                            />

                            <PermissionRow
                                label="Historical data"
                                enabled={
                                    manifest.permissions
                                        .canAccessHistoricalData
                                }
                            />

                            <PermissionRow
                                label="On-chain data"
                                enabled={
                                    manifest.permissions
                                        .canAccessOnchainData
                                }
                            />

                            <PermissionRow
                                label="Trade directly"
                                enabled={
                                    manifest.permissions
                                        .canTrade
                                }
                            />
                        </div>
                    </SectionCard>

                    <SectionCard
                        title="Release notes"
                    >
                        <p className="text-sm leading-7 text-slate-600">
                            {latestVersion.release_notes ??
                                "No release notes were provided for this version."}
                        </p>
                    </SectionCard>

                    <SectionCard
                        title="Version integrity"
                    >
                        <dl className="space-y-4 text-sm">
                            <InfoRow
                                label="Version"
                                value={
                                    latestVersion.version
                                }
                            />

                            <InfoRow
                                label="Protocol"
                                value={
                                    latestVersion.protocol_version
                                }
                            />

                            <InfoRow
                                label="Checksum"
                                value={
                                    latestVersion.checksum ??
                                    "Unavailable"
                                }
                                mono
                            />
                        </dl>
                    </SectionCard>
                </div>

                <section className="mt-8 rounded-[28px] border border-black/10 bg-[#fffdf8] p-7">
                    <h2 className="text-xl font-black text-slate-950">
                        Version history
                    </h2>

                    <div className="mt-6 space-y-3">
                        {versions.map(
                            (
                                version,
                            ) => (
                                <div
                                    key={
                                        version.id
                                    }
                                    className="flex flex-col gap-4 rounded-[18px] border border-black/10 bg-white p-5 md:flex-row md:items-center md:justify-between"
                                >
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <span className="font-black text-slate-950">
                                                v
                                                {
                                                    version.version
                                                }
                                            </span>

                                            <span className="rounded-full bg-slate-100 px-3 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-slate-500">
                                                {
                                                    version.status
                                                }
                                            </span>
                                        </div>

                                        <p className="mt-2 text-sm text-slate-500">
                                            {version.release_notes ??
                                                "No release notes."}
                                        </p>
                                    </div>

                                    {installation &&
                                        installation.version_id !==
                                        version.id && (
                                            <button
                                                type="button"
                                                disabled={
                                                    actionLoading
                                                }
                                                onClick={() =>
                                                    void handleUpgrade(
                                                        version.version,
                                                    )
                                                }
                                                className="rounded-[13px] border border-black/10 px-4 py-3 text-[9px] font-black uppercase tracking-[0.12em] text-slate-700"
                                            >
                                                Install this version
                                            </button>
                                        )}
                                </div>
                            ),
                        )}
                    </div>
                </section>
                {runResult && (
                    <section className="mt-8 rounded-[28px] border border-black/10 bg-white p-7">
                        <h2 className="text-xl font-black">
                            Latest Run
                        </h2>

                        <div className="mt-6 space-y-3 text-sm">
                            <div>
                                <strong>Action:</strong>{" "}
                                {runResult.decision.action}
                            </div>

                            <div>
                                <strong>Probability:</strong>{" "}
                                {(runResult.decision.probability * 100).toFixed(1)}%
                            </div>

                            <div>
                                <strong>Edge:</strong>{" "}
                                {(runResult.decision.edge * 100).toFixed(1)}%
                            </div>

                            <div>
                                <strong>Status:</strong>{" "}
                                {runResult.executionPlan.status}
                            </div>

                            <div>
                                <strong>Reasoning:</strong>
                                <p className="mt-2 text-slate-600">
                                    {runResult.decision.reasoning}
                                </p>
                            </div>
                        </div>
                    </section>
                )}

            </div>
        </main>
    );
}

function Stat({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-[18px] border border-black/10 bg-white p-5">
            <p className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-400">
                {label}
            </p>

            <p className="mt-2 text-xl font-black text-slate-950">
                {value}
            </p>
        </div>
    );
}

function SectionCard({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section className="self-start rounded-[28px] border border-black/10 bg-[#fffdf8] p-7">
            <h2 className="text-xl font-black text-slate-950">
                {title}
            </h2>

            <div className="mt-6">
                {children}
            </div>
        </section>
    );
}

function Pill({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <span className="rounded-full bg-violet-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.11em] text-violet-600">
            {children}
        </span>
    );
}

function PermissionRow({
    label,
    enabled,
}: {
    label: string;
    enabled: boolean;
}) {
    return (
        <div className="flex items-center justify-between rounded-[14px] border border-black/5 bg-white px-4 py-3">
            <span className="text-sm font-medium text-slate-700">
                {label}
            </span>

            <span
                className={`text-[9px] font-black uppercase tracking-[0.12em] ${enabled
                    ? "text-emerald-600"
                    : "text-slate-400"
                    }`}
            >
                {enabled
                    ? "Allowed"
                    : "Blocked"}
            </span>
        </div>
    );
}

function InfoRow({
    label,
    value,
    mono = false,
}: {
    label: string;
    value: string;
    mono?: boolean;
}) {
    return (
        <div>
            <dt className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-400">
                {label}
            </dt>

            <dd
                className={`mt-1 break-all text-slate-700 ${mono
                    ? "font-mono text-xs"
                    : "text-sm"
                    }`}
            >
                {value}
            </dd>
        </div>
    );
}