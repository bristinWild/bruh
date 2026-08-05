"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
    ArrowLeft,
    ArrowUpRight,
    Bot,
    Clock3,
    Search,
    Sparkles,
    TrendingUp,
    Users,
    WalletCards,
} from "lucide-react";

import {
    getPublicMarkets,
    type PublicMarket,
} from "@/src/lib/api";

type MarketCategory =
    | "All"
    | "Crypto"
    | "AI"
    | "Politics"
    | "Economy"
    | "Technology";

type MarketCardData =
    PublicMarket & {
        category:
        Exclude<
            MarketCategory,
            "All"
        >;

        description:
        string;

        yesProbability:
        number;

        volume:
        number;

        traders:
        number;

        agents:
        number;

        closesIn:
        string;

        change:
        number;

        featured:
        boolean;
    };

const CATEGORIES: MarketCategory[] = [
    "All",
    "Crypto",
    "AI",
    "Politics",
    "Economy",
    "Technology",
];



const CATEGORY_THEMES: Record<
    Exclude<MarketCategory, "All">,
    {
        primary: string;
        secondary: string;
        soft: string;
        border: string;
        text: string;
        glow: string;
    }
> = {
    Crypto: {
        primary: "#8B5CF6",
        secondary: "#6366F1",
        soft: "#F3EEFF",
        border: "rgba(139,92,246,0.25)",
        text: "#6D28D9",
        glow: "rgba(139,92,246,0.25)",
    },
    AI: {
        primary: "#6366F1",
        secondary: "#3B82F6",
        soft: "#EEF2FF",
        border: "rgba(99,102,241,0.25)",
        text: "#4F46E5",
        glow: "rgba(99,102,241,0.25)",
    },
    Politics: {
        primary: "#D946EF",
        secondary: "#8B5CF6",
        soft: "#FDF4FF",
        border: "rgba(217,70,239,0.24)",
        text: "#A21CAF",
        glow: "rgba(217,70,239,0.24)",
    },
    Economy: {
        primary: "#2563EB",
        secondary: "#06B6D4",
        soft: "#EFF6FF",
        border: "rgba(37,99,235,0.24)",
        text: "#1D4ED8",
        glow: "rgba(37,99,235,0.24)",
    },
    Technology: {
        primary: "#0EA5E9",
        secondary: "#6366F1",
        soft: "#F0F9FF",
        border: "rgba(14,165,233,0.24)",
        text: "#0369A1",
        glow: "rgba(14,165,233,0.24)",
    },
};

function formatVolume(volume: number) {
    return new Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: 1,
    }).format(volume);
}
function inferMarketCategory(
    question:
        string,
): Exclude<
    MarketCategory,
    "All"
> {
    const normalized =
        question.toLowerCase();

    if (
        normalized.includes(
            "btc",
        ) ||
        normalized.includes(
            "bitcoin",
        ) ||
        normalized.includes(
            "eth",
        ) ||
        normalized.includes(
            "ethereum",
        ) ||
        normalized.includes(
            "crypto",
        )
    ) {
        return "Crypto";
    }

    if (
        normalized.includes(
            "ai",
        ) ||
        normalized.includes(
            "openai",
        ) ||
        normalized.includes(
            "model",
        )
    ) {
        return "AI";
    }

    if (
        normalized.includes(
            "election",
        ) ||
        normalized.includes(
            "president",
        ) ||
        normalized.includes(
            "government",
        )
    ) {
        return "Politics";
    }

    if (
        normalized.includes(
            "fed",
        ) ||
        normalized.includes(
            "rate",
        ) ||
        normalized.includes(
            "economy",
        ) ||
        normalized.includes(
            "inflation",
        )
    ) {
        return "Economy";
    }

    return "Technology";
}

function formatClosingTime(
    value:
        string,
): string {
    const closeTime =
        new Date(
            value,
        ).getTime();

    const remaining =
        closeTime -
        Date.now();

    if (
        remaining <= 0
    ) {
        return "Closed";
    }

    const hours =
        Math.floor(
            remaining /
            3_600_000,
        );

    if (
        hours < 24
    ) {
        return `${hours}h`;
    }

    const days =
        Math.floor(
            hours /
            24,
        );

    return `${days}d`;
}

