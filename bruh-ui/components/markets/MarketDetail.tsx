"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import {
    motion,
    useReducedMotion,
} from "framer-motion";
import {
    ArrowLeft,
    ArrowUpRight,
    Bot,
    BrainCircuit,
    CheckCircle2,
    Clock3,
    Copy,
    ExternalLink,
    FileText,
    Info,
    ShieldCheck,
    Sparkles,
    TrendingDown,
    TrendingUp,
    Users,
    WalletCards,
    Zap,
} from "lucide-react";

import {
    getMarketPriceHistory,
    getPublicMarket,
    type MarketPricePoint,
    type PublicMarket,
} from "@/src/lib/api";


type Market = {
    id: string;
    address: `0x${string}`;
    question: string;

    category:
    | "Crypto"
    | "AI"
    | "Politics"
    | "Economy"
    | "Technology";

    description: string;
    resolution: string;
    source: string;

    yesProbability: number;
    noProbability: number;

    collateralUsdc: number;
    totalSharesYes: number;
    totalSharesNo: number;

    closesIn: string;
    closeDate: string;

    creator: string;
    oracle: string;

    feeBps: number;
    open: boolean;
    resolved: boolean;

    outcome:
    | "UNRESOLVED"
    | "YES"
    | "NO"
    | "INVALID";
};

type Trade = {
    id: number;
    agent: string;
    side: "YES" | "NO";
    amount: string;
    probability: string;
    time: string;
    tx: string;
};

type ReasoningItem = {
    agent: string;
    title: string;
    description: string;
    confidence: number;
    time: string;
};


const TRADES: Trade[] = [
    {
        id: 1,
        agent: "Newshound",
        side: "YES",
        amount: "4.20 USDC",
        probability: "61¢",
        time: "2m ago",
        tx: "0x3f8a…c21e",
    },
    {
        id: 2,
        agent: "Actuary",
        side: "NO",
        amount: "2.10 USDC",
        probability: "39¢",
        time: "6m ago",
        tx: "0x7d2b…f44a",
    },
    {
        id: 3,
        agent: "Newshound",
        side: "YES",
        amount: "3.80 USDC",
        probability: "59¢",
        time: "11m ago",
        tx: "0x1c9e…a83d",
    },
    {
        id: 4,
        agent: "Actuary",
        side: "YES",
        amount: "1.60 USDC",
        probability: "57¢",
        time: "18m ago",
        tx: "0x9a4f…b12c",
    },
];

const REASONING: ReasoningItem[] = [
    {
        agent: "Newshound",
        title: "Momentum strengthened",
        description:
            "Recent ETF inflows, derivative positioning, and positive market sentiment increased the short-term probability estimate.",
        confidence: 78,
        time: "2m ago",
    },
    {
        agent: "Actuary",
        title: "Base rate remains cautious",
        description:
            "Historical Friday close distributions still imply meaningful downside risk despite recent momentum.",
        confidence: 66,
        time: "6m ago",
    },
];

const CATEGORY_THEMES = {
    Crypto: {
        primary: "#8B5CF6",
        secondary: "#6366F1",
        soft: "#F3EEFF",
        border: "rgba(139,92,246,0.25)",
        text: "#6D28D9",
        glow: "rgba(139,92,246,0.28)",
    },
    AI: {
        primary: "#6366F1",
        secondary: "#3B82F6",
        soft: "#EEF2FF",
        border: "rgba(99,102,241,0.25)",
        text: "#4F46E5",
        glow: "rgba(99,102,241,0.28)",
    },
    Politics: {
        primary: "#D946EF",
        secondary: "#8B5CF6",
        soft: "#FDF4FF",
        border: "rgba(217,70,239,0.24)",
        text: "#A21CAF",
        glow: "rgba(217,70,239,0.25)",
    },
    Economy: {
        primary: "#2563EB",
        secondary: "#06B6D4",
        soft: "#EFF6FF",
        border: "rgba(37,99,235,0.24)",
        text: "#1D4ED8",
        glow: "rgba(37,99,235,0.25)",
    },
    Technology: {
        primary: "#0EA5E9",
        secondary: "#6366F1",
        soft: "#F0F9FF",
        border: "rgba(14,165,233,0.24)",
        text: "#0369A1",
        glow: "rgba(14,165,233,0.25)",
    },
};

function formatMoney(value: number) {
    return new Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: 1,
    }).format(value);
}

