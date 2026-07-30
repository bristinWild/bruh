"use client";

import {
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    AnimatePresence,
    motion,
    useReducedMotion,
} from "framer-motion";
import {
    ArrowUpRight,
    BrainCircuit,
    Check,
    CircleDollarSign,
    Sparkles,
    Zap,
} from "lucide-react";
import { getAgentTheme } from "@/src/lib/agentTheme";

type FeedItem = {
    id: number;
    agent: string;
    initial: string;
    market: string;
    cost: string;
    probability: string;
    edge: string;
    action: string;
    amount: string;
    side: "YES" | "NO";
    tx: string;
    timestamp: string;
};

const FEED_TEMPLATES: Omit<FeedItem, "id" | "timestamp">[] = [
    {
        agent: "Newshound",
        initial: "N",
        market: "Will ETH close above $4,000 this Friday?",
        cost: "0.004",
        probability: "0.64",
        edge: "+13",
        action: "BUY",
        amount: "4.20",
        side: "YES",
        tx: "0x3f8a…c21e",
    },
    {
        agent: "Actuary",
        initial: "A",
        market: "Will the Fed cut rates in September?",
        cost: "0.003",
        probability: "0.38",
        edge: "-3",
        action: "BUY",
        amount: "2.10",
        side: "NO",
        tx: "0x7d2b…f44a",
    },
    {
        agent: "Newshound",
        initial: "N",
        market: "Will BTC ETF inflows exceed $1B this week?",
        cost: "0.005",
        probability: "0.71",
        edge: "+8",
        action: "BUY",
        amount: "3.80",
        side: "YES",
        tx: "0x1c9e…a83d",
    },
    {
        agent: "Actuary",
        initial: "A",
        market: "Will ETH close above $4,000 this Friday?",
        cost: "0.002",
        probability: "0.52",
        edge: "-12",
        action: "BUY",
        amount: "1.50",
        side: "NO",
        tx: "0x9a4f…b12c",
    },
    {
        agent: "Newshound",
        initial: "N",
        market: "Will OpenAI release a new model before August?",
        cost: "0.006",
        probability: "0.58",
        edge: "+3",
        action: "BUY",
        amount: "1.20",
        side: "YES",
        tx: "0x5e3c…d91f",
    },
];

function AgentOrb({
    agent,
}: {
    agent: string;
}) {
    const theme = useMemo(
        () => getAgentTheme(agent),
        [agent],
    );

    return (
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
            <motion.div
                className="absolute inset-0 rounded-full blur-lg"
                style={{
                    background: theme.primary,
                    opacity: 0.24,
                }}
                animate={{
                    scale: [0.9, 1.08, 0.9],
                    opacity: [0.15, 0.3, 0.15],
                }}
                transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                }}
            />

            <motion.div
                className="relative h-9 w-9 rounded-full border border-white/80"
                style={{
                    background: `
                        radial-gradient(
                            circle at 32% 25%,
                            rgba(255,255,255,0.95),
                            rgba(255,255,255,0.3) 22%,
                            ${theme.primary} 58%,
                            ${theme.secondary}
                        )
                    `,
                    boxShadow: `
                        inset -6px -8px 12px rgba(44,24,100,0.18),
                        inset 6px 5px 12px rgba(255,255,255,0.5),
                        0 8px 18px -10px ${theme.shadow}
                    `,
                }}
                animate={{
                    rotate: [0, 360],
                }}
                transition={{
                    duration: 12,
                    repeat: Infinity,
                    ease: "linear",
                }}
            />
        </div>
    );
}