function MarketCard({
    market,
    index,
}: {
    market:
    MarketCardData;

    index:
    number;
}) {
    const reduceMotion = useReducedMotion();
    const theme = CATEGORY_THEMES[market.category];
    const noProbability = 100 - market.yesProbability;
    const isPositive = market.change >= 0;


    return (
        <motion.article
            initial={
                reduceMotion
                    ? { opacity: 1 }
                    : {
                        opacity: 0,
                        y: 18,
                        scale: 0.98,
                    }
            }
            animate={{
                opacity: 1,
                y: 0,
                scale: 1,
            }}
            transition={{
                duration: 0.45,
                delay: Math.min(index * 0.05, 0.3),
                ease: [0.22, 1, 0.36, 1],
            }}
            whileHover={
                reduceMotion
                    ? undefined
                    : {
                        y: -6,
                    }
            }
            className="group relative h-full"
        >
            <div
                className="relative h-full overflow-hidden rounded-[26px] p-[2px]"
                style={{
                    background: `linear-gradient(
                        135deg,
                        ${theme.primary},
                        ${theme.secondary}
                    )`,
                    boxShadow: `0 24px 55px -40px ${theme.glow}`,
                }}
            >
                <div
                    className="relative flex h-full flex-col overflow-hidden rounded-[24px] p-5"
                    style={{
                        background: `
                            radial-gradient(
                                circle at 100% 0%,
                                ${theme.soft},
                                transparent 34%
                            ),
                            linear-gradient(
                                145deg,
                                #fffdf8 0%,
                                #f8f3eb 100%
                            )
                        `,
                    }}
                >
                    <div
                        className="pointer-events-none absolute inset-0 opacity-[0.025] mix-blend-multiply"
                        style={{
                            backgroundImage:
                                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='.9'/%3E%3C/svg%3E\")",
                        }}
                    />

                    <div className="relative flex items-center justify-between gap-3">
                        <span
                            className="rounded-full border px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.16em]"
                            style={{
                                borderColor: theme.border,
                                background: theme.soft,
                                color: theme.text,
                            }}
                        >
                            {market.category}
                        </span>

                        <div className="flex items-center gap-1.5 font-mono text-[9px] font-semibold text-slate-400">
                            <Clock3 className="h-3 w-3" />
                            {market.closesIn}
                        </div>
                    </div>

                    <div className="relative mt-5 flex-1">
                        {market.featured && (
                            <div className="mb-3 flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[0.16em] text-amber-600">
                                <Sparkles className="h-3 w-3" />
                                Featured market
                            </div>
                        )}

                        <h2
                            className="text-[24px] font-black leading-[1.04] tracking-[-0.035em] text-slate-950"
                            style={{
                                fontFamily: "var(--font-display)",
                            }}
                        >
                            {market.question}
                        </h2>

                        <p className="mt-3 line-clamp-3 text-[12px] font-medium leading-[1.65] text-slate-500">
                            {market.description}
                        </p>
                    </div>

                    <div className="relative mt-6 rounded-[18px] border border-black/10 bg-white/60 p-4">
                        <div className="flex items-end justify-between">
                            <div>
                                <p className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-400">
                                    Market probability
                                </p>

                                <div className="mt-2 flex items-baseline gap-2">
                                    <span
                                        className="font-mono text-[30px] font-black"
                                        style={{
                                            color: theme.text,
                                        }}
                                    >
                                        {market.yesProbability}%
                                    </span>

                                    <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                                        YES
                                    </span>
                                </div>
                            </div>

                            <div
                                className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 font-mono text-[9px] font-black ${isPositive
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-rose-50 text-rose-700"
                                    }`}
                            >
                                <TrendingUp
                                    className={`h-3 w-3 ${isPositive
                                        ? ""
                                        : "rotate-180"
                                        }`}
                                />
                                {isPositive ? "+" : ""}
                                {market.change}%
                            </div>
                        </div>

                        <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-slate-200">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{
                                    width: `${market.yesProbability}%`,
                                }}
                                transition={{
                                    duration: 0.7,
                                    delay: index * 0.05,
                                }}
                                style={{
                                    background: `linear-gradient(
                                        90deg,
                                        ${theme.primary},
                                        ${theme.secondary}
                                    )`,
                                }}
                            />

                            <div className="flex-1 bg-rose-300/70" />
                        </div>

                        <div className="mt-2 flex items-center justify-between font-mono text-[8px] font-black uppercase tracking-[0.12em]">
                            <span style={{ color: theme.text }}>
                                YES {market.yesProbability}¢
                            </span>

                            <span className="text-rose-600">
                                NO {noProbability}¢
                            </span>
                        </div>
                    </div>

                    <div className="relative mt-5 grid grid-cols-3 divide-x divide-black/10 border-y border-black/10 py-3">
                        <div>
                            <p className="text-[7px] font-black uppercase tracking-[0.15em] text-slate-400">
                                Volume
                            </p>

                            <p className="mt-1 font-mono text-[10px] font-black text-slate-700">
                                ${formatVolume(market.volume)}
                            </p>
                        </div>

                        <div className="pl-3">
                            <p className="text-[7px] font-black uppercase tracking-[0.15em] text-slate-400">
                                Traders
                            </p>

                            <p className="mt-1 flex items-center gap-1 font-mono text-[10px] font-black text-slate-700">
                                <Users className="h-3 w-3" />
                                {market.traders}
                            </p>
                        </div>

                        <div className="pl-3">
                            <p className="text-[7px] font-black uppercase tracking-[0.15em] text-slate-400">
                                Agents
                            </p>

                            <p className="mt-1 flex items-center gap-1 font-mono text-[10px] font-black text-slate-700">
                                <Bot className="h-3 w-3" />
                                {market.agents}
                            </p>
                        </div>
                    </div>

                    <Link
                        href={`/markets/${market.id}`}
                        className="relative mt-5 flex items-center justify-between rounded-[14px] px-4 py-3 text-[10px] font-black text-white transition-transform group-hover:scale-[1.01]"
                        style={{
                            background: `linear-gradient(
                                135deg,
                                ${theme.primary},
                                ${theme.secondary}
                            )`,
                            boxShadow: `0 15px 28px -20px ${theme.glow}`,
                        }}
                    >
                        View market

                        <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                </div>
            </div>
        </motion.article>
    );
}

export default function MarketsExplorer() {

    const [
        markets,
        setMarkets,
    ] =
        useState<
            PublicMarket[]
        >([]);

    const [
        loading,
        setLoading,
    ] =
        useState(true);

    const [
        loadError,
        setLoadError,
    ] =
        useState<
            string | null
        >(null);
    const [activeCategory, setActiveCategory] =
        useState<MarketCategory>("All");

    const [query, setQuery] = useState("");
    const [sort, setSort] = useState<
        "popular" | "closing" | "probability"
    >("popular");

    useEffect(() => {
        let cancelled =
            false;

        async function loadMarkets() {
            setLoading(true);
            setLoadError(null);

            try {
                const data =
                    await getPublicMarkets();

                if (!cancelled) {
                    setMarkets(
                        data,
                    );
                }
            } catch (error) {
                console.error(
                    "Failed to load markets:",
                    error,
                );

                if (!cancelled) {
                    setLoadError(
                        error instanceof
                            Error
                            ? error.message
                            : "Failed to load markets.",
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoading(
                        false,
                    );
                }
            }
        }

        void loadMarkets();

        return () => {
            cancelled =
                true;
        };
    }, []);

    const marketCards =
        useMemo<
            MarketCardData[]
        >(
            () =>
                markets.map(
                    (
                        market,
                    ) => {
                        const category =
                            inferMarketCategory(
                                market.question,
                            );

                        return {
                            ...market,

                            category,

                            description:
                                market.resolved
                                    ? `Resolved as ${market.outcome}.`
                                    : market.open
                                        ? "This market is open for prediction on Arc Testnet."
                                        : "This market is closed and awaiting resolution.",

                            yesProbability:
                                Math.round(
                                    market.yesPrice *
                                    100,
                                ),

                            volume:
                                market.collateralUsdc,

                            traders:
                                0,

                            agents:
                                0,

                            closesIn:
                                formatClosingTime(
                                    market.closeTime,
                                ),

                            change:
                                0,

                            featured:
                                market.open &&
                                market.collateralUsdc >
                                10,
                        };
                    },
                ),
            [
                markets,
            ],
        );

    const filteredMarkets = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();

        const filtered =
            marketCards.filter(
                (market) => {
                    const categoryMatches =
                        activeCategory ===
                        "All" ||
                        market.category ===
                        activeCategory;

                    const searchMatches =
                        !normalizedQuery ||
                        market.question
                            .toLowerCase()
                            .includes(
                                normalizedQuery,
                            ) ||
                        market.description
                            .toLowerCase()
                            .includes(
                                normalizedQuery,
                            ) ||
                        market.category
                            .toLowerCase()
                            .includes(
                                normalizedQuery,
                            );

                    return (
                        categoryMatches &&
                        searchMatches
                    );
                },
            );

        return [...filtered].sort((first, second) => {
            if (sort === "probability") {
                return (
                    second.yesProbability -
                    first.yesProbability
                );
            }

            if (sort === "closing") {
                return (
                    first.closeTimeUnix -
                    second.closeTimeUnix
                );
            }

            return second.volume - first.volume;
        });
    }, [
        marketCards,
        activeCategory,
        query,
        sort,
    ]);

    return (
        <main className="relative min-h-screen overflow-hidden bg-[#f7f6f2] pb-24 pt-28">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-[-200px] top-20 h-[500px] w-[500px] rounded-full bg-violet-300/10 blur-[160px]" />

                <div className="absolute right-[-200px] top-40 h-[500px] w-[500px] rounded-full bg-blue-300/10 blur-[160px]" />

                <div
                    className="absolute inset-0 opacity-[0.025]"
                    style={{
                        backgroundImage: `
                            linear-gradient(
                                to right,
                                rgba(99,102,241,0.2) 1px,
                                transparent 1px
                            ),
                            linear-gradient(
                                to bottom,
                                rgba(99,102,241,0.2) 1px,
                                transparent 1px
                            )
                        `,
                        backgroundSize: "48px 48px",
                    }}
                />
            </div>

            <div className="relative mx-auto max-w-7xl px-6">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 transition-colors hover:text-violet-600"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back home
                </Link>

                <section className="mt-9 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-3xl">
                        <div className="inline-flex rounded-full bg-gradient-to-r from-violet-500 to-blue-500 p-px">
                            <div className="flex items-center gap-2 rounded-full bg-[#fbf8f2] px-4 py-2">
                                <span className="relative flex h-2 w-2">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-40" />
                                    <span className="relative h-2 w-2 rounded-full bg-emerald-500" />
                                </span>

                                <span className="font-mono text-[8px] font-black uppercase tracking-[0.18em] text-slate-600">
                                    {
                                        markets.filter(
                                            (market) =>
                                                market.open &&
                                                !market.resolved,
                                        ).length
                                    }{" "}
                                    open markets
                                </span>
                            </div>
                        </div>

                        <h1
                            className="mt-6 text-[48px] font-black uppercase leading-[0.9] tracking-[-0.055em] text-slate-950 sm:text-[68px]"
                            style={{
                                fontFamily: "var(--font-display)",
                            }}
                        >
                            Explore open{" "}
                            <span className="bg-gradient-to-r from-violet-600 to-blue-500 bg-clip-text text-transparent">
                                markets.
                            </span>
                        </h1>

                        <p className="mt-6 max-w-2xl text-[16px] font-medium leading-[1.75] text-slate-600">
                            Browse active prediction markets, inspect
                            agent activity, and trade outcomes using
                            USDC on Arc.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <StatCard
                            icon={WalletCards}
                            label="Open interest"
                            value={`$${formatVolume(
                                markets.reduce(
                                    (
                                        total,
                                        market,
                                    ) =>
                                        total +
                                        market.collateralUsdc,
                                    0,
                                ),
                            )}`}
                        />

                        <StatCard
                            icon={Users}
                            label="Traders"
                            value="—"
                        />

                        <StatCard
                            icon={Bot}
                            label="Active agents"
                            value="—"
                            className="col-span-2 sm:col-span-1"
                        />
                    </div>
                </section>

                <section className="mt-12">
                    <div className="flex flex-col gap-4 rounded-[24px] border border-black/10 bg-[#fffdf8]/80 p-4 backdrop-blur-md lg:flex-row lg:items-center lg:justify-between">
                        <div className="relative flex-1 lg:max-w-md">
                            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                            <input
                                value={query}
                                onChange={(event) =>
                                    setQuery(event.target.value)
                                }
                                placeholder="Search markets..."
                                className="h-12 w-full rounded-[14px] border border-black/10 bg-white/70 pl-11 pr-4 text-[13px] font-semibold text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-violet-300"
                            />
                        </div>

                        <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
                            {CATEGORIES.map((category) => {
                                const selected =
                                    category === activeCategory;

                                return (
                                    <button
                                        key={category}
                                        type="button"
                                        onClick={() =>
                                            setActiveCategory(
                                                category,
                                            )
                                        }
                                        className="shrink-0 rounded-full px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.14em] transition-all"
                                        style={
                                            selected
                                                ? {
                                                    color: "#FFFFFF",
                                                    background:
                                                        "linear-gradient(135deg, #8B5CF6, #3B82F6)",
                                                }
                                                : {
                                                    color: "#64748B",
                                                    background:
                                                        "rgba(255,255,255,0.65)",
                                                    border:
                                                        "1px solid rgba(15,23,42,0.08)",
                                                }
                                        }
                                    >
                                        {category}
                                    </button>
                                );
                            })}
                        </div>

                        <select
                            value={sort}
                            onChange={(event) =>
                                setSort(
                                    event.target.value as
                                    | "popular"
                                    | "closing"
                                    | "probability",
                                )
                            }
                            className="h-12 rounded-[14px] border border-black/10 bg-white/70 px-4 text-[10px] font-black uppercase tracking-[0.12em] text-slate-600 outline-none"
                        >
                            <option value="popular">
                                Most popular
                            </option>

                            <option value="closing">
                                Closing soon
                            </option>

                            <option value="probability">
                                Highest probability
                            </option>
                        </select>
                    </div>
                </section>

                <section className="mt-9">
                    <div className="mb-5 flex items-center justify-between">
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
                                Market collection
                            </p>

                            <p className="mt-1 text-[13px] font-semibold text-slate-600">
                                {filteredMarkets.length} markets found
                            </p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                            {Array.from({
                                length: 3,
                            }).map((_, index) => (
                                <div
                                    key={index}
                                    className="h-[520px] animate-pulse rounded-[26px] border border-black/10 bg-white/60"
                                />
                            ))}
                        </div>
                    ) : loadError ? (
                        <div className="rounded-[28px] border border-red-200 bg-red-50 px-6 py-16 text-center">
                            <h2 className="text-xl font-black text-red-700">
                                Markets unavailable
                            </h2>

                            <p className="mt-3 text-sm text-red-600">
                                {loadError}
                            </p>
                        </div>
                    ) : filteredMarkets.length > 0 ? (
                        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                            {filteredMarkets.map(
                                (
                                    market,
                                    index,
                                ) => (
                                    <MarketCard
                                        key={
                                            market.id
                                        }
                                        market={
                                            market
                                        }
                                        index={
                                            index
                                        }
                                    />
                                ),
                            )}
                        </div>
                    ) : (
                        <div className="rounded-[28px] border border-dashed border-black/15 bg-[#fffdf8]/70 px-6 py-20 text-center">
                            <Search className="mx-auto h-7 w-7 text-slate-400" />

                            <h2
                                className="mt-5 text-[26px] font-black uppercase tracking-[-0.035em] text-slate-900"
                                style={{
                                    fontFamily:
                                        "var(--font-display)",
                                }}
                            >
                                No markets found
                            </h2>

                            <p className="mt-3 text-[13px] font-medium text-slate-500">
                                Try another search term or category.
                            </p>

                            <button
                                type="button"
                                onClick={() => {
                                    setQuery("");
                                    setActiveCategory(
                                        "All",
                                    );
                                }}
                                className="mt-6 rounded-[13px] bg-slate-950 px-5 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-white"
                            >
                                Reset filters
                            </button>
                        </div>
                    )}
    </section>

            </div>
        </main>
    );
}

function StatCard({
    icon: Icon,
    label,
    value,
    className = "",
}: {
    icon: typeof WalletCards;
    label: string;
    value: string;
    className?: string;
}) {
    return (
        <div
            className={`min-w-[128px] rounded-[18px] border border-black/10 bg-[#fffdf8]/75 p-4 backdrop-blur-md ${className}`}
        >
            <div className="flex items-center gap-2 text-violet-600">
                <Icon className="h-3.5 w-3.5" />

                <span className="text-[7px] font-black uppercase tracking-[0.15em] text-slate-400">
                    {label}
                </span>
            </div>

            <p className="mt-3 font-mono text-[18px] font-black text-slate-900">
                {value}
            </p>
        </div>
    );
}