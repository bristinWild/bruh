"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getMyWallets, createAgentWallet, runAgent, getTrades } from "@/src/lib/api";
import { AgentAvatar } from "@/app/AgentAvatar";
import { AgentCover } from "@/components/AgentCover";
import ReasoningFeed from "@/components/dashboard/ReasoningFeed";
import { getAgentTheme } from "@/src/lib/agentTheme";

const STRATEGIES = [
    {
        id: "newshound",
        name: "Newshound",
        tag: "News momentum",
        accent: "#38BDF8",
        initial: "N",
        description: "Aggressive. Weights recent news heavily. Trades fast on clear signals.",
    },
    {
        id: "actuary",
        name: "Actuary",
        tag: "Base rates",
        accent: "#6EE7FF",
        initial: "A",
        description: "Conservative. Anchors on historical priors. Only trades on clear mispricing.",
    },
    {
        id: "both",
        name: "Both capabilities",
        tag: "Ensemble",
        accent: "#0EA5E9",
        initial: "B",
        description: "Run both reasoning styles. Disagreement is signal. Agreement is conviction.",
    },
];

const RUNNING_MESSAGES = [
    "Reading market news…",
    "Comparing historical outcomes…",
    "Estimating probability…",
    "Calculating edge…",
    "Preparing trade decision…",
];


const TABS = [
    { id: "agent", label: "Agent" },
    { id: "pnl", label: "PnL" },
    { id: "transactions", label: "Transactions" },
] as const;