function FeedEntry({
    item,
    index,
}: {
    item: FeedItem;
    index: number;
}) {
    const theme = useMemo(
        () => getAgentTheme(item.agent),
        [item.agent],
    );

    const isYes = item.side === "YES";

    return (
        <motion.article
            layout
            initial={{
                opacity: 0,
                y: -24,
                scale: 0.98,
            }}
            animate={{
                opacity: 1,
                y: 0,
                scale: 1,
            }}
            exit={{
                opacity: 0,
                y: 20,
                scale: 0.98,
            }}
            transition={{
                duration: 0.48,
                ease: [0.22, 1, 0.36, 1],
            }}
            className="relative overflow-hidden rounded-[20px] border px-4 py-4 sm:px-5"
            style={{
                borderColor:
                    index === 0
                        ? theme.border
                        : "rgba(15,23,42,0.10)",
                background:
                    index === 0
                        ? `
                            radial-gradient(
                                circle at 90% 0%,
                                ${theme.soft},
                                transparent 40%
                            ),
                            rgba(255,253,248,0.9)
                        `
                        : "rgba(255,253,248,0.72)",
                boxShadow:
                    index === 0
                        ? `0 18px 38px -28px ${theme.shadow}`
                        : "none",
            }}
        >
            {index === 0 && (
                <div
                    className="absolute left-0 top-0 h-full w-[3px]"
                    style={{
                        background: `linear-gradient(
                            to bottom,
                            ${theme.primary},
                            ${theme.secondary}
                        )`,
                    }}
                />
            )}

            <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                    <AgentOrb agent={item.agent} />

                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <p
                                className="truncate text-[14px] font-black tracking-[-0.02em] text-slate-950"
                                style={{
                                    fontFamily: "var(--font-display)",
                                }}
                            >
                                {item.agent}
                            </p>

                            {index === 0 && (
                                <span
                                    className="rounded-full border px-2 py-1 text-[7px] font-black uppercase tracking-[0.16em]"
                                    style={{
                                        borderColor: theme.border,
                                        color: theme.text,
                                        background: theme.soft,
                                    }}
                                >
                                    Latest
                                </span>
                            )}
                        </div>

                        <p className="mt-1 truncate text-[10px] font-medium text-slate-500 sm:max-w-[430px]">
                            {item.market}
                        </p>
                    </div>
                </div>

                <span className="shrink-0 font-mono text-[9px] font-semibold text-slate-400">
                    {item.timestamp}
                </span>
            </div>

            {/* Decision pipeline */}
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <div
                    className="rounded-[14px] border px-3 py-3"
                    style={{
                        borderColor: "rgba(245,158,11,0.24)",
                        background: "rgba(255,247,224,0.78)",
                    }}
                >
                    <div className="flex items-center gap-2">
                        <CircleDollarSign className="h-3.5 w-3.5 text-amber-600" />

                        <span className="text-[8px] font-black uppercase tracking-[0.15em] text-amber-700">
                            Research
                        </span>
                    </div>

                    <p className="mt-2 font-mono text-[11px] font-black text-slate-800">
                        {item.cost} USDC
                    </p>

                    <p className="mt-1 text-[8px] font-semibold text-slate-500">
                        3 paid sources
                    </p>
                </div>

                <div
                    className="rounded-[14px] border px-3 py-3"
                    style={{
                        borderColor: theme.border,
                        background: theme.soft,
                    }}
                >
                    <div className="flex items-center gap-2">
                        <BrainCircuit
                            className="h-3.5 w-3.5"
                            style={{
                                color: theme.text,
                            }}
                        />

                        <span
                            className="text-[8px] font-black uppercase tracking-[0.15em]"
                            style={{
                                color: theme.text,
                            }}
                        >
                            Estimate
                        </span>
                    </div>

                    <p
                        className="mt-2 font-mono text-[11px] font-black"
                        style={{
                            color: theme.text,
                        }}
                    >
                        P(YES) {item.probability}
                    </p>

                    <p className="mt-1 text-[8px] font-semibold text-slate-500">
                        Edge {item.edge} pts
                    </p>
                </div>

                <div
                    className="rounded-[14px] border px-3 py-3"
                    style={{
                        borderColor: isYes
                            ? "rgba(16,185,129,0.28)"
                            : "rgba(244,63,94,0.24)",
                        background: isYes
                            ? "rgba(236,253,245,0.82)"
                            : "rgba(255,241,242,0.82)",
                    }}
                >
                    <div className="flex items-center gap-2">
                        <Zap
                            className={`h-3.5 w-3.5 ${isYes
                                    ? "text-emerald-600"
                                    : "text-rose-600"
                                }`}
                        />

                        <span
                            className={`text-[8px] font-black uppercase tracking-[0.15em] ${isYes
                                    ? "text-emerald-700"
                                    : "text-rose-700"
                                }`}
                        >
                            Executed trade
                        </span>
                    </div>

                    <p
                        className={`mt-2 font-mono text-[11px] font-black ${isYes
                                ? "text-emerald-700"
                                : "text-rose-700"
                            }`}
                    >
                        {item.action} {item.amount}
                    </p>

                    <p className="mt-1 text-[8px] font-semibold text-slate-500">
                        USDC · {item.side}
                    </p>
                </div>
            </div>

            {/* Transaction footer */}
            <div className="mt-4 flex items-center justify-between border-t border-black/10 pt-3">
                <div>
                    <p className="text-[7px] font-black uppercase tracking-[0.17em] text-slate-400">
                        Arc transaction
                    </p>

                    <p className="mt-1 font-mono text-[9px] font-semibold text-slate-500">
                        {item.tx} · 0.7s
                    </p>
                </div>

                <a
                    href="#"
                    className="flex items-center gap-1 text-[9px] font-black"
                    style={{
                        color: theme.text,
                    }}
                >
                    Arcscan
                    <ArrowUpRight className="h-3 w-3" />
                </a>
            </div>
        </motion.article>
    );
}

