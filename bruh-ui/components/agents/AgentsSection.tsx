"use client";

import { motion, useReducedMotion, useInView } from "framer-motion";
import { useRef, useEffect, useState } from "react";

type Agent = {
    id: string;
    name: string;
    strategy: string;
    description: string;
    initial: string;
    balance: number;
    pnl: string;
    pnlPositive: boolean;
    calibration: number;
    trades: number;
    winRate: string;
    status: string;
    recentActions: string[];
};

const AGENTS: Agent[] = [
    {
        id: "1",
        name: "Newshound",
        strategy: "News momentum",
        description: "Buys breaking news. Pays for articles, prices in sentiment, trades fast.",
        initial: "N",
        balance: 47.82,
        pnl: "+12.40",
        pnlPositive: true,
        calibration: 71,
        trades: 18,
        winRate: "72%",
        status: "Reasoning",
        recentActions: ["Bought YES · 4.20 USDC", "Paid 0.004 USDC research", "Bought YES · 2.10 USDC"],
    },
    {
        id: "2",
        name: "Actuary",
        strategy: "Base rates · contrarian",
        description: "Anchors on historical priors. Fades overconfident news-driven moves.",
        initial: "A",
        balance: 31.55,
        pnl: "-3.20",
        pnlPositive: false,
        calibration: 64,
        trades: 11,
        winRate: "58%",
        status: "Active",
        recentActions: ["Bought NO · 1.50 USDC", "Paid 0.002 USDC research", "Bought NO · 2.80 USDC"],
    },
];



function CountUp({ value }: { value: number }) {
    const [display, setDisplay] = useState(0);
    const ref = useRef(null);
    const inView = useInView(ref, { once: true });

    useEffect(() => {
        if (!inView) return;
        const duration = 1200;
        const steps = 40;
        const increment = value / steps;
        let current = 0;
        let step = 0;
        const timer = setInterval(() => {
            step++;
            current = Math.min(current + increment, value);
            setDisplay(parseFloat(current.toFixed(2)));
            if (step >= steps) clearInterval(timer);
        }, duration / steps);
        return () => clearInterval(timer);
    }, [inView, value]);

    return <span ref={ref}>{display.toFixed(2)}</span>;


}



function CalibrationBar({ value, inView }: { value: number; inView: boolean }) {
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex justify-between">
                <span className="text-[10px] uppercase tracking-widest text-muted">Calibration</span>
                <span className="font-mono text-[11px] font-bold text-ink">{value}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
                <motion.div
                    className="h-full rounded-full"
                    style={{ background: "#38BDF8" }}
                    initial={{ width: 0 }}
                    animate={inView ? { width: `${value}%` } : {}}
                    transition={{ duration: 1.0, ease: "easeOut", delay: 0.4 }}
                />
            </div>
        </div>
    );
}

function ActivityPulse({ actions }: { actions: string[] }) {
    const [current, setCurrent] = useState(0);

    useEffect(() => {
        const t = setInterval(() => {
            setCurrent((c) => (c + 1) % actions.length);
        }, 2500);
        return () => clearInterval(t);
    }, [actions]);

    return (
        <div className="flex items-center gap-2 overflow-hidden">
            <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yes opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-yes" />
            </span>
            <motion.span
                key={current}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3 }}
                className="font-mono text-[11px] text-muted truncate"
            >
                {actions[current]}
            </motion.span>
        </div>
    );
}