export default function Dashboard() {
    const [token, setToken] = useState<string | null>(null);
    const [wallets, setWallets] = useState<any[]>([]);
    const [selected, setSelected] = useState<any>(null);
    const [trades, setTrades] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
    const [agentName, setAgentName] = useState("");
    const [agentState, setAgentState] = useState<"idle" | "running" | "done">("idle");
    const [activeTab, setActiveTab] = useState<"agent" | "pnl" | "transactions">("agent");
    const [runningMessageIndex, setRunningMessageIndex] = useState(0);



    useEffect(() => {
        const t = localStorage.getItem("bruh_token");
        if (t) setToken(t);
        else setLoading(false);
    }, []);

    useEffect(() => {
        if (agentState !== "running") {
            setRunningMessageIndex(0);
            return;
        }

        const interval = window.setInterval(() => {
            setRunningMessageIndex(
                (current) => (current + 1) % RUNNING_MESSAGES.length,
            );
        }, 1800);

        return () => window.clearInterval(interval);
    }, [agentState]);

    const loadWallets = useCallback(async (jwt: string) => {
        const w = await getMyWallets(jwt);
        setWallets(w || []);
        if (w?.length > 0) {
            setSelected(w[0]);
            const tr = await getTrades(jwt, w[0].id);
            setTrades(tr || []);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        if (token) loadWallets(token);
    }, [token, loadWallets]);

    async function handleCreateAgent() {
        if (!token || !selectedStrategy || !agentName.trim()) return;
        setCreating(true);
        try {
            const w = await createAgentWallet(token, selectedStrategy, agentName.trim());
            await loadWallets(token);
            setSelected(w);
            setAgentName("");
            setSelectedStrategy(null);
            setAgentState("idle");
        } catch (err) {
            console.error(err);
        } finally {
            setCreating(false);
        }
    }

    async function handleRun() {
        if (!token || !selected) return;
        setAgentState("running");
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/wallets/${selected.id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ status: "active" }),
        });
        await runAgent(token, selected.id);

        setTimeout(async () => {
            const tr = await getTrades(token, selected.id);
            setTrades(tr || []);

            await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/wallets/${selected.id}/status`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ status: "paused" }),
                },
            );


            setAgentState("done");
        }, 8000);
    }

    async function handleStop() {
        if (!token || !selected) return;
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/wallets/${selected.id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ status: "paused" }),
        });
        setAgentState("idle");
    }

    async function selectWallet(w: any) {
        setSelected(w);
        setAgentState("idle");
        setActiveTab("agent");
        if (token) {
            const tr = await getTrades(token, w.id);
            setTrades(tr || []);
        }
    }

    function startNewAgent() {
        setSelected(null);
        setAgentName("");
        setSelectedStrategy(null);
    }

    const selectedAgentTheme = selected
        ? getAgentTheme(selected.agent_name || selected.id)
        : null;

    // ── Not authenticated ─────────────────────────────────────────────────────
    if (!loading && !token) {
        return (
            <div className="min-h-screen bg-bg flex items-center justify-center px-6">
                <div className="text-center">
                    <p className="text-lg font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>
                        Not signed in
                    </p>
                    <p className="mt-2 text-sm text-muted">Connect your wallet to view your dashboard.</p>

                    <a href="/get-started"
                        className="mt-6 inline-block rounded-full px-6 py-3 text-sm font-semibold text-white"
                        style={{ background: "#38BDF8" }}
                    >
                        Get Started →
                    </a>
                </div>
            </div >
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-bg flex items-center justify-center">
                <p className="text-sm text-muted animate-pulse">Loading dashboard...</p>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen overflow-hidden bg-bg px-6 py-24">
            {/* Animated background */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <motion.div
                    className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full opacity-30 blur-[120px]"
                    style={{
                        background:
                            "radial-gradient(circle, #38BDF8, transparent 70%)",
                    }}
                    animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
                    transition={{
                        duration: 12,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />

                <motion.div
                    className="absolute -right-40 top-1/3 h-[600px] w-[600px] rounded-full opacity-20 blur-[140px]"
                    style={{
                        background:
                            "radial-gradient(circle, #6EE7FF, transparent 70%)",
                    }}
                    animate={{ x: [0, -30, 0], y: [0, 40, 0] }}
                    transition={{
                        duration: 15,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 1,
                    }}
                />

                <motion.div
                    className="absolute bottom-0 left-1/4 h-[400px] w-[400px] rounded-full opacity-20 blur-[100px]"
                    style={{
                        background:
                            "radial-gradient(circle, #0EA5E9, transparent 70%)",
                    }}
                    animate={{ x: [0, 30, 0] }}
                    transition={{
                        duration: 10,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 2,
                    }}
                />
            </div>

            <div className="relative z-10 mx-auto max-w-7xl">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-10"
                >
                    <span
                        className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[12px] font-semibold uppercase tracking-wider text-muted"
                        style={{ borderColor: "#6EE7FF" }}
                    >
                        <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: "#38BDF8" }}
                        />
                        Your dashboard
                    </span>

                    <h1
                        className="mt-4 text-3xl uppercase tracking-tight text-ink"
                        style={{ fontFamily: "var(--font-display)" }}
                    >
                        Agent overview
                    </h1>
                </motion.div>

                {/* Agent selector */}
                {wallets.length > 0 && (
                    <div className="mb-6 flex flex-wrap items-center gap-2">
                        {wallets.map((wallet) => (
                            <button
                                key={wallet.id}
                                onClick={() => selectWallet(wallet)}
                                className="flex items-center gap-2 rounded-full py-1.5 pl-2 pr-4 text-xs font-semibold transition-colors"
                                style={{
                                    background:
                                        selected?.id === wallet.id
                                            ? "#38BDF8"
                                            : "var(--color-surface)",
                                    color:
                                        selected?.id === wallet.id
                                            ? "white"
                                            : "var(--color-muted)",
                                    border: "1px solid var(--color-line)",
                                }}
                            >
                                <AgentAvatar
                                    seed={wallet.agent_name || wallet.id}
                                    size={18}
                                />

                                {wallet.agent_name || wallet.strategy}
                            </button>
                        ))}

                        <button
                            onClick={startNewAgent}
                            className="rounded-full border border-dashed px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted transition-colors"
                            style={{ borderColor: "var(--color-line)" }}
                        >
                            + New agent
                        </button>
                    </div>
                )}

                <AnimatePresence mode="wait">
                    {/* Create agent */}
                    {(!selected || wallets.length === 0) && (
                        <motion.div
                            key="create-agent"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{
                                duration: 0.5,
                                ease: [0.22, 1, 0.36, 1],
                            }}
                            className="relative rounded-3xl border p-10 backdrop-blur-xl"
                            style={{
                                borderColor: "rgba(110,231,255,0.25)",
                                background:
                                    "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(255,255,255,0.7))",
                                boxShadow:
                                    "0 20px 60px -15px rgba(56,189,248,0.15), 0 0 0 1px rgba(255,255,255,0.5) inset",
                            }}
                        >
                            <div
                                className="absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2"
                                style={{
                                    background:
                                        "linear-gradient(90deg, transparent, #38BDF8, transparent)",
                                }}
                            />

                            <div className="mb-8 text-center">
                                <motion.span
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.1 }}
                                    className="mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider"
                                    style={{
                                        borderColor: "#6EE7FF",
                                        color: "#0EA5E9",
                                        background: "#ECFEFF",
                                    }}
                                >
                                    <span
                                        className="h-1.5 w-1.5 animate-pulse rounded-full"
                                        style={{ background: "#38BDF8" }}
                                    />
                                    New agent
                                </motion.span>

                                <h2
                                    className="text-2xl font-bold text-ink"
                                    style={{ fontFamily: "var(--font-display)" }}
                                >
                                    Create your agentic wallet
                                </h2>

                                <p className="mt-2 text-sm text-muted">
                                    Name it, choose its brain, deploy it on Arc.
                                </p>
                            </div>

                            <div className="mx-auto mb-6 max-w-lg">
                                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-widest text-muted">
                                    Agent name
                                </label>

                                <div className="flex items-center gap-3">
                                    <motion.div
                                        key={agentName}
                                        initial={{ scale: 0.85, rotate: -5 }}
                                        animate={{ scale: 1, rotate: 0 }}
                                        transition={{
                                            type: "spring",
                                            stiffness: 300,
                                            damping: 20,
                                        }}
                                        className="relative"
                                    >
                                        <div
                                            className="absolute inset-0 rounded-2xl opacity-60 blur-md"
                                            style={{
                                                background:
                                                    "linear-gradient(135deg, #38BDF8, #6EE7FF)",
                                            }}
                                        />

                                        <div className="relative">
                                            <AgentAvatar
                                                seed={agentName || "preview"}
                                                size={52}
                                            />
                                        </div>
                                    </motion.div>

                                    <input
                                        type="text"
                                        value={agentName}
                                        onChange={(event) =>
                                            setAgentName(event.target.value)
                                        }
                                        placeholder="e.g. Scout, Oracle, Ledger..."
                                        maxLength={24}
                                        className="flex-1 rounded-2xl border-2 bg-white/60 px-5 py-3.5 text-sm font-medium text-ink placeholder:font-normal placeholder:text-muted focus:outline-none"
                                        style={{
                                            borderColor: agentName
                                                ? "#38BDF8"
                                                : "rgba(215,217,220,0.6)",
                                            boxShadow: agentName
                                                ? "0 0 0 4px rgba(56,189,248,0.1)"
                                                : "none",
                                        }}
                                    />
                                </div>
                            </div>

                            <label className="mx-auto mb-3 block max-w-lg text-[11px] font-semibold uppercase tracking-widest text-muted">
                                Capability
                            </label>

                            <div className="mx-auto flex max-w-lg flex-col gap-3">
                                {STRATEGIES.map((strategy, index) => {
                                    const isSelected =
                                        selectedStrategy === strategy.id;

                                    return (
                                        <motion.button
                                            key={strategy.id}
                                            initial={{ opacity: 0, x: -12 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{
                                                delay: 0.15 + index * 0.06,
                                            }}
                                            onClick={() =>
                                                setSelectedStrategy(strategy.id)
                                            }
                                            whileHover={{
                                                y: -2,
                                                scale: 1.005,
                                            }}
                                            whileTap={{ scale: 0.995 }}
                                            className="relative flex w-full items-start gap-4 overflow-hidden rounded-2xl border-2 p-4 text-left"
                                            style={{
                                                borderColor: isSelected
                                                    ? strategy.accent
                                                    : "rgba(215,217,220,0.6)",
                                                background: isSelected
                                                    ? `linear-gradient(135deg, ${strategy.accent}12, ${strategy.accent}05)`
                                                    : "rgba(255,255,255,0.5)",
                                                boxShadow: isSelected
                                                    ? `0 8px 24px -8px ${strategy.accent}40`
                                                    : "none",
                                            }}
                                        >
                                            {isSelected && (
                                                <motion.div
                                                    layoutId="capability-glow"
                                                    className="absolute left-0 top-0 h-full w-1"
                                                    style={{
                                                        background:
                                                            strategy.accent,
                                                    }}
                                                />
                                            )}

                                            <div
                                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-mono text-sm font-bold"
                                                style={{
                                                    background: `${strategy.accent}18`,
                                                    color: strategy.accent,
                                                }}
                                            >
                                                {strategy.initial}
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="text-[15px] font-semibold text-ink">
                                                        {strategy.name}
                                                    </p>

                                                    <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-muted">
                                                        {strategy.tag}
                                                    </span>
                                                </div>

                                                <p className="mt-1 text-[13px] leading-snug text-muted">
                                                    {strategy.description}
                                                </p>
                                            </div>

                                            <div className="shrink-0 pt-0.5">
                                                {isSelected ? (
                                                    <motion.div
                                                        initial={{ scale: 0 }}
                                                        animate={{ scale: 1 }}
                                                        className="flex h-5 w-5 items-center justify-center rounded-full"
                                                        style={{
                                                            background:
                                                                strategy.accent,
                                                        }}
                                                    >
                                                        <svg
                                                            width="12"
                                                            height="12"
                                                            viewBox="0 0 12 12"
                                                            fill="none"
                                                        >
                                                            <path
                                                                d="M2.5 6l2.5 2.5L9.5 3.5"
                                                                stroke="white"
                                                                strokeWidth="1.5"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                            />
                                                        </svg>
                                                    </motion.div>
                                                ) : (
                                                    <div
                                                        className="h-5 w-5 rounded-full border-2"
                                                        style={{
                                                            borderColor:
                                                                "var(--color-line)",
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        </motion.button>
                                    );
                                })}
                            </div>

                            <motion.button
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.4 }}
                                whileHover={{
                                    scale:
                                        selectedStrategy && agentName ? 1.01 : 1,
                                }}
                                whileTap={{ scale: 0.99 }}
                                onClick={handleCreateAgent}
                                disabled={
                                    !selectedStrategy ||
                                    !agentName.trim() ||
                                    creating
                                }
                                className="mx-auto mt-6 block w-full max-w-lg rounded-full py-3.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-30"
                                style={{
                                    background:
                                        "linear-gradient(135deg, #38BDF8, #0EA5E9)",
                                    boxShadow:
                                        selectedStrategy && agentName
                                            ? "0 8px 24px -6px rgba(56,189,248,0.5)"
                                            : "none",
                                }}
                            >
                                {creating
                                    ? "Creating agent..."
                                    : "Create agent →"}
                            </motion.button>
                        </motion.div>
                    )}

                    {/* Existing agent */}
                    {selected && wallets.length > 0 && (
                        <motion.div
                            key="agent-shell"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                        >
                            <div className="mb-6 flex items-center gap-1 border-b border-line">
                                {TABS.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className="relative px-4 py-3 text-sm font-semibold"
                                        style={{
                                            color:
                                                activeTab === tab.id
                                                    ? "var(--color-ink)"
                                                    : "var(--color-muted)",
                                        }}
                                    >
                                        {tab.label}

                                        {activeTab === tab.id && (
                                            <motion.div
                                                layoutId="tab-underline"
                                                className="absolute bottom-0 left-0 right-0 h-0.5"
                                                style={{
                                                    background: "#38BDF8",
                                                }}
                                            />
                                        )}
                                    </button>
                                ))}
                            </div>

                            <AnimatePresence mode="wait">
                                {/* Agent tab */}
                                {activeTab === "agent" && (
                                    <motion.div
                                        key="agent-tab"
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 8 }}
                                        transition={{ duration: 0.2 }}
                                        className="grid items-start gap-6 lg:grid-cols-[340px_minmax(0,1fr)]"
                                    >
                                        {/* Left column */}
                                        <div className="flex flex-col gap-4 self-start">
                                            <AnimatePresence mode="wait">
                                                {agentState === "running" ? (
                                                    <motion.div
                                                        key="running-card"
                                                        initial={{
                                                            opacity: 0,
                                                            y: 10,
                                                            scale: 0.985,
                                                        }}
                                                        animate={{
                                                            opacity: 1,
                                                            y: 0,
                                                            scale: 1,
                                                        }}
                                                        exit={{
                                                            opacity: 0,
                                                            y: -10,
                                                            scale: 0.985,
                                                        }}
                                                        transition={{
                                                            duration: 0.25,
                                                            ease: [
                                                                0.22, 1, 0.36, 1,
                                                            ],
                                                        }}
                                                        className="aspect-square overflow-hidden rounded-2xl border p-6"
                                                        style={{
                                                            borderColor:
                                                                "rgba(56,189,248,0.35)",
                                                            background:
                                                                "linear-gradient(145deg, #071524 0%, #0A243A 55%, #0C3048 100%)",
                                                            boxShadow:
                                                                "0 24px 60px -30px rgba(14,165,233,0.7), inset 0 0 36px rgba(56,189,248,0.08)",
                                                        }}
                                                    >
                                                        <div className="flex h-full flex-col">
                                                            <div className="flex items-center justify-between">
                                                                <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                                                                    <span className="relative flex h-2 w-2">
                                                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                                                                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                                                                    </span>
                                                                    Running
                                                                </span>

                                                                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[9px] text-slate-300">
                                                                    ARC
                                                                </span>
                                                            </div>

                                                            <div className="flex flex-1 flex-col items-center justify-center text-center">
                                                                <motion.div
                                                                    animate={{
                                                                        scale: [
                                                                            1,
                                                                            1.04,
                                                                            1,
                                                                        ],
                                                                        boxShadow: [
                                                                            "0 0 18px rgba(56,189,248,0.25)",
                                                                            "0 0 32px rgba(56,189,248,0.55)",
                                                                            "0 0 18px rgba(56,189,248,0.25)",
                                                                        ],
                                                                    }}
                                                                    transition={{
                                                                        duration: 2.2,
                                                                        repeat: Infinity,
                                                                        ease: "easeInOut",
                                                                    }}
                                                                    className="overflow-hidden rounded-2xl border-4 border-white/10"
                                                                >
                                                                    <AgentAvatar
                                                                        seed={
                                                                            selected.agent_name ||
                                                                            selected.id
                                                                        }
                                                                        size={68}
                                                                    />
                                                                </motion.div>

                                                                <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">
                                                                    Agent active
                                                                </p>

                                                                <h3
                                                                    className="mt-2 text-xl font-bold text-white"
                                                                    style={{
                                                                        fontFamily:
                                                                            "var(--font-display)",
                                                                    }}
                                                                >
                                                                    {
                                                                        selected.agent_name
                                                                    }
                                                                </h3>

                                                                <AnimatePresence mode="wait">
                                                                    <motion.p
                                                                        key={
                                                                            runningMessageIndex
                                                                        }
                                                                        initial={{
                                                                            opacity: 0,
                                                                            y: 6,
                                                                        }}
                                                                        animate={{
                                                                            opacity: 1,
                                                                            y: 0,
                                                                        }}
                                                                        exit={{
                                                                            opacity: 0,
                                                                            y: -6,
                                                                        }}
                                                                        transition={{
                                                                            duration: 0.2,
                                                                        }}
                                                                        className="mt-3 min-h-5 text-xs text-slate-300"
                                                                    >
                                                                        {
                                                                            RUNNING_MESSAGES[
                                                                            runningMessageIndex
                                                                            ]
                                                                        }
                                                                    </motion.p>
                                                                </AnimatePresence>

                                                                <div className="mt-6 w-full max-w-[230px]">
                                                                    <div className="mb-2 flex items-center justify-between text-[9px] uppercase tracking-wider text-slate-400">
                                                                        <span>
                                                                            Reasoning
                                                                            cycle
                                                                        </span>
                                                                        <span>
                                                                            Live
                                                                        </span>
                                                                    </div>

                                                                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                                                                        <motion.div
                                                                            className="h-full w-1/3 rounded-full"
                                                                            style={{
                                                                                background:
                                                                                    "linear-gradient(90deg, #38BDF8, #6EE7FF)",
                                                                            }}
                                                                            animate={{
                                                                                x: [
                                                                                    "-110%",
                                                                                    "310%",
                                                                                ],
                                                                            }}
                                                                            transition={{
                                                                                duration: 1.8,
                                                                                repeat: Infinity,
                                                                                ease: "linear",
                                                                            }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-4">
                                                                <div>
                                                                    <p className="text-[8px] uppercase tracking-wider text-slate-500">
                                                                        Capability
                                                                    </p>

                                                                    <p className="mt-1 text-[10px] font-medium text-white">
                                                                        {STRATEGIES.find(
                                                                            (
                                                                                strategy,
                                                                            ) =>
                                                                                strategy.id ===
                                                                                selected.strategy,
                                                                        )
                                                                            ?.name ??
                                                                            selected.strategy}
                                                                    </p>
                                                                </div>

                                                                <div className="text-right">
                                                                    <p className="text-[8px] uppercase tracking-wider text-slate-500">
                                                                        Model
                                                                    </p>

                                                                    <p className="mt-1 text-[10px] font-medium text-white">
                                                                        Claude
                                                                        Sonnet
                                                                        4.6
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                ) : (
                                                    <motion.div
                                                        key="profile-card"
                                                        initial={{
                                                            opacity: 0,
                                                            y: 10,
                                                            scale: 0.985,
                                                        }}
                                                        animate={{
                                                            opacity: 1,
                                                            y: 0,
                                                            scale: 1,
                                                        }}
                                                        exit={{
                                                            opacity: 0,
                                                            y: -10,
                                                            scale: 0.985,
                                                        }}
                                                        transition={{
                                                            duration: 0.25,
                                                            ease: [
                                                                0.22, 1, 0.36, 1,
                                                            ],
                                                        }}
                                                        className="flex aspect-square flex-col overflow-hidden rounded-2xl border bg-surface"
                                                        style={{
                                                            borderColor:
                                                                "rgba(110,231,255,0.3)",
                                                            boxShadow:
                                                                "0 20px 50px -28px rgba(14,165,233,0.45), 0 0 0 1px rgba(255,255,255,0.7) inset",
                                                        }}
                                                    >
                                                        <div className="h-20 shrink-0 overflow-hidden">
                                                            <AgentCover
                                                                seed={
                                                                    selected.agent_name ||
                                                                    selected.id
                                                                }
                                                            />
                                                        </div>

                                                        <div className="relative -mt-6 flex min-h-0 flex-1 flex-col gap-2 px-5 pb-4">
                                                            <div className="flex items-end gap-3">
                                                                <div className="relative overflow-hidden rounded-xl border-4 border-surface shadow-lg">
                                                                    <AgentAvatar
                                                                        seed={
                                                                            selected.agent_name ||
                                                                            selected.id
                                                                        }
                                                                        size={42}
                                                                    />
                                                                </div>


                                                            </div>

                                                            <div>
                                                                <p
                                                                    className="text-base font-bold text-ink"
                                                                    style={{
                                                                        fontFamily:
                                                                            "var(--font-display)",
                                                                    }}
                                                                >
                                                                    {
                                                                        selected.agent_name
                                                                    }
                                                                </p>

                                                                <p className="mt-0.5 flex items-center gap-1.5 text-[10px] capitalize text-muted">
                                                                    <span
                                                                        className="h-1.5 w-1.5 rounded-full"
                                                                        style={{
                                                                            background:
                                                                                STRATEGIES.find(
                                                                                    (
                                                                                        strategy,
                                                                                    ) =>
                                                                                        strategy.id ===
                                                                                        selected.strategy,
                                                                                )
                                                                                    ?.accent ||
                                                                                "#38BDF8",
                                                                        }}
                                                                    />

                                                                    {
                                                                        selected.strategy
                                                                    }{" "}
                                                                    · Autonomous
                                                                    Reasoning
                                                                    Agent
                                                                </p>
                                                            </div>

                                                            <div className="grid grid-cols-3 gap-2">
                                                                {[
                                                                    {
                                                                        label: "Agent ID",
                                                                        value: selected.agent_id,
                                                                    },
                                                                    {
                                                                        label: "Edge threshold",
                                                                        value: `${(
                                                                            selected.edge_threshold *
                                                                            100
                                                                        ).toFixed(
                                                                            0,
                                                                        )}%`,
                                                                    },
                                                                    {
                                                                        label: "Kelly",
                                                                        value: `${(
                                                                            selected.kelly_fraction *
                                                                            100
                                                                        ).toFixed(
                                                                            0,
                                                                        )}%`,
                                                                    },
                                                                ].map((stat) => (
                                                                    <div
                                                                        key={
                                                                            stat.label
                                                                        }
                                                                        className="overflow-hidden rounded-lg px-2 py-1.5"
                                                                        style={{
                                                                            background:
                                                                                "linear-gradient(135deg, rgba(56,189,248,0.06), rgba(110,231,255,0.03))",
                                                                            border:
                                                                                "1px solid rgba(110,231,255,0.2)",
                                                                        }}
                                                                    >
                                                                        <p className="mb-0.5 text-[8px] uppercase tracking-wider text-muted">
                                                                            {
                                                                                stat.label
                                                                            }
                                                                        </p>

                                                                        <p className="truncate font-mono text-[11px] font-bold text-ink">
                                                                            {
                                                                                stat.value
                                                                            }
                                                                        </p>
                                                                    </div>
                                                                ))}
                                                            </div>

                                                            <div
                                                                className="rounded-lg px-3 py-2"
                                                                style={{
                                                                    background:
                                                                        "var(--color-bg)",
                                                                    border:
                                                                        "1px solid var(--color-line)",
                                                                }}
                                                            >
                                                                <div className="mb-1 flex items-center justify-between">
                                                                    <p className="text-[8px] uppercase tracking-widest text-muted">
                                                                        Circle
                                                                        wallet
                                                                    </p>

                                                                    <span
                                                                        className="h-1.5 w-1.5 rounded-full"
                                                                        style={{
                                                                            background:
                                                                                "#38BDF8",
                                                                        }}
                                                                    />
                                                                </div>

                                                                <p
                                                                    className="truncate font-mono text-[9px] text-ink"
                                                                    title={
                                                                        selected.circle_wallet_address
                                                                    }
                                                                >
                                                                    {
                                                                        selected.circle_wallet_address
                                                                    }
                                                                </p>

                                                                <a
                                                                    href={`https://testnet.arcscan.app/address/${selected.circle_wallet_address}`}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="mt-1 inline-flex items-center gap-1 text-[9px] font-medium hover:opacity-70"
                                                                    style={{
                                                                        color: "#0EA5E9",
                                                                    }}
                                                                >
                                                                    View on
                                                                    ArcScan ↗
                                                                </a>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>

                                            {/* Action button */}
                                            <motion.button
                                                layout
                                                whileHover={{
                                                    scale: 1.015,
                                                    y: -2,
                                                }}
                                                whileTap={{ scale: 0.98 }}
                                                onClick={
                                                    agentState === "running"
                                                        ? handleStop
                                                        : handleRun
                                                }
                                                className="relative w-full overflow-hidden rounded-2xl py-4 text-sm font-semibold text-white"
                                                style={{
                                                    background:
                                                        agentState === "running"
                                                            ? "linear-gradient(135deg, #EF4444, #DC2626)"
                                                            : agentState === "done"
                                                                ? `linear-gradient(
                    135deg,
                    ${selectedAgentTheme?.primary ?? "#1C1D1F"},
                    ${selectedAgentTheme?.secondary ?? "#34363A"}
                )`
                                                                : `linear-gradient(
                    135deg,
                    ${selectedAgentTheme?.primary ?? "#38BDF8"},
                    ${selectedAgentTheme?.secondary ?? "#0EA5E9"}
                )`,
                                                    boxShadow:
                                                        agentState === "running"
                                                            ? "0 16px 32px -16px rgba(220,38,38,0.55)"
                                                            : `0 16px 32px -16px ${selectedAgentTheme?.shadow ?? "rgba(14,165,233,0.6)"
                                                            }`,
                                                }}
                                            >
                                                <motion.span
                                                    className="absolute inset-y-0 w-20 bg-white/20 blur-xl"
                                                    animate={{
                                                        x: [-100, 420],
                                                    }}
                                                    transition={{
                                                        duration: 2.5,
                                                        repeat: Infinity,
                                                        ease: "linear",
                                                    }}
                                                />

                                                <span className="relative">
                                                    {agentState === "running"
                                                        ? "Stop agent"
                                                        : agentState === "done"
                                                            ? "Run agent again →"
                                                            : "Run agent →"}
                                                </span>
                                            </motion.button>
                                        </div>

                                        <ReasoningFeed
                                            trades={trades}
                                            agentName={
                                                selected.agent_name ||
                                                "Unnamed agent"
                                            }
                                            agentSeed={
                                                selected.agent_name || selected.id
                                            }
                                            capability={
                                                STRATEGIES.find(
                                                    (strategy) =>
                                                        strategy.id ===
                                                        selected.strategy,
                                                )?.name
                                            }
                                            capabilityAccent={
                                                STRATEGIES.find(
                                                    (strategy) =>
                                                        strategy.id ===
                                                        selected.strategy,
                                                )?.accent
                                            }
                                            isRunning={
                                                agentState === "running"
                                            }
                                        />
                                    </motion.div>
                                )}

                                {/* PnL tab */}
                                {activeTab === "pnl" && (
                                    <motion.div
                                        key="pnl-tab"
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 8 }}
                                        transition={{ duration: 0.2 }}
                                        className="rounded-2xl border border-line bg-surface p-8"
                                    >
                                        <div className="mb-8 grid gap-4 sm:grid-cols-3">
                                            <div className="rounded-xl border border-line bg-bg p-4">
                                                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                                                    Trades executed
                                                </p>

                                                <p className="mt-1 font-mono text-2xl font-bold text-ink">
                                                    {
                                                        trades.filter(
                                                            (trade) =>
                                                                trade.action !==
                                                                "PASS",
                                                        ).length
                                                    }
                                                </p>
                                            </div>

                                            <div className="rounded-xl border border-line bg-bg p-4">
                                                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                                                    Avg edge
                                                </p>

                                                <p className="mt-1 font-mono text-2xl font-bold text-ink">
                                                    {trades.filter(
                                                        (trade) =>
                                                            trade.action !==
                                                            "PASS",
                                                    ).length > 0
                                                        ? (
                                                            (trades
                                                                .filter(
                                                                    (trade) =>
                                                                        trade.action !==
                                                                        "PASS",
                                                                )
                                                                .reduce(
                                                                    (
                                                                        total,
                                                                        trade,
                                                                    ) =>
                                                                        total +
                                                                        Math.abs(
                                                                            trade.edge,
                                                                        ),
                                                                    0,
                                                                ) /
                                                                trades.filter(
                                                                    (trade) =>
                                                                        trade.action !==
                                                                        "PASS",
                                                                ).length) *
                                                            100
                                                        ).toFixed(1)
                                                        : "0.0"}
                                                    %
                                                </p>
                                            </div>

                                            <div className="rounded-xl border border-line bg-bg p-4">
                                                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                                                    USDC deployed
                                                </p>

                                                <p className="mt-1 font-mono text-2xl font-bold text-ink">
                                                    {(
                                                        trades.reduce(
                                                            (total, trade) =>
                                                                total +
                                                                (trade.usdc_amount ||
                                                                    0),
                                                            0,
                                                        ) / 1e6
                                                    ).toFixed(2)}
                                                </p>
                                            </div>
                                        </div>

                                        <p className="text-center text-sm text-muted">
                                            Realised P&amp;L tracking requires
                                            market resolution.
                                        </p>
                                    </motion.div>
                                )}

                                {/* Transactions tab */}
                                {activeTab === "transactions" && (
                                    <motion.div
                                        key="transactions-tab"
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 8 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-x-auto rounded-2xl border border-line bg-surface"
                                    >
                                        <table className="w-full min-w-[720px] text-sm">
                                            <thead>
                                                <tr className="border-b border-line text-left">
                                                    <th className="p-4 text-[10px] font-semibold uppercase tracking-widest text-muted">
                                                        Time
                                                    </th>

                                                    <th className="p-4 text-[10px] font-semibold uppercase tracking-widest text-muted">
                                                        Action
                                                    </th>

                                                    <th className="p-4 text-[10px] font-semibold uppercase tracking-widest text-muted">
                                                        Amount
                                                    </th>

                                                    <th className="p-4 text-[10px] font-semibold uppercase tracking-widest text-muted">
                                                        Edge
                                                    </th>

                                                    <th className="p-4 text-[10px] font-semibold uppercase tracking-widest text-muted">
                                                        Market
                                                    </th>
                                                </tr>
                                            </thead>

                                            <tbody>
                                                {trades.filter(
                                                    (trade) =>
                                                        trade.action !== "PASS",
                                                ).length === 0 ? (
                                                    <tr>
                                                        <td
                                                            colSpan={5}
                                                            className="p-8 text-center text-muted"
                                                        >
                                                            No executed trades yet.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    trades
                                                        .filter(
                                                            (trade) =>
                                                                trade.action !==
                                                                "PASS",
                                                        )
                                                        .map((trade) => (
                                                            <tr
                                                                key={trade.id}
                                                                className="border-b border-line last:border-0"
                                                            >
                                                                <td className="p-4 font-mono text-xs text-muted">
                                                                    {new Date(
                                                                        trade.timestamp,
                                                                    ).toLocaleString()}
                                                                </td>

                                                                <td className="p-4">
                                                                    <span
                                                                        className="rounded-full px-2 py-1 text-[10px] font-semibold uppercase"
                                                                        style={{
                                                                            background:
                                                                                trade.action ===
                                                                                    "BUY_YES"
                                                                                    ? "#E9F7EE"
                                                                                    : "#FDEEEE",
                                                                            color:
                                                                                trade.action ===
                                                                                    "BUY_YES"
                                                                                    ? "#16A34A"
                                                                                    : "#DC2626",
                                                                        }}
                                                                    >
                                                                        {
                                                                            trade.action
                                                                        }
                                                                    </span>
                                                                </td>

                                                                <td className="p-4 font-mono text-xs text-ink">
                                                                    {(
                                                                        trade.usdc_amount /
                                                                        1e6
                                                                    ).toFixed(2)}{" "}
                                                                    USDC
                                                                </td>

                                                                <td className="p-4 font-mono text-xs text-muted">
                                                                    {(
                                                                        trade.edge *
                                                                        100
                                                                    ).toFixed(1)}
                                                                    pts
                                                                </td>

                                                                <td className="p-4 font-mono text-xs text-muted">
                                                                    {trade.market_address
                                                                        ? `${trade.market_address.slice(
                                                                            0,
                                                                            8,
                                                                        )}...`
                                                                        : "—"}
                                                                </td>
                                                            </tr>
                                                        ))
                                                )}
                                            </tbody>
                                        </table>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}