function inferMarketCategory(
    question: string,
): Market["category"] {
    const value =
        question.toLowerCase();

    if (
        value.includes("btc") ||
        value.includes("bitcoin") ||
        value.includes("eth") ||
        value.includes("ethereum") ||
        value.includes("crypto")
    ) {
        return "Crypto";
    }

    if (
        value.includes("ai") ||
        value.includes("openai") ||
        value.includes("model")
    ) {
        return "AI";
    }

    if (
        value.includes("election") ||
        value.includes("president") ||
        value.includes("government")
    ) {
        return "Politics";
    }

    if (
        value.includes("fed") ||
        value.includes("rate") ||
        value.includes("economy") ||
        value.includes("inflation")
    ) {
        return "Economy";
    }

    return "Technology";
}

function formatClosingTime(
    closeTime: string,
): string {
    const remaining =
        new Date(closeTime).getTime() -
        Date.now();

    if (remaining <= 0) {
        return "Closed";
    }

    const hours =
        Math.floor(
            remaining / 3_600_000,
        );

    if (hours < 24) {
        return `${hours}h`;
    }

    return `${Math.floor(
        hours / 24,
    )}d`;
}

function formatCloseDate(
    closeTime: string,
): string {
    return new Date(
        closeTime,
    ).toLocaleString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZoneName: "short",
        },
    );
}

function shortenAddress(
    address: string,
): string {
    return `${address.slice(
        0,
        6,
    )}…${address.slice(-4)}`;
}

function toMarketView(
    market: PublicMarket,
): Market {
    return {
        id:
            market.id,

        address:
            market.address,

        question:
            market.question,

        category:
            inferMarketCategory(
                market.question,
            ),

        description:
            market.resolved
                ? `This market has resolved as ${market.outcome}.`
                : market.open
                    ? "This prediction market is currently open on Arc Testnet."
                    : "This market is closed and awaiting resolution.",

        resolution:
            `The designated oracle ${shortenAddress(
                market.oracle,
            )} resolves this market after the closing time.`,

        source:
            `Oracle ${shortenAddress(
                market.oracle,
            )}`,

        yesProbability:
            market.yesPrice *
            100,

        noProbability:
            market.noPrice *
            100,

        collateralUsdc:
            market.collateralUsdc,

        totalSharesYes:
            market.totalSharesYes,

        totalSharesNo:
            market.totalSharesNo,

        closesIn:
            formatClosingTime(
                market.closeTime,
            ),

        closeDate:
            formatCloseDate(
                market.closeTime,
            ),

        creator:
            market.creator,

        oracle:
            market.oracle,

        feeBps:
            market.feeBps,

        open:
            market.open,

        resolved:
            market.resolved,

        outcome:
            market.outcome,
    };
}


