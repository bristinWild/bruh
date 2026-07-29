"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getMyWallets, createAgentWallet, runAgent, getTrades } from "@/src/lib/api";


const STRATEGIES = [
    {
        id: "newshound", name: "Newshound", tag: "News momentum", accent: "#38BDF8", initial: "N",
        description: "Aggressive. Weights recent news heavily. Trades fast on clear signals."
    },
    {
        id: "actuary", name: "Actuary", tag: "Base rates", accent: "#6EE7FF", initial: "A",
        description: "Conservative. Anchors on historical priors. Only trades on clear mispricing."
    },
    {
        id: "both", name: "Both agents", tag: "Ensemble", accent: "#0EA5E9", initial: "B",
        description: "Run both. Disagreement is signal. Agreement is conviction."
    },
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
    const [running, setRunning] = useState(false);
    const [activeTab, setActiveTab] = useState<"agent" | "pnl" | "transactions">("agent");




    useEffect(() => {
        const t = localStorage.getItem("bruh_token");
        if (t) setToken(t);
        else setLoading(false);
    }, []);

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

    // Poll trades every 5s while agent is running
    useEffect(() => {
        if (!running || !token || !selected) return;
        const interval = setInterval(async () => {
            const tr = await getTrades(token, selected.id);
            setTrades(tr || []);
        }, 5000);
        return () => clearInterval(interval);
    }, [running, token, selected]);

    async function handleCreateAgent() {
        if (!token || !selectedStrategy) return;
        setCreating(true);
        try {
            const w = await createAgentWallet(token, selectedStrategy);
            await loadWallets(token);
            setSelected(w);
        } finally {
            setCreating(false);
        }
    }

    async function handleRun() {
        if (!token || !selected) return;
        setRunning(true);
        // Set status active in DB
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/wallets/${selected.id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ status: "active" }),
        });
        await runAgent(token, selected.id);
        setTimeout(async () => {
            const tr = await getTrades(token, selected.id);
            setTrades(tr || []);
        }, 3000);
    }

    async function handleStop() {
        if (!token || !selected) return;
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/wallets/${selected.id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ status: "paused" }),
        });
        setRunning(false);
    }

    async function selectWallet(w: any) {
        setSelected(w);
        setRunning(false);
        if (token) {
            const tr = await getTrades(token, w.id);
            setTrades(tr || []);
        }
    }

    // Not authenticated
    if (!loading && !token) {
        return (
            <div className="min-h-screen bg-bg flex items-center justify-center px-6">
                <div className="text-center">
                    <p className="text-lg font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>
                        Not signed in
                    </p>
                    <p className="mt-2 text-sm text-muted">Connect your wallet to view your dashboard.</p>
                    <a href="/get-started" className="mt-6 inline-block rounded-full px-6 py-3 text-sm font-semibold text-white" style={{ background: "#38BDF8" }}>
                        Get Started →
                    </a>
                </div>
            </div>
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
        <div className="min-h-screen bg-bg px-6 py-24">
            <div className="mx-auto max-w-5xl">

                {/* header */}
                <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
                    <span className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[12px] font-semibold uppercase tracking-wider text-muted" style={{ borderColor: "#6EE7FF" }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#38BDF8" }} />
                        Your dashboard
                    </span>
                    <h1 className="mt-4 text-3xl uppercase tracking-tight text-ink" style={{ fontFamily: "var(--font-display)" }}>
                        Agent overview
                    </h1>
                </motion.div>

                {/* wallet tabs — only if agents exist */}
                {wallets.length > 0 && (
                    <div className="flex items-center gap-2 mb-6 flex-wrap">
                        {wallets.map((w) => (
                            <button
                                key={w.id}
                                onClick={() => selectWallet(w)}
                                className="rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors"
                                style={{
                                    background: selected?.id === w.id ? "#38BDF8" : "var(--color-surface)",
                                    color: selected?.id === w.id ? "white" : "var(--color-muted)",
                                    border: "1px solid var(--color-line)",
                                }}
                            >
                                {w.strategy}
                            </button>
                        ))}
                        <button
                            onClick={() => setSelected(null)}
                            className="rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors border border-dashed"
                            style={{ color: "var(--color-muted)", borderColor: "var(--color-line)" }}
                        >
                            + New agent
                        </button>
                    </div>
                )}

                <AnimatePresence mode="wait">

                    {/* STATE 1 — no wallets OR user clicked "+ New agent" — show creation prompt */}
                    {(!selected || (wallets.length === 0)) && (
                        <motion.div
                            key="create"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="rounded-2xl border border-line bg-surface p-8"
                        >
                            <div className="text-center mb-6">
                                <h2 className="text-xl font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>
                                    Create your agentic wallet
                                </h2>
                                <p className="mt-2 text-sm text-muted">
                                    Choose a strategy template. Your agent gets its own Circle wallet on Arc.
                                </p>
                            </div>

                            <div className="flex flex-col gap-3 max-w-lg mx-auto">
                                {STRATEGIES.map((s) => {
                                    const isSelected = selectedStrategy === s.id;
                                    return (
                                        <motion.button
                                            key={s.id}
                                            onClick={() => setSelectedStrategy(s.id)}
                                            whileHover={{ y: -1 }}
                                            className="w-full rounded-xl border p-4 text-left transition-all flex items-start gap-4"
                                            style={{
                                                borderColor: isSelected ? s.accent : "var(--color-line)",
                                                background: isSelected ? `${s.accent}08` : "var(--color-surface)",
                                                boxShadow: isSelected ? `0 0 0 1px ${s.accent}` : "none",
                                            }}
                                        >
                                            {/* icon */}
                                            <div
                                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold"
                                                style={{ background: `${s.accent}18`, color: s.accent }}
                                            >
                                                {s.initial}
                                            </div>

                                            {/* content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="font-semibold text-ink text-[15px]">{s.name}</p>
                                                    <span className="text-[10px] font-medium text-muted uppercase tracking-wider shrink-0">{s.tag}</span>
                                                </div>
                                                <p className="mt-1 text-[13px] text-muted leading-snug">{s.description}</p>
                                            </div>

                                            {/* selection indicator */}
                                            <div className="shrink-0 pt-0.5">
                                                <AnimatePresence mode="wait">
                                                    {isSelected ? (
                                                        <motion.div
                                                            key="checked"
                                                            initial={{ scale: 0 }}
                                                            animate={{ scale: 1 }}
                                                            exit={{ scale: 0 }}
                                                            className="h-5 w-5 rounded-full flex items-center justify-center"
                                                            style={{ background: s.accent }}
                                                        >
                                                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                                                <path d="M2.5 6l2.5 2.5L9.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                            </svg>
                                                        </motion.div>
                                                    ) : (
                                                        <motion.div
                                                            key="unchecked"
                                                            initial={{ scale: 0 }}
                                                            animate={{ scale: 1 }}
                                                            exit={{ scale: 0 }}
                                                            className="h-5 w-5 rounded-full border-2"
                                                            style={{ borderColor: "var(--color-line)" }}
                                                        />
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        </motion.button>
                                    );
                                })}
                            </div>

                            <button
                                onClick={handleCreateAgent}
                                disabled={!selectedStrategy || creating}
                                className="w-full max-w-lg mx-auto mt-6 block rounded-full py-3 text-sm font-semibold text-white disabled:opacity-30 transition-all"
                                style={{ background: "#38BDF8" }}
                            >
                                {creating ? "Creating agent..." : "Create agent →"}
                            </button>
                        </motion.div>
                    )}

                    {/* STATE 2/3 — agent exists, show info + run/live feed */}
                    {selected && wallets.length > 0 && (
                        <motion.div
                            key="agent"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                        >
                            {/* tab bar */}
                            <div className="flex items-center gap-1 mb-6 border-b border-line">
                                {TABS.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className="relative px-4 py-3 text-sm font-semibold transition-colors"
                                        style={{ color: activeTab === tab.id ? "var(--color-ink)" : "var(--color-muted)" }}
                                    >
                                        {tab.label}
                                        {activeTab === tab.id && (
                                            <motion.div
                                                layoutId="tab-underline"
                                                className="absolute bottom-0 left-0 right-0 h-0.5"
                                                style={{ background: "#38BDF8" }}
                                            />
                                        )}
                                    </button>
                                ))}
                            </div>

                            <AnimatePresence mode="wait">

                                {/* AGENT TAB */}
                                {activeTab === "agent" && (
                                    <motion.div
                                        key="agent-tab"
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 8 }}
                                        transition={{ duration: 0.2 }}
                                        className="grid gap-6 lg:grid-cols-3"
                                    >
                                        {/* agent info card — same as before */}
                                        <div className="rounded-2xl border border-line bg-surface p-6 flex flex-col gap-4 h-fit">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-xl font-mono text-sm font-bold" style={{ background: "#ecfeff", color: "#0EA5E9" }}>
                                                    {selected.strategy?.[0]?.toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-ink capitalize">{selected.strategy}</p>
                                                    <p className="text-xs text-muted">Forecaster agent</p>
                                                </div>
                                                <span
                                                    className="ml-auto text-[10px] font-semibold uppercase px-2 py-1 rounded-full flex items-center gap-1"
                                                    style={{
                                                        background: running ? "#e9f7ee" : "var(--color-line)",
                                                        color: running ? "#16A34A" : "var(--color-muted)",
                                                    }}
                                                >
                                                    {running && (
                                                        <span className="relative flex h-1.5 w-1.5">
                                                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yes opacity-60" />
                                                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-yes" />
                                                        </span>
                                                    )}
                                                    {running ? "running" : selected.status}
                                                </span>
                                            </div>

                                            <div className="rounded-xl bg-bg border border-line p-4">
                                                <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Circle Wallet</p>
                                                <p className="font-mono text-xs text-ink break-all">{selected.circle_wallet_address}</p>
                                                <a href={`https://testnet.arcscan.app/address/${selected.circle_wallet_address}`} target="_blank" className="text-[11px] mt-2 inline-block underline" style={{ color: "#0EA5E9" }}>
                                                    View on arcscan ↗
                                                </a>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="rounded-xl bg-bg border border-line p-3">
                                                    <p className="text-[10px] uppercase tracking-widest text-muted">Edge threshold</p>
                                                    <p className="font-mono text-lg font-bold text-ink mt-1">{(selected.edge_threshold * 100).toFixed(0)}%</p>
                                                </div>
                                                <div className="rounded-xl bg-bg border border-line p-3">
                                                    <p className="text-[10px] uppercase tracking-widest text-muted">Kelly fraction</p>
                                                    <p className="font-mono text-lg font-bold text-ink mt-1">{(selected.kelly_fraction * 100).toFixed(0)}%</p>
                                                </div>
                                            </div>

                                            {running ? (
                                                <button
                                                    onClick={handleStop}
                                                    className="w-full rounded-full py-3 text-sm font-semibold text-white transition-all"
                                                    style={{ background: "#DC2626" }}
                                                >
                                                    ⏸ Stop agent
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={handleRun}
                                                    className="w-full rounded-full py-3 text-sm font-semibold text-white transition-all"
                                                    style={{ background: "#38BDF8" }}
                                                >
                                                    Run agent →
                                                </button>
                                            )}
                                        </div>

                                        {/* reasoning feed */}
                                        <div className="lg:col-span-2 rounded-2xl border border-line bg-surface overflow-hidden">
                                            <div className="p-5 border-b border-line flex items-center justify-between">
                                                <div>
                                                    <p className="font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>Reasoning feed</p>
                                                    <p className="text-xs text-muted mt-1">{trades.length} decision{trades.length !== 1 ? "s" : ""} logged</p>
                                                </div>
                                                {running && (
                                                    <span className="text-[11px] font-medium flex items-center gap-1.5" style={{ color: "#38BDF8" }}>
                                                        <span className="relative flex h-1.5 w-1.5">
                                                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: "#38BDF8" }} />
                                                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: "#38BDF8" }} />
                                                        </span>
                                                        Live
                                                    </span>
                                                )}
                                            </div>

                                            <div className="max-h-[520px] overflow-y-auto">
                                                {trades.length === 0 ? (
                                                    <div className="p-8 text-center text-sm text-muted">No decisions yet. Click "Run agent" to start.</div>
                                                ) : (
                                                    trades.map((t, i) => (
                                                        <div key={t.id} className={`p-4 ${i !== trades.length - 1 ? "border-b border-line" : ""}`}>
                                                            <div className="flex items-start justify-between gap-3">
                                                                <span
                                                                    className="text-[10px] font-semibold uppercase px-2 py-1 rounded-full shrink-0"
                                                                    style={{
                                                                        background: t.action === "PASS" ? "var(--color-line)" : t.action === "BUY_YES" ? "#e9f7ee" : "#fdeeee",
                                                                        color: t.action === "PASS" ? "var(--color-muted)" : t.action === "BUY_YES" ? "#16A34A" : "#DC2626",
                                                                    }}
                                                                >
                                                                    {t.action}
                                                                </span>
                                                                <span className="font-mono text-[10px] text-muted shrink-0">{new Date(t.timestamp).toLocaleString()}</span>
                                                            </div>
                                                            <p className="text-sm text-ink mt-2 leading-relaxed">{t.reasoning_summary}</p>
                                                            <div className="flex items-center gap-3 mt-2 text-[11px] text-muted font-mono">
                                                                <span>edge {(t.edge * 100).toFixed(1)}pts</span>
                                                                {t.usdc_amount > 0 && <span>{(t.usdc_amount / 1e6).toFixed(2)} USDC</span>}
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {/* PNL TAB */}
                                {activeTab === "pnl" && (
                                    <motion.div
                                        key="pnl-tab"
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 8 }}
                                        transition={{ duration: 0.2 }}
                                        className="rounded-2xl border border-line bg-surface p-8"
                                    >
                                        <div className="grid grid-cols-3 gap-4 mb-8">
                                            <div className="rounded-xl bg-bg border border-line p-4">
                                                <p className="text-[10px] uppercase tracking-widest text-muted">Trades executed</p>
                                                <p className="font-mono text-2xl font-bold text-ink mt-1">
                                                    {trades.filter(t => t.action !== "PASS").length}
                                                </p>
                                            </div>
                                            <div className="rounded-xl bg-bg border border-line p-4">
                                                <p className="text-[10px] uppercase tracking-widest text-muted">Avg edge (executed)</p>
                                                <p className="font-mono text-2xl font-bold text-ink mt-1">
                                                    {trades.filter(t => t.action !== "PASS").length > 0
                                                        ? (trades.filter(t => t.action !== "PASS").reduce((a, t) => a + Math.abs(t.edge), 0) / trades.filter(t => t.action !== "PASS").length * 100).toFixed(1)
                                                        : "0.0"}%
                                                </p>
                                            </div>
                                            <div className="rounded-xl bg-bg border border-line p-4">
                                                <p className="text-[10px] uppercase tracking-widest text-muted">USDC deployed</p>
                                                <p className="font-mono text-2xl font-bold text-ink mt-1">
                                                    {(trades.reduce((a, t) => a + (t.usdc_amount || 0), 0) / 1e6).toFixed(2)}
                                                </p>
                                            </div>
                                        </div>
                                        <p className="text-sm text-muted text-center">
                                            Realized P&L tracking requires market resolution - coming once markets close.
                                        </p>
                                    </motion.div>
                                )}

                                {/* TRANSACTIONS TAB */}
                                {activeTab === "transactions" && (
                                    <motion.div
                                        key="tx-tab"
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 8 }}
                                        transition={{ duration: 0.2 }}
                                        className="rounded-2xl border border-line bg-surface overflow-hidden"
                                    >
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-line text-left">
                                                    <th className="p-4 text-[10px] uppercase tracking-widest text-muted font-semibold">Time</th>
                                                    <th className="p-4 text-[10px] uppercase tracking-widest text-muted font-semibold">Action</th>
                                                    <th className="p-4 text-[10px] uppercase tracking-widest text-muted font-semibold">Amount</th>
                                                    <th className="p-4 text-[10px] uppercase tracking-widest text-muted font-semibold">Edge</th>
                                                    <th className="p-4 text-[10px] uppercase tracking-widest text-muted font-semibold">Market</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {trades.filter(t => t.action !== "PASS").length === 0 ? (
                                                    <tr><td colSpan={5} className="p-8 text-center text-muted">No executed trades yet.</td></tr>
                                                ) : (
                                                    trades.filter(t => t.action !== "PASS").map((t) => (
                                                        <tr key={t.id} className="border-b border-line last:border-0">
                                                            <td className="p-4 font-mono text-xs text-muted">{new Date(t.timestamp).toLocaleString()}</td>
                                                            <td className="p-4">
                                                                <span
                                                                    className="text-[10px] font-semibold uppercase px-2 py-1 rounded-full"
                                                                    style={{
                                                                        background: t.action === "BUY_YES" ? "#e9f7ee" : "#fdeeee",
                                                                        color: t.action === "BUY_YES" ? "#16A34A" : "#DC2626",
                                                                    }}
                                                                >
                                                                    {t.action}
                                                                </span>
                                                            </td>
                                                            <td className="p-4 font-mono text-xs text-ink">{(t.usdc_amount / 1e6).toFixed(2)} USDC</td>
                                                            <td className="p-4 font-mono text-xs text-muted">{(t.edge * 100).toFixed(1)}pts</td>
                                                            <td className="p-4 font-mono text-xs text-muted">{t.market_address?.slice(0, 8)}...</td>
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