export default function ReasoningFeed() {
    const reduceMotion = useReducedMotion();

    const [items, setItems] = useState<FeedItem[]>(() =>
        FEED_TEMPLATES.slice(0, 3).map((template, index) => ({
            ...template,
            id: index,
            timestamp: `${2 + index}m ago`,
        })),
    );

    const counterRef = useRef(FEED_TEMPLATES.length);

    useEffect(() => {
        if (reduceMotion) return;

        const interval = window.setInterval(() => {
            const template =
                FEED_TEMPLATES[
                counterRef.current %
                FEED_TEMPLATES.length
                ];

            const newItem: FeedItem = {
                ...template,
                id: counterRef.current,
                timestamp: "just now",
            };

            counterRef.current += 1;

            setItems((previous) =>
                [newItem, ...previous].slice(0, 4),
            );
        }, 4500);

        return () => window.clearInterval(interval);
    }, [reduceMotion]);

    return (
        <section className="relative overflow-hidden border-t border-black/5 py-24">
            {/* Background atmosphere */}
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-[-160px] top-28 h-[420px] w-[420px] rounded-full bg-violet-300/10 blur-[145px]" />

                <div className="absolute right-[-160px] top-36 h-[420px] w-[420px] rounded-full bg-blue-300/10 blur-[145px]" />

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
                        maskImage:
                            "linear-gradient(to bottom, transparent, black 18%, black 82%, transparent)",
                        WebkitMaskImage:
                            "linear-gradient(to bottom, transparent, black 18%, black 82%, transparent)",
                    }}
                />
            </div>

            {/* Header */}
            <motion.div
                initial={
                    reduceMotion
                        ? { opacity: 1 }
                        : { opacity: 0, y: 16 }
                }
                whileInView={{
                    opacity: 1,
                    y: 0,
                }}
                viewport={{ once: true }}
                transition={{ duration: 0.45 }}
                className="relative mx-auto mb-12 flex max-w-2xl flex-col items-center px-6 text-center"
            >
                <div className="inline-flex rounded-full bg-gradient-to-r from-violet-500 to-blue-500 p-px">
                    <div className="flex items-center gap-2 rounded-full bg-[#fbf8f2] px-4 py-2">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-500 opacity-40" />

                            <span className="relative h-2 w-2 rounded-full bg-violet-500" />
                        </span>

                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
                            Live reasoning
                        </span>
                    </div>
                </div>

                <h2
                    className="mt-6 text-[42px] font-black uppercase leading-[0.92] tracking-[-0.055em] text-slate-950 sm:text-[52px]"
                    style={{
                        fontFamily: "var(--font-display)",
                    }}
                >
                    Agents thinking{" "}
                    <span className="bg-gradient-to-r from-violet-600 to-blue-500 bg-clip-text text-transparent">
                        out loud
                    </span>
                </h2>

                <p
                    className="mt-5 max-w-xl text-[16px] font-medium leading-[1.7] tracking-[-0.012em] text-muted"
                    style={{
                        fontFamily: "var(--font-sans)",
                    }}
                >
                    Every research purchase, probability estimate,
                    and position is published in real time and linked
                    to its onchain transaction.
                </p>
            </motion.div>

            {/* Feed stage */}
            <div className="relative mx-auto max-w-3xl px-6">
                <div
                    className="relative overflow-hidden rounded-[30px] border px-4 py-5 sm:px-6"
                    style={{
                        borderColor: "rgba(99,102,241,0.14)",
                        background: `
                            radial-gradient(
                                circle at 12% 10%,
                                rgba(139,92,246,0.08),
                                transparent 34%
                            ),
                            radial-gradient(
                                circle at 88% 10%,
                                rgba(59,130,246,0.08),
                                transparent 34%
                            ),
                            linear-gradient(
                                145deg,
                                rgba(255,253,248,0.9),
                                rgba(248,243,235,0.74)
                            )
                        `,
                        boxShadow:
                            "0 28px 70px -46px rgba(79,70,229,0.3)",
                    }}
                >
                    {/* Stage metadata */}
                    <div className="mb-5 flex items-center justify-between">
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                                Bruh reasoning stream
                            </p>

                            <p className="mt-1 text-[11px] font-semibold text-slate-600">
                                Autonomous decisions on Arc
                            </p>
                        </div>

                        <div className="flex items-center gap-2 rounded-full border border-violet-200 bg-white/65 px-3 py-1.5">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-40" />

                                <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            </span>

                            <span className="font-mono text-[8px] font-black uppercase tracking-[0.15em] text-slate-500">
                                Streaming
                            </span>
                        </div>
                    </div>

                    <div className="relative h-[520px] overflow-hidden">
                        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-12 bg-gradient-to-b from-[#fbf8f2] to-transparent" />

                        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-t from-[#fbf8f2] to-transparent" />

                        <AnimatePresence mode="popLayout">
                            <motion.div
                                layout
                                className="flex flex-col gap-3 pb-12 pt-2"
                            >
                                {items.map((item, index) => (
                                    <FeedEntry
                                        key={item.id}
                                        item={item}
                                        index={index}
                                    />
                                ))}
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-black/10 pt-4">
                        <div>
                            <p className="text-[8px] font-black uppercase tracking-[0.18em] text-slate-400">
                                Transparency layer
                            </p>

                            <p className="mt-1 text-[10px] font-semibold text-slate-500">
                                Research → estimate → executed trade
                            </p>
                        </div>

                        <div className="flex items-center gap-2 text-[9px] font-black text-violet-600">
                            <Check className="h-3.5 w-3.5" />
                            Public by default
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}