export default function MarketDetail({
    marketId,
}: {
    marketId: string;
}) {
    const reduceMotion = useReducedMotion();

    const [
        publicMarket,
        setPublicMarket,
    ] =
        useState<
            PublicMarket | null
        >(null);

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

    const [selectedSide, setSelectedSide] =
        useState<"YES" | "NO">("YES");

    const [amount, setAmount] = useState("10");
    const [activeTab, setActiveTab] = useState<
        "overview" | "activity" | "reasoning"
    >("overview");

    const [
    priceHistory,
    setPriceHistory,
] = useState<
    MarketPricePoint[]
>([]);

const [
    historyLoading,
    setHistoryLoading,
] = useState(true);

    useEffect(() => {
        let cancelled =
            false;

        async function loadMarket() {
            setLoading(true);
            setLoadError(null);

            try {
                const result =
                    await getPublicMarket(
                        marketId,
                    );

                if (!cancelled) {
                    setPublicMarket(
                        result,
                    );
                }
            } catch (error) {
                console.error(
                    "Failed to load market:",
                    error,
                );

                if (!cancelled) {
                    setLoadError(
                        error instanceof
                            Error
                            ? error.message
                            : "Failed to load market.",
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

        void loadMarket();

        return () => {
            cancelled =
                true;
        };
    }, [
        marketId,
    ]);


    useEffect(() => {
    let cancelled =
        false;

    async function loadHistory() {
        try {
            const history =
                await getMarketPriceHistory(
                    marketId,
                );

            if (!cancelled) {
                setPriceHistory(
                    history,
                );

                setHistoryLoading(
                    false,
                );
            }
        } catch (error) {
            console.error(
                "Failed to load market history:",
                error,
            );

            if (!cancelled) {
                setHistoryLoading(
                    false,
                );
            }
        }
    }

    void loadHistory();

    const interval =
        window.setInterval(
            () => {
                void loadHistory();
            },
            120000,
        );

    return () => {
        cancelled =
            true;

        window.clearInterval(
            interval,
        );
    };
}, [
    marketId,
]);

    const market =
        useMemo(
            () =>
                publicMarket
                    ? toMarketView(
                        publicMarket,
                    )
                    : null,
            [
                publicMarket,
            ],
        );


    if (loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#f7f6f2] px-6">
                <div className="w-full max-w-4xl animate-pulse space-y-5">
                    <div className="h-5 w-36 rounded-full bg-slate-200" />

                    <div className="h-16 w-full rounded-2xl bg-slate-200" />

                    <div className="grid gap-4 sm:grid-cols-4">
                        {Array.from({
                            length: 4,
                        }).map(
                            (_, index) => (
                                <div
                                    key={index}
                                    className="h-28 rounded-[20px] bg-slate-200"
                                />
                            ),
                        )}
                    </div>

                    <div className="h-80 rounded-[28px] bg-slate-200" />
                </div>
            </main>
        );
    }

    if (
        loadError ||
        !market
    ) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#f7f6f2] px-6">
                <div className="w-full max-w-lg rounded-[28px] border border-red-200 bg-red-50 p-8 text-center">
                    <h1 className="text-2xl font-black text-red-700">
                        Market unavailable
                    </h1>

                    <p className="mt-3 text-sm leading-6 text-red-600">
                        {loadError ??
                            "The requested market could not be found."}
                    </p>

                    <Link
                        href="/markets"
                        className="mt-7 inline-flex rounded-[14px] bg-slate-950 px-5 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-white"
                    >
                        Back to markets
                    </Link>
                </div>
            </main>
        );
    }
    const theme =
        CATEGORY_THEMES[
        market.category
        ];

    const yesProbability =
        market.yesProbability.toFixed(
            1,
        );

    const noProbability =
        market.noProbability.toFixed(
            1,
        );


    const selectedProbability =
    selectedSide === "YES"
        ? market.yesProbability
        : market.noProbability;

    const estimatedShares =
        Number(amount || 0) /
        Math.max(selectedProbability / 100, 0.01);

    const estimatedReturn = estimatedShares;



    return (
        <main className="relative min-h-screen overflow-hidden bg-[#f7f6f2] pb-24 pt-28">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-[-220px] top-20 h-[520px] w-[520px] rounded-full bg-violet-300/10 blur-[165px]" />

                <div className="absolute right-[-220px] top-36 h-[520px] w-[520px] rounded-full bg-blue-300/10 blur-[165px]" />

                <div
                    className="absolute inset-0 opacity-[0.022]"
                    style={{
                        backgroundImage: `
                            linear-gradient(
                                to right,
                                rgba(99,102,241,0.18) 1px,
                                transparent 1px
                            ),
                            linear-gradient(
                                to bottom,
                                rgba(99,102,241,0.18) 1px,
                                transparent 1px
                            )
                        `,
                        backgroundSize: "48px 48px",
                    }}
                />
            </div>

            <div className="relative mx-auto max-w-7xl px-6">
                <Link
                    href="/markets"
                    className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 transition-colors hover:text-violet-600"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to markets
                </Link>

                <section className="mt-8 grid gap-8 xl:grid-cols-[1fr_380px]">
                    <div className="min-w-0">
                        <motion.div
                            initial={
                                reduceMotion
                                    ? { opacity: 1 }
                                    : {
                                        opacity: 0,
                                        y: 18,
                                    }
                            }
                            animate={{
                                opacity: 1,
                                y: 0,
                            }}
                            transition={{
                                duration: 0.45,
                            }}
                        >
                            <div className="flex flex-wrap items-center gap-3">
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

                                <span className="flex items-center gap-1.5 rounded-full border border-black/10 bg-white/60 px-3 py-1.5 font-mono text-[8px] font-black uppercase tracking-[0.14em] text-slate-500">
                                    <Clock3 className="h-3 w-3" />

{market.open
    ? `Closes in ${market.closesIn}`
    : market.resolved
      ? `Resolved ${market.outcome}`
      : "Closed"}
                                </span>


                            </div>

                            <h1
                                className="mt-6 max-w-5xl text-[44px] font-black leading-[0.96] tracking-[-0.05em] text-slate-950 sm:text-[62px]"
                                style={{
                                    fontFamily:
                                        "var(--font-display)",
                                }}
                            >
                                {market.question}
                            </h1>

                            <p className="mt-6 max-w-3xl text-[15px] font-medium leading-[1.75] text-slate-600">
                                {market.description}
                            </p>
                        </motion.div>

                        <section className="mt-9 grid gap-4 sm:grid-cols-4">
                            <MetricCard
                                icon={WalletCards}
                                label="Collateral"
                                value={`${formatMoney(
                                    market.collateralUsdc,
                                )} USDC`}
                            />

                            <MetricCard
                                icon={TrendingUp}
                                label="YES shares"
                                value={formatMoney(
                                    market.totalSharesYes,
                                )}
                            />

                            <MetricCard
                                icon={TrendingDown}
                                label="NO shares"
                                value={formatMoney(
                                    market.totalSharesNo,
                                )}
                            />

                            <MetricCard
                                icon={ShieldCheck}
                                label="Trading fee"
                                value={`${(
                                    market.feeBps /
                                    100
                                ).toFixed(2)}%`}
                            />
                        </section>

                        <section
                            className="mt-8 overflow-hidden rounded-[28px] border p-[2px]"
                            style={{
                                background: `linear-gradient(
                                    135deg,
                                    ${theme.primary},
                                    ${theme.secondary}
                                )`,
                                boxShadow: `0 30px 70px -46px ${theme.glow}`,
                            }}
                        >
                            <div
                                className="rounded-[26px] p-5 sm:p-7"
                                style={{
                                    background: `
                                        radial-gradient(
                                            circle at 90% 0%,
                                            ${theme.soft},
                                            transparent 35%
                                        ),
                                        linear-gradient(
                                            145deg,
                                            #fffdf8,
                                            #f8f3eb
                                        )
                                    `,
                                }}
                            >
                                <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                                    <div>
                                        <p className="text-[8px] font-black uppercase tracking-[0.18em] text-slate-400">
                                            Current market probability
                                        </p>

                                        <div className="mt-3 flex items-end gap-3">
                                            <span
                                                className="font-mono text-[58px] font-black leading-none"
                                                style={{
                                                    color: theme.text,
                                                }}
                                            >
                                                {yesProbability}%
                                                
                                            </span>

                                            <span className="pb-1 text-[11px] font-black uppercase tracking-[0.15em] text-slate-500">
                                                YES
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex gap-3">
                                        <div className="rounded-[15px] border border-emerald-200 bg-emerald-50 px-4 py-3">
                                            <p className="text-[7px] font-black uppercase tracking-[0.15em] text-emerald-600">
                                                YES
                                            </p>

                                            <p className="mt-1 font-mono text-[16px] font-black text-emerald-700">
                                                {yesProbability}¢
                                            </p>
                                        </div>

                                        <div className="rounded-[15px] border border-rose-200 bg-rose-50 px-4 py-3">
                                            <p className="text-[7px] font-black uppercase tracking-[0.15em] text-rose-600">
                                                NO
                                            </p>

                                            <p className="mt-1 font-mono text-[16px] font-black text-rose-700">
                                                {noProbability}¢
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-7 flex h-3 overflow-hidden rounded-full bg-slate-200">
                                    <motion.div
                                        initial={{
                                            width: 0,
                                        }}
                                        animate={{
                                            width: `${yesProbability}%`,
                                        }}
                                        transition={{
                                            duration: 0.8,
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

                             <MarketPriceChart
    points={
        priceHistory
    }
    loading={
        historyLoading
    }
    theme={
        theme
    }
/>
                            </div>
                        </section>

                        <section className="mt-8">
                            <div className="flex gap-2 overflow-x-auto border-b border-black/10">
                                {[
                                    {
                                        id: "overview",
                                        label: "Overview",
                                    },
                                    {
                                        id: "activity",
                                        label: "Activity",
                                    },
                                    {
                                        id: "reasoning",
                                        label: "Agent reasoning",
                                    },
                                ].map((tab) => {
                                    const selected =
                                        activeTab === tab.id;

                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() =>
                                                setActiveTab(
                                                    tab.id as typeof activeTab,
                                                )
                                            }
                                            className="relative shrink-0 px-4 pb-4 pt-2 text-[9px] font-black uppercase tracking-[0.15em]"
                                            style={{
                                                color: selected
                                                    ? theme.text
                                                    : "#94A3B8",
                                            }}
                                        >
                                            {tab.label}

                                            {selected && (
                                                <motion.span
                                                    layoutId="market-tab"
                                                    className="absolute inset-x-0 bottom-0 h-[2px] rounded-full"
                                                    style={{
                                                        background: `linear-gradient(
                                                            90deg,
                                                            ${theme.primary},
                                                            ${theme.secondary}
                                                        )`,
                                                    }}
                                                />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="pt-6">
                                {activeTab === "overview" && (
                                    <OverviewTab
                                        market={market}
                                        theme={theme}
                                    />
                                )}

                                {activeTab === "activity" && (
                                    <ActivityTab />
                                )}

                                {activeTab === "reasoning" && (
                                    <ReasoningTab
                                        theme={theme}
                                    />
                                )}
                            </div>
                        </section>
                    </div>

                    <aside className="xl:sticky xl:top-28 xl:h-fit">
                        <div
                            className="overflow-hidden rounded-[28px] border p-[2px]"
                            style={{
                                background: `linear-gradient(
                                    135deg,
                                    ${theme.primary},
                                    ${theme.secondary}
                                )`,
                                boxShadow: `0 30px 70px -42px ${theme.glow}`,
                            }}
                        >
                            <div className="rounded-[26px] bg-[#fffdf8] p-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[8px] font-black uppercase tracking-[0.18em] text-slate-400">
                                            Trade market
                                        </p>

                                        <p className="mt-1 text-[13px] font-black text-slate-900">
                                            Choose an outcome
                                        </p>
                                    </div>

                                    <Zap
                                        className="h-5 w-5"
                                        style={{
                                            color: theme.text,
                                        }}
                                    />
                                </div>

                                <div className="mt-5 grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setSelectedSide(
                                                "YES",
                                            )
                                        }
                                        disabled={!market.open}
                                        className="rounded-[16px] border px-4 py-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50"
                                        style={
                                            selectedSide === "YES"
                                                ? {
                                                    borderColor:
                                                        "rgba(16,185,129,0.4)",
                                                    background:
                                                        "#ECFDF5",
                                                    boxShadow:
                                                        "0 12px 24px -20px rgba(16,185,129,0.65)",
                                                }
                                                : {
                                                    borderColor:
                                                        "rgba(15,23,42,0.1)",
                                                    background:
                                                        "rgba(255,255,255,0.6)",
                                                }
                                        }
                                    >
                                        <p className="text-[8px] font-black uppercase tracking-[0.15em] text-emerald-600">
                                            YES
                                        </p>

                                       <p className="mt-2 font-mono text-[22px] font-black text-emerald-700">
    {yesProbability}¢
</p>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setSelectedSide("NO")
                                        }
                                        className="rounded-[16px] border px-4 py-4 text-left transition-all"
                                        style={
                                            selectedSide === "NO"
                                                ? {
                                                    borderColor:
                                                        "rgba(244,63,94,0.38)",
                                                    background:
                                                        "#FFF1F2",
                                                    boxShadow:
                                                        "0 12px 24px -20px rgba(244,63,94,0.55)",
                                                }
                                                : {
                                                    borderColor:
                                                        "rgba(15,23,42,0.1)",
                                                    background:
                                                        "rgba(255,255,255,0.6)",
                                                }
                                        }
                                    >
                                        <p className="text-[8px] font-black uppercase tracking-[0.15em] text-rose-600">
                                            NO
                                        </p>

                                        <p className="mt-2 font-mono text-[22px] font-black text-rose-700">
                                            {noProbability}¢
                                        </p>
                                    </button>
                                </div>

                                <div className="mt-5">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[8px] font-black uppercase tracking-[0.15em] text-slate-400">
                                            Amount
                                        </label>

                                        <span className="font-mono text-[9px] font-semibold text-slate-400">
                                            Balance: 124.80 USDC
                                        </span>
                                    </div>

                                    <div className="mt-2 flex items-center rounded-[15px] border border-black/10 bg-white px-4">
                                        <input
                                            value={amount}
                                            onChange={(event) =>
                                                setAmount(
                                                    event.target
                                                        .value,
                                                )
                                            }
                                            inputMode="decimal"
                                            className="h-13 min-w-0 flex-1 bg-transparent font-mono text-[18px] font-black text-slate-900 outline-none"
                                        />

                                        <span className="text-[10px] font-black text-slate-500">
                                            USDC
                                        </span>
                                    </div>

                                    <div className="mt-3 grid grid-cols-4 gap-2">
                                        {[
                                            "5",
                                            "10",
                                            "25",
                                            "50",
                                        ].map((value) => (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() =>
                                                    setAmount(
                                                        value,
                                                    )
                                                }
                                                className="rounded-[10px] border border-black/10 bg-white/70 py-2 font-mono text-[9px] font-black text-slate-500 hover:border-violet-300 hover:text-violet-600"
                                            >
                                                ${value}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="mt-5 rounded-[16px] border border-black/10 bg-slate-50/70 p-4">
                                    <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500">
                                        <span>Estimated shares</span>

                                        <span className="font-mono font-black text-slate-800">
                                            {estimatedShares.toFixed(
                                                2,
                                            )}
                                        </span>
                                    </div>

                                    <div className="mt-3 flex items-center justify-between text-[10px] font-semibold text-slate-500">
                                        <span>
                                            Potential return
                                        </span>

                                        <span className="font-mono font-black text-emerald-700">
                                            $
                                            {estimatedReturn.toFixed(
                                                2,
                                            )}
                                        </span>
                                    </div>
                                </div>

                                <motion.button
                                    type="button"
                                    disabled={!market.open}
                                    whileHover={{
                                        y: -2,
                                    }}
                                    whileTap={{
                                        scale: 0.98,
                                    }}
                                   className="mt-5 flex w-full items-center justify-center gap-2 rounded-[14px] px-5 py-3.5 text-[10px] font-black uppercase tracking-[0.12em] text-white disabled:cursor-not-allowed disabled:opacity-50"
                                    style={{
                                        background:
                                            selectedSide === "YES"
                                                ? "linear-gradient(135deg, #10B981, #059669)"
                                                : "linear-gradient(135deg, #F43F5E, #E11D48)",
                                    }}
                                >
                                    {market.open
    ? `Buy ${selectedSide}`
    : "Market closed"}

                                    <ArrowUpRight className="h-3.5 w-3.5" />
                                </motion.button>

                                <p className="mt-3 text-center text-[8px] font-semibold leading-relaxed text-slate-400">
                                    Your transaction will be submitted
                                    to the Arc market contract.
                                </p>
                            </div>
                        </div>

                        <div className="mt-4 rounded-[22px] border border-black/10 bg-[#fffdf8]/80 p-4">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4 text-violet-600" />

                                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-700">
                                    Market integrity
                                </p>
                            </div>

                            <ul className="mt-4 flex flex-col gap-3">
                                {[
                                    "Deterministic settlement",
                                    "Public resolution criteria",
                                    "Onchain transaction history",
                                ].map((item) => (
                                    <li
                                        key={item}
                                        className="flex items-center gap-2 text-[10px] font-semibold text-slate-500"
                                    >
                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </aside>
                </section>
            </div>
        </main>
    );
}


function MarketPriceChart({
    points,
    loading,
    theme,
}: {
    points:
        MarketPricePoint[];

    loading:
        boolean;

    theme:
        (typeof CATEGORY_THEMES)[keyof typeof CATEGORY_THEMES];
}) {
    if (loading) {
        return (
            <div className="mt-7 h-[230px] animate-pulse rounded-[20px] border border-black/10 bg-white/50" />
        );
    }

    if (points.length === 0) {
        return (
            <div className="mt-7 flex h-[230px] items-center justify-center rounded-[20px] border border-black/10 bg-white/50 p-5 text-center">
                <p className="text-[11px] font-medium text-slate-400">
                    No market price history is available yet.
                </p>
            </div>
        );
    }

    const width =
        720;

    const height =
        190;

    const padding =
        18;

    const values =
        points.map(
            (point) =>
                point.yesPrice *
                100,
        );

    const minimum =
        Math.min(
            ...values,
        );

    const maximum =
        Math.max(
            ...values,
        );

    const range =
        Math.max(
            maximum -
                minimum,
            1,
        );

    const coordinates =
        points.map(
            (
                point,
                index,
            ) => {
                const x =
                    points.length === 1
                        ? width /
                          2
                        : padding +
                          (index /
                              (points.length -
                                  1)) *
                              (width -
                                  padding *
                                      2);

                const y =
                    padding +
                    ((maximum -
                        point.yesPrice *
                            100) /
                        range) *
                        (height -
                            padding *
                                2);

                return {
                    x,
                    y,
                };
            },
        );

    const linePath =
        coordinates
            .map(
                (
                    point,
                    index,
                ) =>
                    `${
                        index === 0
                            ? "M"
                            : "L"
                    } ${point.x} ${point.y}`,
            )
            .join(" ");

    const areaPath =
        coordinates.length > 0
            ? `${linePath} L ${
                  coordinates[
                      coordinates.length -
                          1
                  ].x
              } ${height} L ${
                  coordinates[0].x
              } ${height} Z`
            : "";

    const latest =
        values[
            values.length -
                1
        ];

    return (
        <div className="mt-7 rounded-[20px] border border-black/10 bg-white/50 p-5">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-[8px] font-black uppercase tracking-[0.15em] text-slate-400">
                        YES probability history
                    </p>

                    <p
                        className="mt-2 font-mono text-[20px] font-black"
                        style={{
                            color:
                                theme.text,
                        }}
                    >
                        {latest.toFixed(
                            1,
                        )}
                        %
                    </p>
                </div>

                <span className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.12em] text-slate-500">
                    Live · 10s
                </span>
            </div>

            <div className="mt-4 overflow-hidden">
                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className="h-[170px] w-full"
                    preserveAspectRatio="none"
                    role="img"
                    aria-label="YES probability history chart"
                >
                    <defs>
                        <linearGradient
                            id="market-chart-area"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
                            <stop
                                offset="0%"
                                stopColor={
                                    theme.primary
                                }
                                stopOpacity="0.28"
                            />

                            <stop
                                offset="100%"
                                stopColor={
                                    theme.primary
                                }
                                stopOpacity="0"
                            />
                        </linearGradient>
                    </defs>

                    <path
                        d={
                            areaPath
                        }
                        fill="url(#market-chart-area)"
                    />

                    <path
                        d={
                            linePath
                        }
                        fill="none"
                        stroke={
                            theme.primary
                        }
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {coordinates.map(
                        (
                            point,
                            index,
                        ) => (
                            <circle
                                key={
                                    index
                                }
                                cx={
                                    point.x
                                }
                                cy={
                                    point.y
                                }
                                r="5"
                                fill="#fff"
                                stroke={
                                    theme.primary
                                }
                                strokeWidth="3"
                            />
                        ),
                    )}
                </svg>
            </div>

            <div className="mt-2 flex items-center justify-between font-mono text-[8px] font-black uppercase tracking-[0.12em] text-slate-400">
                <span>
                    {new Date(
                        points[0]
                            .timestamp,
                    ).toLocaleDateString()}
                </span>

                <span>
                    {new Date(
                        points[
                            points.length -
                                1
                        ].timestamp,
                    ).toLocaleTimeString(
                        [],
                        {
                            hour:
                                "2-digit",
                            minute:
                                "2-digit",
                        },
                    )}
                </span>
            </div>
        </div>
    );
}


function MetricCard({
    icon: Icon,
    label,
    value,
}: {
    icon: typeof WalletCards;
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-[18px] border border-black/10 bg-[#fffdf8]/75 p-4 backdrop-blur-md">
            <div className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-violet-600" />

                <span className="text-[7px] font-black uppercase tracking-[0.15em] text-slate-400">
                    {label}
                </span>
            </div>

            <p className="mt-3 font-mono text-[17px] font-black text-slate-900">
                {value}
            </p>
        </div>
    );
}

function OverviewTab({
    market,
    theme,
}: {
    market: Market;
    theme: (typeof CATEGORY_THEMES)[keyof typeof CATEGORY_THEMES];
}) {
    return (
        <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-[22px] border border-black/10 bg-[#fffdf8]/75 p-5">
                <div className="flex items-center gap-2">
                    <FileText
                        className="h-4 w-4"
                        style={{
                            color: theme.text,
                        }}
                    />

                    <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-800">
                        Resolution criteria
                    </h3>
                </div>

                <p className="mt-4 text-[12px] font-medium leading-[1.75] text-slate-500">
                    {market.resolution}
                </p>

                <div className="mt-5 rounded-[14px] border border-black/10 bg-white/60 p-4">
                    <p className="text-[7px] font-black uppercase tracking-[0.15em] text-slate-400">
                        Resolution source
                    </p>

                    <p className="mt-2 text-[11px] font-black text-slate-700">
                        {market.source}
                    </p>
                </div>
            </div>

            <div className="rounded-[22px] border border-black/10 bg-[#fffdf8]/75 p-5">
                <div className="flex items-center gap-2">
                    <Info
                        className="h-4 w-4"
                        style={{
                            color: theme.text,
                        }}
                    />

                    <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-800">
                        Market information
                    </h3>
                </div>

                <div className="mt-5 flex flex-col gap-4">
                    <InfoRow
                        label="Closes"
                        value={market.closeDate}
                    />

                    <InfoRow
                        label="Creator"
                        value={market.creator}
                        copy
                    />

                    <InfoRow
                        label="Contract"
                        value={market.address}
                        copy
                    />

                    <InfoRow
                        label="Network"
                        value="Arc Testnet"
                    />
                </div>
            </div>
        </div>
    );
}

function InfoRow({
    label,
    value,
    copy = false,
}: {
    label: string;
    value: string;
    copy?: boolean;
}) {
    return (
        <div className="flex items-center justify-between gap-4 border-b border-black/5 pb-3 last:border-0 last:pb-0">
            <span className="text-[9px] font-semibold text-slate-400">
                {label}
            </span>

            <div className="flex items-center gap-2">
                <span className="font-mono text-[9px] font-black text-slate-600">
                    {value}
                </span>

                {copy && (
                    <button
                        type="button"
                        className="text-slate-400 transition-colors hover:text-violet-600"
                    >
                        <Copy className="h-3 w-3" />
                    </button>
                )}
            </div>
        </div>
    );
}

function ActivityTab() {
    return (
        <div className="overflow-hidden rounded-[22px] border border-black/10 bg-[#fffdf8]/75">
            <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-black/10 px-5 py-4 text-[7px] font-black uppercase tracking-[0.15em] text-slate-400 sm:grid-cols-[1.4fr_0.7fr_0.7fr_0.7fr]">
                <span>Trader</span>
                <span>Position</span>
                <span className="hidden sm:block">
                    Price
                </span>
                <span>Time</span>
            </div>

            {TRADES.map((trade) => (
                <div
                    key={trade.id}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-black/5 px-5 py-4 last:border-0 sm:grid-cols-[1.4fr_0.7fr_0.7fr_0.7fr]"
                >
                    <div>
                        <p className="text-[11px] font-black text-slate-800">
                            {trade.agent}
                        </p>

                        <p className="mt-1 font-mono text-[8px] text-slate-400">
                            {trade.tx}
                        </p>
                    </div>

                    <div>
                        <p
                            className={`font-mono text-[10px] font-black ${trade.side === "YES"
                                ? "text-emerald-700"
                                : "text-rose-700"
                                }`}
                        >
                            {trade.side}
                        </p>

                        <p className="mt-1 text-[8px] font-semibold text-slate-400">
                            {trade.amount}
                        </p>
                    </div>

                    <span className="hidden font-mono text-[10px] font-black text-slate-600 sm:block">
                        {trade.probability}
                    </span>

                    <span className="font-mono text-[8px] font-semibold text-slate-400">
                        {trade.time}
                    </span>
                </div>
            ))}
        </div>
    );
}

function ReasoningTab({
    theme,
}: {
    theme: (typeof CATEGORY_THEMES)[keyof typeof CATEGORY_THEMES];
}) {
    return (
        <div className="grid gap-4">
            {REASONING.map((item) => (
                <article
                    key={`${item.agent}-${item.time}`}
                    className="rounded-[22px] border border-black/10 bg-[#fffdf8]/75 p-5"
                >
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div
                                className="flex h-10 w-10 items-center justify-center rounded-[13px]"
                                style={{
                                    background: theme.soft,
                                    color: theme.text,
                                }}
                            >
                                <BrainCircuit className="h-4.5 w-4.5" />
                            </div>

                            <div>
                                <p className="text-[11px] font-black text-slate-800">
                                    {item.agent}
                                </p>

                                <p className="mt-1 text-[8px] font-semibold text-slate-400">
                                    {item.time}
                                </p>
                            </div>
                        </div>

                        <span
                            className="rounded-full border px-3 py-1.5 font-mono text-[8px] font-black"
                            style={{
                                borderColor: theme.border,
                                background: theme.soft,
                                color: theme.text,
                            }}
                        >
                            {item.confidence}% confidence
                        </span>
                    </div>

                    <h3 className="mt-5 text-[17px] font-black tracking-[-0.025em] text-slate-900">
                        {item.title}
                    </h3>

                    <p className="mt-3 text-[11px] font-medium leading-[1.7] text-slate-500">
                        {item.description}
                    </p>
                </article>
            ))}
        </div>
    );
}