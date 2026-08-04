"use client";

import Link from "next/link";

import type {
    AgentInstallation,
    AgentListing,
} from "@/src/lib/api";

interface AgentListingCardProps {
    listing: AgentListing;

    installation?: AgentInstallation;

    installing: boolean;

    onInstall: (
        listing: AgentListing,
    ) => void;
}

export default function AgentListingCard({
    listing,
    installation,
    installing,
    onInstall,
}: AgentListingCardProps) {
    const installed =
        Boolean(installation);

    const initials =
        listing.name
            .split(/\s+/)
            .map((word) => word[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();

    return (
        <article className="group flex min-h-[320px] flex-col rounded-[26px] border border-black/10 bg-[#fffdf8] p-6 shadow-sm transition hover:-translate-y-1 hover:border-violet-300 hover:shadow-xl">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                    {listing.icon_url ? (
                        <img
                            src={
                                listing.icon_url
                            }
                            alt=""
                            className="h-14 w-14 rounded-2xl border border-black/10 object-cover"
                        />
                    ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 text-sm font-black text-white">
                            {initials}
                        </div>
                    )}

                    <div>
                        <h2 className="text-lg font-black text-slate-950">
                            {listing.name}
                        </h2>

                        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                            v
                            {listing.latest_version ??
                                "—"}
                        </p>
                    </div>
                </div>

                {listing.verification_status ===
                    "verified" && (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-emerald-700">
                            Verified
                        </span>
                    )}
            </div>

            <p className="mt-6 flex-1 text-sm leading-6 text-slate-600">
                {
                    listing.short_description
                }
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
                {listing.categories
                    .slice(0, 3)
                    .map((category) => (
                        <span
                            key={
                                category
                            }
                            className="rounded-full bg-violet-50 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.1em] text-violet-600"
                        >
                            {category}
                        </span>
                    ))}

                {listing.tags
                    .slice(0, 2)
                    .map((tag) => (
                        <span
                            key={tag}
                            className="rounded-full bg-slate-100 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.1em] text-slate-500"
                        >
                            #{tag}
                        </span>
                    ))}
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-black/5 pt-5 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                <span>
                    {listing.installation_count}{" "}
                    {listing.installation_count === 1
                        ? "installation"
                        : "installations"}
                </span>

                <span>
                    {listing.average_rating
                        ? `${Number(
                            listing.average_rating,
                        ).toFixed(1)} ★`
                        : "New"}
                </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
                <Link
                    href={`/marketplace/${listing.slug}`}
                    className="flex items-center justify-center rounded-[14px] border border-black/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-slate-700 transition hover:bg-slate-50"
                >
                    View details
                </Link>

                <button
                    type="button"
                    disabled={
                        installed ||
                        installing
                    }
                    onClick={() =>
                        onInstall(
                            listing,
                        )
                    }
                    className="rounded-[14px] bg-gradient-to-r from-violet-500 to-blue-500 px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {installed
                        ? installation
                            ?.enabled
                            ? "Installed"
                            : "Disabled"
                        : installing
                            ? "Installing…"
                            : "Install"}
                </button>
            </div>
        </article>
    );
}