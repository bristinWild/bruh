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
        accent: "#8B5CF6",
        secondary: "#6366F1",
        initial: "N",
        description:
            "Aggressive. Weights recent news heavily and trades quickly on clear signals.",
    },
    {
        id: "actuary",
        name: "Actuary",
        tag: "Base rates",
        accent: "#3B82F6",
        secondary: "#06B6D4",
        initial: "A",
        description:
            "Conservative. Anchors on historical priors and waits for meaningful mispricing.",
    },
    {
        id: "both",
        name: "Both capabilities",
        tag: "Ensemble",
        accent: "#7C3AED",
        secondary: "#2563EB",
        initial: "B",
        description:
            "Runs both reasoning styles. Disagreement is signal; agreement is conviction.",
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
            <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f7f6f2] px-6">
                <div className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-300/20 blur-[160px]" />

                <div className="relative w-full max-w-md rounded-[28px] border border-violet-200/70 bg-[#fffdf8]/85 p-8 text-center shadow-[0_35px_90px_-58px_rgba(79,70,229,0.55)] backdrop-blur-xl">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[18px] bg-gradient-to-br from-violet-500 to-blue-500 font-mono text-lg font-black text-white">
                        B
                    </div>

                    <h1
                        className="mt-6 text-[30px] font-black uppercase tracking-[-0.045em] text-slate-950"
                        style={{ fontFamily: "var(--font-display)" }}
                    >
                        Wallet required
                    </h1>

                    <p className="mt-3 text-[13px] font-medium leading-[1.7] text-slate-500">
                        Connect and verify your wallet before accessing your agent dashboard.
                    </p>

                    <a
                        href="/get-started"
                        className="mt-7 inline-flex w-full items-center justify-center rounded-[14px] bg-gradient-to-r from-violet-500 to-blue-500 px-6 py-4 text-[10px] font-black uppercase tracking-[0.14em] text-white"
                    >
                        Connect wallet →
                    </a>
                </div>
            </main>
        );
    }

    if (loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#f7f6f2]">
                <div className="flex items-center gap-3 rounded-full border border-violet-200 bg-[#fffdf8]/80 px-5 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 shadow-sm">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
                    Loading dashboard
                </div>
            </main>
        );
    }

    return (
        <main className="relative min-h-screen overflow-hidden bg-[#f7f6f2] px-6 pb-24 pt-28">
            {/* Atmospheric background */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <motion.div
                    className="absolute -left-56 -top-48 h-[560px] w-[560px] rounded-full bg-violet-300/15 blur-[170px]"
                    animate={{ x: [0, 35, 0], y: [0, 24, 0] }}
                    transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
                />

                <motion.div
                    className="absolute -right-56 top-1/3 h-[620px] w-[620px] rounded-full bg-blue-300/15 blur-[180px]"
                    animate={{ x: [0, -30, 0], y: [0, 34, 0] }}
                    transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
                />

                <div
                    className="absolute inset-0 opacity-[0.025]"
                    style={{
                        backgroundImage: `
                            linear-gradient(to right, rgba(99,102,241,0.2) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(99,102,241,0.2) 1px, transparent 1px)
                        `,
                        backgroundSize: "48px 48px",
                    }}
                />
            </div>

            <div className="relative z-10 mx-auto max-w-7xl">
                {/* Header */}
                <motion.header
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"
                >
                    <div>
                        <div className="inline-flex rounded-full bg-gradient-to-r from-violet-500 to-blue-500 p-px">
                            <div className="flex items-center gap-2 rounded-full bg-[#fbf8f2] px-4 py-2">
                                <span className="relative flex h-2 w-2">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-40" />
                                    <span className="relative h-2 w-2 rounded-full bg-emerald-500" />
                                </span>

                                <span className="font-mono text-[8px] font-black uppercase tracking-[0.2em] text-slate-600">
                                    Agent control center
                                </span>
                            </div>
                        </div>

                        <h1
                            className="mt-5 text-[46px] font-black uppercase leading-[0.92] tracking-[-0.055em] text-slate-950 sm:text-[58px]"
                            style={{ fontFamily: "var(--font-display)" }}
                        >
                            Your agent{" "}
                            <span className="bg-gradient-to-r from-violet-600 to-blue-500 bg-clip-text text-transparent">
                                portfolio.
                            </span>
                        </h1>

                        <p className="mt-4 max-w-xl text-[14px] font-medium leading-[1.7] text-slate-500">
                            Create autonomous agents, inspect their reasoning, and track every prediction-market decision.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 rounded-[22px] border border-violet-200/60 bg-[#fffdf8]/80 p-3 shadow-[0_18px_50px_-38px_rgba(79,70,229,0.45)] backdrop-blur-md">
                        <DashboardMetric
                            label="Agents"
                            value={String(wallets.length)}
                            icon="A"
                            accent="#8B5CF6"
                        />

                        <div className="hidden h-9 w-px bg-black/10 sm:block" />

                        <DashboardMetric
                            label="Trades"
                            value={String(
                                trades.filter((trade) => trade.action !== "PASS")
                                    .length,
                            )}
                            icon="T"
                            accent="#3B82F6"
                        />

                        <div className="hidden h-9 w-px bg-black/10 sm:block" />

                        <DashboardMetric
                            label="Network"
                            value="ARC"
                            icon="N"
                            accent="#06B6D4"
                        />
                    </div>
                </motion.header>

                {/* Agent selector */}
                {wallets.length > 0 && (
                    <div className="mb-7 flex flex-wrap items-center gap-2 rounded-[20px] border border-black/10 bg-[#fffdf8]/70 p-3 backdrop-blur-md">
                        {wallets.map((wallet) => {
                            const active = selected?.id === wallet.id;
                            const theme = getAgentTheme(wallet.agent_name || wallet.id);

                            return (
                                <button
                                    key={wallet.id}
                                    type="button"
                                    onClick={() => selectWallet(wallet)}
                                    className="flex items-center gap-2 rounded-full border px-3 py-2 text-[9px] font-black uppercase tracking-[0.12em] transition-all"
                                    style={
                                        active
                                            ? {
                                                color: "#FFFFFF",
                                                borderColor: theme.primary,
                                                background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`,
                                                boxShadow: `0 12px 24px -18px ${theme.shadow}`,
                                            }
                                            : {
                                                color: "#64748B",
                                                borderColor: "rgba(15,23,42,0.1)",
                                                background: "rgba(255,255,255,0.65)",
                                            }
                                    }
                                >
                                    <AgentAvatar seed={wallet.agent_name || wallet.id} size={20} />
                                    {wallet.agent_name || wallet.strategy}
                                </button>
                            );
                        })}

                        <button
                            type="button"
                            onClick={startNewAgent}
                            className="rounded-full border border-dashed border-violet-300 bg-violet-50/60 px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.12em] text-violet-600 transition-colors hover:bg-violet-100"
                        >
                            + New agent
                        </button>
                    </div>
                )}

                <AnimatePresence mode="wait">
                    {/* Create agent */}
                    {(!selected || wallets.length === 0) && (
                        <motion.section
                            key="create-agent"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{
                                duration: 0.5,
                                ease: [0.22, 1, 0.36, 1],
                            }}
                            className="relative overflow-hidden rounded-[30px] border border-violet-200/70 bg-[#fffdf8]/90 p-5 shadow-[0_35px_90px_-60px_rgba(79,70,229,0.55)] backdrop-blur-xl sm:p-7"
                        >
                            <div className="pointer-events-none absolute -right-32 -top-32 h-[360px] w-[360px] rounded-full bg-violet-300/15 blur-[120px]" />

                            <div className="pointer-events-none absolute -bottom-36 -left-28 h-[340px] w-[340px] rounded-full bg-blue-300/15 blur-[120px]" />

                            <div
                                className="pointer-events-none absolute inset-0 opacity-[0.025] mix-blend-multiply"
                                style={{
                                    backgroundImage:
                                        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='.9'/%3E%3C/svg%3E\")",
                                }}
                            />

                            <div className="relative">
                                <div className="mb-7 flex flex-col gap-5 border-b border-black/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
                                    <div>
                                        <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50/70 px-3 py-1.5">
                                            <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />

                                            <span className="text-[8px] font-black uppercase tracking-[0.18em] text-violet-600">
                                                New agent
                                            </span>
                                        </div>

                                        <h2
                                            className="mt-4 text-[32px] font-black uppercase leading-none tracking-[-0.045em] text-slate-950 sm:text-[38px]"
                                            style={{
                                                fontFamily: "var(--font-display)",
                                            }}
                                        >
                                            Build your{" "}
                                            <span className="bg-gradient-to-r from-violet-600 to-blue-500 bg-clip-text text-transparent">
                                                agent.
                                            </span>
                                        </h2>

                                        <p className="mt-3 max-w-xl text-[12px] font-medium leading-[1.65] text-slate-500">
                                            Give your agent an identity, choose how it reasons,
                                            and deploy its wallet on Arc.
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2 rounded-[14px] border border-black/10 bg-white/60 px-4 py-3">
                                        <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-gradient-to-br from-violet-500 to-blue-500 font-mono text-[10px] font-black text-white">
                                            01
                                        </span>

                                        <div>
                                            <p className="text-[7px] font-black uppercase tracking-[0.16em] text-slate-400">
                                                Setup
                                            </p>

                                            <p className="mt-1 text-[10px] font-black text-slate-700">
                                                Identity & capability
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
                                    {/* Identity */}
                                    <section className="rounded-[24px] border border-black/10 bg-white/55 p-5">
                                        <div className="flex items-start gap-4">
                                            <motion.div
                                                key={agentName || "preview"}
                                                initial={{
                                                    scale: 0.9,
                                                    rotate: -4,
                                                }}
                                                animate={{
                                                    scale: 1,
                                                    rotate: 0,
                                                }}
                                                transition={{
                                                    type: "spring",
                                                    stiffness: 280,
                                                    damping: 22,
                                                }}
                                                className="relative shrink-0"
                                            >
                                                <div className="absolute inset-0 rounded-[18px] bg-gradient-to-br from-violet-500 to-blue-500 opacity-30 blur-xl" />

                                                <div className="relative overflow-hidden rounded-[18px] border-4 border-white shadow-lg">
                                                    <AgentAvatar
                                                        seed={agentName || "preview"}
                                                        size={64}
                                                    />
                                                </div>
                                            </motion.div>

                                            <div className="min-w-0">
                                                <p className="text-[8px] font-black uppercase tracking-[0.18em] text-slate-400">
                                                    Agent identity
                                                </p>

                                                <h3 className="mt-2 text-[18px] font-black tracking-[-0.03em] text-slate-900">
                                                    {agentName.trim() || "Unnamed agent"}
                                                </h3>

                                                <p className="mt-2 text-[10px] font-medium leading-[1.55] text-slate-500">
                                                    This name appears on reasoning feeds,
                                                    transactions, and agent activity.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-6">
                                            <label className="mb-2 block text-[8px] font-black uppercase tracking-[0.17em] text-slate-400">
                                                Agent name
                                            </label>

                                            <input
                                                type="text"
                                                value={agentName}
                                                onChange={(event) =>
                                                    setAgentName(event.target.value)
                                                }
                                                placeholder="Scout, Oracle, Ledger..."
                                                maxLength={24}
                                                className="h-14 w-full rounded-[15px] border bg-white/80 px-4 text-[13px] font-bold text-slate-900 outline-none transition-all placeholder:font-medium placeholder:text-slate-400"
                                                style={{
                                                    borderColor: agentName
                                                        ? "rgba(139,92,246,0.45)"
                                                        : "rgba(15,23,42,0.1)",
                                                    boxShadow: agentName
                                                        ? "0 0 0 4px rgba(139,92,246,0.08)"
                                                        : "none",
                                                }}
                                            />

                                            <div className="mt-2 flex items-center justify-between">
                                                <p className="text-[8px] font-medium text-slate-400">
                                                    Keep it short and memorable.
                                                </p>

                                                <p className="font-mono text-[8px] font-black text-slate-400">
                                                    {agentName.length}/24
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-5 grid grid-cols-2 gap-2">
                                            <div className="rounded-[13px] border border-black/10 bg-[#fffdf8]/70 p-3">
                                                <p className="text-[7px] font-black uppercase tracking-[0.15em] text-slate-400">
                                                    Network
                                                </p>

                                                <p className="mt-2 font-mono text-[10px] font-black text-slate-800">
                                                    Arc Testnet
                                                </p>
                                            </div>

                                            <div className="rounded-[13px] border border-black/10 bg-[#fffdf8]/70 p-3">
                                                <p className="text-[7px] font-black uppercase tracking-[0.15em] text-slate-400">
                                                    Settlement
                                                </p>

                                                <p className="mt-2 font-mono text-[10px] font-black text-slate-800">
                                                    USDC
                                                </p>
                                            </div>
                                        </div>
                                    </section>

                                    {/* Capability */}
                                    <section className="rounded-[24px] border border-black/10 bg-white/55 p-5">
                                        <div>
                                            <p className="text-[8px] font-black uppercase tracking-[0.18em] text-slate-400">
                                                Reasoning capability
                                            </p>

                                            <h3 className="mt-2 text-[18px] font-black tracking-[-0.03em] text-slate-900">
                                                Choose how your agent thinks.
                                            </h3>

                                            <p className="mt-2 text-[10px] font-medium leading-[1.55] text-slate-500">
                                                You can create additional agents with different
                                                capabilities later.
                                            </p>
                                        </div>

                                        <div className="mt-5 grid gap-3">
                                            {STRATEGIES.map((strategy, index) => {
                                                const isSelected =
                                                    selectedStrategy === strategy.id;

                                                return (
                                                    <motion.button
                                                        key={strategy.id}
                                                        type="button"
                                                        initial={{
                                                            opacity: 0,
                                                            y: 10,
                                                        }}
                                                        animate={{
                                                            opacity: 1,
                                                            y: 0,
                                                        }}
                                                        transition={{
                                                            delay: 0.12 + index * 0.05,
                                                        }}
                                                        onClick={() =>
                                                            setSelectedStrategy(strategy.id)
                                                        }
                                                        whileHover={{
                                                            y: -3,
                                                        }}
                                                        whileTap={{
                                                            scale: 0.99,
                                                        }}
                                                        className="relative overflow-hidden rounded-[18px] border p-4 text-left transition-all"
                                                        style={{
                                                            borderColor: isSelected
                                                                ? `${strategy.accent}65`
                                                                : "rgba(15,23,42,0.1)",
                                                            background: isSelected
                                                                ? `linear-gradient(
                                                  135deg,
                                                  ${strategy.accent}12,
                                                  ${strategy.secondary}07
                                              )`
                                                                : "rgba(255,255,255,0.65)",
                                                            boxShadow: isSelected
                                                                ? `0 18px 38px -30px ${strategy.accent}`
                                                                : "none",
                                                        }}
                                                    >
                                                        {isSelected && (
                                                            <motion.div
                                                                layoutId="capability-accent"
                                                                className="absolute inset-y-0 left-0 w-1"
                                                                style={{
                                                                    background: `linear-gradient(
                                                    180deg,
                                                    ${strategy.accent},
                                                    ${strategy.secondary}
                                                )`,
                                                                }}
                                                            />
                                                        )}

                                                        <div className="flex items-start gap-4">
                                                            <div
                                                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] font-mono text-[12px] font-black"
                                                                style={{
                                                                    color: strategy.accent,
                                                                    background: `${strategy.accent}12`,
                                                                    border: `1px solid ${strategy.accent}24`,
                                                                }}
                                                            >
                                                                {strategy.initial}
                                                            </div>

                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                                    <p className="text-[13px] font-black text-slate-900">
                                                                        {strategy.name}
                                                                    </p>

                                                                    <span
                                                                        className="rounded-full px-2.5 py-1 text-[7px] font-black uppercase tracking-[0.14em]"
                                                                        style={{
                                                                            color:
                                                                                strategy.accent,
                                                                            background: `${strategy.accent}10`,
                                                                        }}
                                                                    >
                                                                        {strategy.tag}
                                                                    </span>
                                                                </div>

                                                                <p className="mt-2 max-w-xl text-[10px] font-medium leading-[1.55] text-slate-500">
                                                                    {strategy.description}
                                                                </p>
                                                            </div>

                                                            <div
                                                                className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border"
                                                                style={{
                                                                    borderColor: isSelected
                                                                        ? strategy.accent
                                                                        : "rgba(15,23,42,0.15)",
                                                                    background: isSelected
                                                                        ? strategy.accent
                                                                        : "transparent",
                                                                }}
                                                            >
                                                                {isSelected && (
                                                                    <svg
                                                                        width="11"
                                                                        height="11"
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
                                                                )}
                                                            </div>
                                                        </div>
                                                    </motion.button>
                                                );
                                            })}
                                        </div>
                                    </section>
                                </div>

                                {/* Action bar */}
                                <div className="mt-6 flex flex-col gap-4 rounded-[20px] border border-black/10 bg-white/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="flex h-9 w-9 items-center justify-center rounded-[11px] font-mono text-[10px] font-black"
                                            style={{
                                                color: selectedStrategy
                                                    ? "#FFFFFF"
                                                    : "#94A3B8",
                                                background: selectedStrategy
                                                    ? "linear-gradient(135deg, #8B5CF6, #3B82F6)"
                                                    : "rgba(148,163,184,0.12)",
                                            }}
                                        >
                                            {selectedStrategy ? "✓" : "02"}
                                        </div>

                                        <div>
                                            <p className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-400">
                                                Ready to deploy
                                            </p>

                                            <p className="mt-1 text-[10px] font-black text-slate-700">
                                                {agentName.trim() && selectedStrategy
                                                    ? `${agentName.trim()} is ready`
                                                    : "Complete the agent setup"}
                                            </p>
                                        </div>
                                    </div>

                                    <motion.button
                                        type="button"
                                        whileHover={
                                            selectedStrategy && agentName.trim()
                                                ? {
                                                    y: -2,
                                                    scale: 1.01,
                                                }
                                                : undefined
                                        }
                                        whileTap={{
                                            scale: 0.98,
                                        }}
                                        onClick={handleCreateAgent}
                                        disabled={
                                            !selectedStrategy ||
                                            !agentName.trim() ||
                                            creating
                                        }
                                        className="min-w-[210px] rounded-[14px] px-6 py-4 text-[10px] font-black uppercase tracking-[0.14em] text-white disabled:cursor-not-allowed disabled:opacity-30"
                                        style={{
                                            background:
                                                "linear-gradient(135deg, #8B5CF6, #3B82F6)",
                                            boxShadow:
                                                selectedStrategy && agentName.trim()
                                                    ? "0 18px 36px -22px rgba(79,70,229,0.75)"
                                                    : "none",
                                        }}
                                    >
                                        {creating
                                            ? "Creating agent..."
                                            : "Create agent →"}
                                    </motion.button>
                                </div>
                            </div>
                        </motion.section>
                    )}

                    {/* Existing agent */}
                    {selected && wallets.length > 0 && (
                        <motion.div
                            key="agent-shell"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                        >
                            <div className="mb-7 flex items-center gap-1 rounded-[16px] border border-black/10 bg-[#fffdf8]/70 p-1.5 backdrop-blur-md">
                                {TABS.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className="relative rounded-[11px] px-5 py-3 text-[9px] font-black uppercase tracking-[0.14em] transition-colors"
                                        style={{
                                            color:
                                                activeTab === tab.id
                                                    ? "#FFFFFF"
                                                    : "#64748B",
                                        }}
                                    >
                                        <span className="relative z-10">{tab.label}</span>

                                        {activeTab === tab.id && (
                                            <motion.div
                                                layoutId="tab-underline"
                                                className="absolute inset-0 rounded-[11px]"
                                                style={{
                                                    background: "linear-gradient(135deg, #8B5CF6, #3B82F6)",
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
                                                                "rgba(139,92,246,0.35)",
                                                            background:
                                                                "linear-gradient(145deg, #071524 0%, #0A243A 55%, #0C3048 100%)",
                                                            boxShadow:
                                                                "0 24px 60px -30px rgba(79,70,229,0.7), inset 0 0 36px rgba(139,92,246,0.08)",
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
                                                                                    "linear-gradient(90deg, #8B5CF6, #3B82F6)",
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
                                                                "rgba(139,92,246,0.25)",
                                                            boxShadow:
                                                                "0 20px 50px -28px rgba(79,70,229,0.45), 0 0 0 1px rgba(255,255,255,0.7) inset",
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
                                                                                "#8B5CF6",
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
                                                                                "linear-gradient(135deg, rgba(139,92,246,0.06), rgba(59,130,246,0.03))",
                                                                            border:
                                                                                "1px solid rgba(139,92,246,0.18)",
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
                                                                                "#8B5CF6",
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
                                                                        color: "#7C3AED",
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
                    ${selectedAgentTheme?.primary ?? "#8B5CF6"},
                    ${selectedAgentTheme?.secondary ?? "#6366F1"}
                )`,
                                                    boxShadow:
                                                        agentState === "running"
                                                            ? "0 16px 32px -16px rgba(220,38,38,0.55)"
                                                            : `0 16px 32px -16px ${selectedAgentTheme?.shadow ?? "rgba(79,70,229,0.6)"
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
                                        className="rounded-[26px] border border-black/10 bg-[#fffdf8]/75 p-6 backdrop-blur-md sm:p-8"
                                    >
                                        <div className="mb-8 grid gap-4 sm:grid-cols-3">
                                            <div className="rounded-[18px] border border-black/10 bg-white/60 p-5">
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

                                            <div className="rounded-[18px] border border-black/10 bg-white/60 p-5">
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

                                            <div className="rounded-[18px] border border-black/10 bg-white/60 p-5">
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
                                        className="overflow-x-auto rounded-[24px] border border-black/10 bg-[#fffdf8]/80 backdrop-blur-md"
                                    >
                                        <table className="w-full min-w-[720px] text-sm">
                                            <thead>
                                                <tr className="border-b border-black/10 bg-violet-50/40 text-left">
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
                                                                className="border-b border-black/5 transition-colors last:border-0 hover:bg-violet-50/35"
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
        </main>
    );
}

function DashboardMetric({
    label,
    value,
    icon,
    accent,
}: {
    label: string;
    value: string;
    icon: string;
    accent: string;
}) {
    return (
        <div className="flex min-w-[120px] flex-1 items-center gap-3 rounded-[16px] px-3 py-2 sm:flex-none">
            <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] font-mono text-[11px] font-black text-white"
                style={{
                    background: `linear-gradient(
                        135deg,
                        ${accent},
                        ${accent}CC
                    )`,
                    boxShadow: `0 12px 24px -18px ${accent}`,
                }}
            >
                {icon}
            </div>

            <div>
                <p className="text-[7px] font-black uppercase tracking-[0.17em] text-slate-400">
                    {label}
                </p>

                <p className="mt-1 font-mono text-[15px] font-black leading-none text-slate-900">
                    {value}
                </p>
            </div>
        </div>
    );
}