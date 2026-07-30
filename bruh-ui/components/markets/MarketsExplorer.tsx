"use client";

import { useMemo, useState } from "react";
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

type MarketCategory =
    | "All"
    | "Crypto"
    | "AI"
    | "Politics"
    | "Economy"
    | "Technology";

type Market = {
    id: string;
    question: string;
    category: Exclude<MarketCategory, "All">;
    description: string;
    yesProbability: number;
    volume: number;
    traders: number;
    agents: number;
    closesIn: string;
    change: number;
    featured?: boolean;
};

const CATEGORIES: MarketCategory[] = [
    "All",
    "Crypto",
    "AI",
    "Politics",
    "Economy",
    "Technology",
];

const MARKETS: Market[] = [
    {
        id: "eth-above-4000-friday",
        question: "Will ETH close above $4,000 this Friday?",
        category: "Crypto",
        description:
            "Resolves YES if the official ETH/USD closing price is above $4,000 at the specified market deadline.",
        yesProbability: 64,
        volume: 18420,
        traders: 213,
        agents: 7,
        closesIn: "2d 14h",
        change: 3.2,
        featured: true,
    },
    {
        id: "openai-new-model-august",
        question: "Will OpenAI announce a new model before August?",
        category: "AI",
        description:
            "Resolves using an official announcement published by OpenAI before the market deadline.",
        yesProbability: 58,
        volume: 12750,
        traders: 184,
        agents: 6,
        closesIn: "5d 8h",
        change: 1.8,
        featured: true,
    },
    {
        id: "fed-rate-cut-september",
        question: "Will the Federal Reserve cut rates in September?",
        category: "Economy",
        description:
            "Resolves YES if the target federal funds range is reduced during the September meeting.",
        yesProbability: 38,
        volume: 24620,
        traders: 328,
        agents: 8,
        closesIn: "19d",
        change: -2.4,
    },
    {
        id: "btc-etf-inflow-billion",
        question: "Will weekly Bitcoin ETF inflows exceed $1 billion?",
        category: "Crypto",
        description:
            "Tracks combined net inflows across eligible spot Bitcoin exchange-traded funds.",
        yesProbability: 71,
        volume: 19380,
        traders: 247,
        agents: 9,
        closesIn: "4d 3h",
        change: 5.1,
    },
    {
        id: "ai-agent-company-ipo",
        question: "Will an AI-agent company file for an IPO this year?",
        category: "AI",
        description:
            "Resolves from a publicly accessible regulatory filing by a qualifying AI-agent company.",
        yesProbability: 43,
        volume: 8940,
        traders: 116,
        agents: 5,
        closesIn: "84d",
        change: -0.8,
    },
    {
        id: "new-us-stablecoin-law",
        question: "Will the US pass a new stablecoin law this year?",
        category: "Politics",
        description:
            "Resolves YES if qualifying federal stablecoin legislation is signed into law.",
        yesProbability: 69,
        volume: 22100,
        traders: 301,
        agents: 8,
        closesIn: "112d",
        change: 2.7,
    },
    {
        id: "solana-daily-transactions",
        question: "Will Solana process over 150M transactions tomorrow?",
        category: "Technology",
        description:
            "Uses the final daily transaction total reported by the designated blockchain data source.",
        yesProbability: 54,
        volume: 7680,
        traders: 91,
        agents: 4,
        closesIn: "17h",
        change: 0.9,
    },
    {
        id: "inflation-below-three",
        question: "Will US annual inflation fall below 3% next month?",
        category: "Economy",
        description:
            "Resolves from the official year-over-year CPI figure published for the target month.",
        yesProbability: 46,
        volume: 15320,
        traders: 205,
        agents: 6,
        closesIn: "31d",
        change: -1.3,
    },
    {
        id: "apple-ai-device",
        question: "Will Apple announce a dedicated AI device this year?",
        category: "Technology",
        description:
            "Requires an official Apple announcement for a standalone consumer device primarily positioned around AI.",
        yesProbability: 32,
        volume: 10640,
        traders: 142,
        agents: 5,
        closesIn: "96d",
        change: 2.1,
    },
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

function MarketCard({
    market,
    index,
}: {
    market: Market;
    index: number;
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
    const [activeCategory, setActiveCategory] =
        useState<MarketCategory>("All");

    const [query, setQuery] = useState("");
    const [sort, setSort] = useState<
        "popular" | "closing" | "probability"
    >("popular");

    const filteredMarkets = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();

        const filtered = MARKETS.filter((market) => {
            const categoryMatches =
                activeCategory === "All" ||
                market.category === activeCategory;

            const searchMatches =
                !normalizedQuery ||
                market.question
                    .toLowerCase()
                    .includes(normalizedQuery) ||
                market.description
                    .toLowerCase()
                    .includes(normalizedQuery) ||
                market.category
                    .toLowerCase()
                    .includes(normalizedQuery);

            return categoryMatches && searchMatches;
        });

        return [...filtered].sort((first, second) => {
            if (sort === "probability") {
                return (
                    second.yesProbability -
                    first.yesProbability
                );
            }

            if (sort === "closing") {
                return first.closesIn.localeCompare(
                    second.closesIn,
                );
            }

            return second.volume - first.volume;
        });
    }, [activeCategory, query, sort]);

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
                                    {MARKETS.length} open markets
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
                            value="$139K"
                        />

                        <StatCard
                            icon={Users}
                            label="Traders"
                            value="1.8K"
                        />

                        <StatCard
                            icon={Bot}
                            label="Active agents"
                            value="12"
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

                    {filteredMarkets.length > 0 ? (
                        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                            {filteredMarkets.map(
                                (market, index) => (
                                    <MarketCard
                                        key={market.id}
                                        market={market}
                                        index={index}
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
                                    setActiveCategory("All");
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