function AgentCard({ agent, index }: { agent: Agent; index: number }) {
    const reduce = useReducedMotion();
    const ref = useRef(null);
    const inView = useInView(ref, { once: true, margin: "-60px" });

    return (
        <motion.div
            ref={ref}
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: 32 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: index * 0.1 }}
            whileHover={reduce ? {} : {
                y: -6,
                boxShadow: "8px 8px 0px 0px #1c1d1f",
                transition: { duration: 0.15, ease: "easeOut" }
            }}
            className="rounded-2xl border border-line bg-surface overflow-hidden relative cursor-pointer"
        >
            {/* speed lines — hover only */}
            <motion.div
                className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
                initial={{ opacity: 0 }}
                whileHover={{ opacity: 1 }}
                transition={{ duration: 0.15 }}
            >
                {[
                    { top: "18%", width: "35%", delay: 0 },
                    { top: "32%", width: "50%", delay: 0.04 },
                    { top: "46%", width: "28%", delay: 0.08 },
                    { top: "60%", width: "42%", delay: 0.02 },
                    { top: "74%", width: "22%", delay: 0.06 },
                ].map((line, i) => (
                    <motion.div
                        key={i}
                        className="absolute h-px bg-ink/10"
                        style={{ top: line.top, left: "-10%", width: line.width }}
                        initial={{ scaleX: 0, originX: 0 }}
                        whileHover={{ scaleX: 1 }}
                        transition={{ duration: 0.2, delay: line.delay, ease: "easeOut" }}
                    />
                ))}
            </motion.div>

            {/* top accent bar */}
            <motion.div
                className="h-0.5 origin-left"
                style={{ background: "#38BDF8" }}
                initial={{ scaleX: 0 }}
                animate={inView ? { scaleX: 1 } : {}}
                transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 + index * 0.1 }}
            />

            <div className="p-6 flex flex-col gap-5">
                {/* header */}
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={inView ? { scale: 1 } : {}}
                            transition={{ type: "spring", stiffness: 200, damping: 16, delay: 0.3 }}
                            className="flex h-12 w-12 items-center justify-center rounded-xl bg-bg border border-line text-xl font-bold text-ink"
                            style={{ fontFamily: "var(--font-display)" }}
                        >
                            {agent.initial}
                        </motion.div>
                        <div>
                            <p className="text-lg font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>
                                {agent.name}
                            </p>
                            <p className="text-[11px] uppercase tracking-wider text-muted">{agent.strategy}</p>
                        </div>
                    </div>
                    <span
                        className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider"
                        style={{ background: "#ecfeff", color: "#0EA5E9", border: "1px solid #6EE7FF" }}
                    >
                        <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: "#38BDF8" }} />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: "#38BDF8" }} />
                        </span>
                        {agent.status}
                    </span>
                </div>

                {/* description */}
                <p className="text-sm text-muted leading-relaxed">{agent.description}</p>

                {/* balance — big hero number */}
                <div className="rounded-xl bg-bg border border-line px-5 py-4">
                    <p className="text-[10px] uppercase tracking-widest text-muted mb-2">USDC Balance</p>
                    <div className="flex items-end justify-between">
                        <div className="flex items-baseline gap-2">
                            <span className="font-mono text-[2.5rem] font-bold leading-none text-ink">
                                <CountUp value={agent.balance} />
                            </span>
                            <span className="font-mono text-sm text-muted">USDC</span>
                        </div>
                        <motion.span
                            initial={{ opacity: 0, x: 8 }}
                            animate={inView ? { opacity: 1, x: 0 } : {}}
                            transition={{ delay: 0.8 }}
                            className={`font-mono text-xl font-bold ${agent.pnlPositive ? "text-yes" : "text-no"}`}
                        >
                            {agent.pnl}
                        </motion.span>
                    </div>
                </div>

                {/* stats row */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-bg border border-line px-4 py-3 flex flex-col gap-0.5">
                        <span className="font-mono text-2xl font-bold text-ink">{agent.trades}</span>
                        <span className="text-[10px] uppercase tracking-widest text-muted">Trades</span>
                    </div>
                    <div className="rounded-xl bg-bg border border-line px-4 py-3 flex flex-col gap-0.5">
                        <span className="font-mono text-2xl font-bold text-ink">{agent.winRate}</span>
                        <span className="text-[10px] uppercase tracking-widest text-muted">Win rate</span>
                    </div>
                </div>

                {/* calibration bar */}
                <CalibrationBar value={agent.calibration} inView={inView} />

                {/* live activity */}
                <div className="rounded-xl bg-bg border border-line px-4 py-3">
                    <p className="text-[10px] uppercase tracking-widest text-muted mb-2">Latest action</p>
                    <ActivityPulse actions={agent.recentActions} />
                </div>

                {/* footer */}
                <div className="flex items-center justify-between border-t border-line pt-4">
                    <span className="font-mono text-[10px] text-muted">ERC-8004 · Arc Testnet</span>
                    <span
                        className="font-mono text-[10px] cursor-pointer transition-colors"
                        style={{ color: "#0EA5E9" }}
                        onMouseEnter={e => (e.currentTarget.style.color = "#0284C7")}
                        onMouseLeave={e => (e.currentTarget.style.color = "#0EA5E9")}
                    >
                        View on arcscan ↗
                    </span>
                </div>
            </div>
        </motion.div>
    );
}

export default function AgentsSection() {
    const reduce = useReducedMotion();

    return (
        <section id="agents" className="py-24">
            <motion.div
                initial={reduce ? { opacity: 1 } : { opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45 }}
                className="mx-auto mb-14 flex max-w-2xl flex-col items-center px-6 text-center"
            >
                <span className="flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-1.5 text-[12px] font-semibold uppercase tracking-wider text-muted">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#6EE7FF" }} />
                    Active agents
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
                    Meet the traders
                </h2>
                <p className="mt-4 max-w-lg text-base text-muted"
                    style={{
                        fontWeight: 500,
                        letterSpacing: "-0.01em",
                        borderLeft: "2px solid #38BDF8",
                        paddingLeft: "1rem",
                    }}>
                    Two autonomous agents. Different strategies. Same goal — beat the market with their own USDC on the line.
                </p>
            </motion.div>

            <div className="mx-auto grid max-w-4xl gap-6 px-6 sm:grid-cols-2">
                {AGENTS.map((agent, i) => (
                    <AgentCard key={agent.id} agent={agent} index={i} />
                ))}
            </div>
        </section>
    );
}