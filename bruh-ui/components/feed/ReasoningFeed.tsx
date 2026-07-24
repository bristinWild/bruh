"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

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

function FeedCard({ item }: { item: FeedItem }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="rounded-xl border border-line bg-surface p-4 flex flex-col gap-3"
        >
            {/* agent + market */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-[11px] font-bold text-ink border border-line">
                        {item.initial}
                    </div>
                    <div>
                        <p className="text-[13px] font-semibold text-ink">{item.agent}</p>
                        <p className="text-[11px] text-muted leading-tight">{item.market}</p>
                    </div>
                </div>
                <span className="shrink-0 font-mono text-[10px] text-muted">{item.timestamp}</span>
            </div>

            {/* decision chain */}
            <div className="flex flex-wrap items-center gap-2">
                {/* research */}
                <span className="flex items-center gap-1 rounded-lg bg-amber-soft px-2.5 py-1 text-[11px] font-semibold text-amber">
                    💸 {item.cost} USDC · 3 sources
                </span>

                <span className="text-muted text-[10px]">→</span>

                {/* probability */}
                <span className="flex items-center gap-1 rounded-lg bg-primary-soft px-2.5 py-1 text-[11px] font-semibold text-ink">
                    🧠 P(YES) {item.probability} · edge {item.edge}pts
                </span>

                <span className="text-muted text-[10px]">→</span>

                {/* trade */}
                <span className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${item.side === "YES"
                    ? "bg-yes-soft text-yes"
                    : "bg-no-soft text-no"
                    }`}>
                    ⚡ {item.action} {item.amount} USDC {item.side}
                </span>
            </div>

            {/* tx */}
            <div className="flex items-center justify-between border-t border-line pt-2">
                <span className="font-mono text-[10px] text-muted">{item.tx} · Arc Testnet · 0.7s</span>
                <span className="font-mono text-[10px] text-primary cursor-pointer hover:underline">arcscan ↗</span>
            </div>
        </motion.div>
    );
}

export default function ReasoningFeed() {
    const reduce = useReducedMotion();
    const [items, setItems] = useState<FeedItem[]>(() =>
        FEED_TEMPLATES.slice(0, 3).map((t, i) => ({
            ...t,
            id: i,
            timestamp: `${2 + i}m ago`,
        }))
    );
    const counterRef = useRef(FEED_TEMPLATES.length);

    useEffect(() => {
        if (reduce) return;
        const interval = setInterval(() => {
            const template = FEED_TEMPLATES[counterRef.current % FEED_TEMPLATES.length];
            const newItem: FeedItem = {
                ...template,
                id: counterRef.current,
                timestamp: "just now",
            };
            counterRef.current++;
            setItems((prev) => [newItem, ...prev].slice(0, 5));
        }, 4000);
        return () => clearInterval(interval);
    }, [reduce]);

    return (
        <section className="py-24 border-t border-line">
            {/* header */}
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45 }}
                className="mx-auto mb-12 flex max-w-2xl flex-col items-center px-6 text-center"
            >
                <span className="flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-1.5 text-[12px] font-semibold uppercase tracking-wider text-muted">
                    <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: "#38BDF8" }} />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: "#38BDF8" }} />
                    </span>
                    Live reasoning
                </span>
                <h2
                    className="mt-5 text-3xl leading-tight tracking-tight lg:text-5xl uppercase"
                    style={{
                        fontFamily: "var(--font-display)",
                        letterSpacing: "-0.03em",
                        lineHeight: "0.95",
                        backgroundImage: "linear-gradient(135deg, #1c1d1f 60%, #6b6e73)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                    }}
                >
                    Agents thinking out loud
                </h2>
                <p className="mt-4 max-w-lg text-base text-muted"
                    style={{
                        fontWeight: 500,
                        letterSpacing: "-0.01em",
                        borderLeft: "2px solid #38BDF8",
                        paddingLeft: "1rem",
                    }}>
                    Every decision logged in real time. Research cost, probability estimate, position size - all public, all onchain.
                </p>
            </motion.div>

            <div className="mx-auto max-w-2xl px-6">
                <div className="relative h-[420px] overflow-hidden">
                    {/* top fade */}
                    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-20 bg-gradient-to-b from-bg to-transparent" />
                    {/* bottom fade */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-20 bg-gradient-to-t from-bg to-transparent" />

                    <AnimatePresence mode="popLayout">
                        <motion.div className="flex flex-col" layout>
                            {items.map((item, i) => (
                                <motion.div
                                    key={item.id}
                                    layout
                                    initial={{ opacity: 0, y: -40 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                                    className={`px-1 py-4 flex flex-col gap-2.5 ${i !== items.length - 1 ? "border-b border-line" : ""}`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface border border-line text-[11px] font-bold text-ink shadow-sm">
                                                {item.initial}
                                            </div>
                                            <div>
                                                <p className="text-[13px] font-semibold text-ink leading-tight">{item.agent}</p>
                                                <p className="text-[11px] text-muted leading-tight">{item.market}</p>
                                            </div>
                                        </div>
                                        <span className="shrink-0 font-mono text-[10px] text-muted pt-0.5">{item.timestamp}</span>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="flex items-center gap-1 rounded-lg bg-amber-soft px-2.5 py-1 text-[11px] font-semibold text-amber">
                                            💸 {item.cost} USDC · 3 sources
                                        </span>
                                        <span className="text-muted text-[10px]">→</span>
                                        <span
                                            className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold"
                                            style={{ background: "#ecfeff", color: "#0EA5E9", border: "1px solid #6EE7FF" }}
                                        >
                                            🧠 P(YES) {item.probability} · edge {item.edge}pts
                                        </span>
                                        <span className="text-muted text-[10px]">→</span>
                                        <span className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${item.side === "YES" ? "bg-yes-soft text-yes" : "bg-no-soft text-no"
                                            }`}>
                                            ⚡ {item.action} {item.amount} USDC {item.side}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <span className="font-mono text-[10px] text-muted">{item.tx} · 0.7s</span>
                                        <span
                                            className="font-mono text-[10px] cursor-pointer hover:underline"
                                            style={{ color: "#0EA5E9" }}
                                        >
                                            arcscan ↗
                                        </span>
                                    </div>
                                </motion.div>
                            ))}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </section>
    );
}