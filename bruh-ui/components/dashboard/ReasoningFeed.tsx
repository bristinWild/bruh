"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AgentAvatar } from "@/app/AgentAvatar";
import { getAgentTheme } from "@/src/lib/agentTheme";
import type {
    Trade,
    TradeAction,
} from "@/components/dashboard/dashboard.types";

interface ReasoningFeedProps {
    trades: Trade[];
    agentName: string;
    agentSeed: string;
    capability?: string;
    capabilityAccent?: string;
    isRunning?: boolean;
}

function formatUSDC(value?: number) {
    if (!value) return "0.00";
    return (value / 1_000_000).toFixed(2);
}

function formatProbability(value?: number) {
    if (value === undefined || value === null) return null;

    const percentage = value <= 1 ? value * 100 : value;
    return `${percentage.toFixed(0)}%`;
}

function formatEdge(value?: number) {
    if (value === undefined || value === null) return "0.0pts";

    const points = Math.abs(value) <= 1 ? value * 100 : value;
    return `${Math.abs(points).toFixed(1)}pts`;
}

function formatTime(timestamp: string) {
    return new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    }).format(new Date(timestamp));
}

function getSide(action: TradeAction) {
    if (action === "BUY_YES") return "YES";
    if (action === "BUY_NO") return "NO";
    return null;
}

export default function ReasoningFeed({
    trades,
    agentName,
    agentSeed,
    capability,
    capabilityAccent = "#38BDF8",
    isRunning = false,
}: ReasoningFeedProps) {
    const theme = getAgentTheme(agentSeed);
    return (
        <section
            className="min-w-0 overflow-hidden rounded-2xl border bg-surface"
            style={{
                borderColor: theme.border,
                boxShadow: `0 24px 65px -35px ${theme.shadow}, 0 0 0 1px rgba(255,255,255,0.65) inset`,
            }}
        >
            <header
                className="relative overflow-hidden border-b px-5 py-4"
                style={{
                    borderColor: theme.border,
                    background: `linear-gradient(
            135deg,
            ${theme.soft},
            rgba(255,255,255,0.92) 58%,
            rgba(255,255,255,0.98)
        )`,
                }}
            >
                <div
                    className="absolute left-0 top-0 h-px w-full"
                    style={{
                        background: `linear-gradient(
                90deg,
                transparent,
                ${theme.primary},
                ${theme.secondary},
                transparent
            )`,
                    }}
                />

                <div className="flex items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2
                                className="text-base font-bold text-ink"
                                style={{ fontFamily: "var(--font-display)" }}
                            >
                                Reasoning feed
                            </h2>

                            {isRunning && (
                                <span className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                                    <span className="relative flex h-1.5 w-1.5">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                    </span>
                                    Live
                                </span>
                            )}
                        </div>

                        <p className="mt-1 text-xs text-muted">
                            {trades.length} autonomous decision
                            {trades.length === 1 ? "" : "s"} logged
                        </p>
                    </div>

                    <div
                        className="rounded-lg border px-3 py-1.5 font-mono text-[10px] font-semibold"
                        style={{
                            color: theme.text,
                            borderColor: theme.border,
                            background: theme.soft,
                        }}
                    >
                        ARC TESTNET
                    </div>
                </div>
            </header>

            <div className="max-h-[560px] overflow-y-auto px-4">
                {trades.length === 0 ? (
                    <div className="flex min-h-64 flex-col items-center justify-center text-center">
                        <div
                            className="mb-4 rounded-2xl border-4 border-white shadow-lg"
                            style={{
                                boxShadow:
                                    "0 14px 35px -14px rgba(56,189,248,0.65)",
                            }}
                        >
                            <AgentAvatar seed={agentSeed} size={54} />
                        </div>

                        <p className="text-sm font-semibold text-ink">
                            No reasoning recorded yet
                        </p>

                        <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted">
                            Run {agentName} to analyse markets and publish its next
                            autonomous decision.
                        </p>
                    </div>
                ) : (
                    <AnimatePresence initial={false} mode="popLayout">
                        <motion.div className="flex flex-col" layout>
                            {trades.map((trade, index) => {
                                const side = getSide(trade.action);
                                const probability = formatProbability(
                                    trade.probability,
                                );

                                const marketProbability = formatProbability(
                                    trade.market_probability,
                                );

                                const transactionHash =
                                    trade.tx_hash ?? trade.transaction_hash;

                                const marketName =
                                    trade.market_question ??
                                    trade.market ??
                                    "Prediction market";

                                const isPass = trade.action === "PASS";

                                return (
                                    <motion.article
                                        key={trade.id}
                                        layout
                                        initial={{ opacity: 0, y: -24, scale: 0.985 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{
                                            duration: 0.4,
                                            ease: [0.22, 1, 0.36, 1],
                                        }}
                                        className={`relative flex flex-col gap-3 px-1 py-5 ${index !== trades.length - 1
                                            ? "border-b border-line"
                                            : ""
                                            }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <motion.div
                                                    whileHover={{ scale: 1.05, rotate: -2 }}
                                                    className="shrink-0 rounded-xl border-2 border-white shadow-md"
                                                    style={{
                                                        boxShadow:
                                                            "0 8px 20px -8px rgba(56,189,248,0.55)",
                                                    }}
                                                >
                                                    <AgentAvatar
                                                        seed={agentSeed}
                                                        size={36}
                                                    />
                                                </motion.div>

                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="truncate text-[13px] font-semibold leading-tight text-ink">
                                                            {agentName}
                                                        </p>

                                                        {capability && (
                                                            <span
                                                                className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                                                                style={{
                                                                    color: theme.text,
                                                                    background: theme.soft,
                                                                    border: `1px solid ${theme.border}`,
                                                                }}
                                                            >
                                                                {capability}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <p className="mt-0.5 truncate text-[11px] leading-tight text-muted">
                                                        {marketName}
                                                    </p>
                                                </div>
                                            </div>

                                            <time className="shrink-0 pt-0.5 font-mono text-[10px] text-muted">
                                                {formatTime(trade.timestamp)}
                                            </time>
                                        </div>

                                        {trade.reasoning_summary && (
                                            <div
                                                className="relative overflow-hidden rounded-xl border px-3.5 py-3"
                                                style={{
                                                    borderColor: theme.border,
                                                    background: `linear-gradient(
            135deg,
            ${theme.soft},
            rgba(255,255,255,0.9)
        )`,
                                                }}
                                            >
                                                <div
                                                    className="absolute bottom-0 left-0 top-0 w-0.5"
                                                    style={{
                                                        background: `linear-gradient(
                180deg,
                ${theme.primary},
                ${theme.secondary}
            )`,
                                                    }}
                                                />

                                                <p className="text-[12px] leading-relaxed text-ink">
                                                    {trade.reasoning_summary}
                                                </p>
                                            </div>
                                        )}

                                        <div className="flex flex-wrap items-center gap-2">
                                            {trade.research_cost !== undefined && (
                                                <>
                                                    <span
                                                        className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold"
                                                        style={{
                                                            color: theme.text,
                                                            background: theme.soft,
                                                            borderColor: theme.border,
                                                            boxShadow: `0 5px 16px -10px ${theme.shadow}`,
                                                        }}
                                                    >

                                                        {probability
                                                            ? ` P(YES) ${probability}`
                                                            : " Probability assessed"}

                                                        {marketProbability
                                                            ? ` · market ${marketProbability}`
                                                            : ""}

                                                        {` · edge ${formatEdge(trade.edge)}`}
                                                    </span>

                                                    <span className="text-[10px] text-muted">
                                                        →
                                                    </span>
                                                </>
                                            )}

                                            <span
                                                className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold"
                                                style={{
                                                    color: "#0284C7",
                                                    background:
                                                        "linear-gradient(135deg, #ECFEFF, #F0F9FF)",
                                                    borderColor: "#67E8F9",
                                                    boxShadow:
                                                        "0 4px 14px -8px rgba(14,165,233,0.6)",
                                                }}
                                            >

                                                {probability
                                                    ? ` P(YES) ${probability}`
                                                    : " Probability assessed"}
                                                {marketProbability
                                                    ? ` · market ${marketProbability}`
                                                    : ""}
                                                {` · edge ${formatEdge(trade.edge)}`}
                                            </span>

                                            <span className="text-[10px] text-muted">
                                                →
                                            </span>

                                            <span
                                                className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold"
                                                style={
                                                    isPass
                                                        ? {
                                                            color: "#6B7280",
                                                            background:
                                                                "linear-gradient(135deg, #F9FAFB, #F3F4F6)",
                                                            borderColor: "#D1D5DB",
                                                        }
                                                        : side === "YES"
                                                            ? {
                                                                color: "#15803D",
                                                                background:
                                                                    "linear-gradient(135deg, #ECFDF5, #DCFCE7)",
                                                                borderColor:
                                                                    "#86EFAC",
                                                            }
                                                            : {
                                                                color: "#DC2626",
                                                                background:
                                                                    "linear-gradient(135deg, #FEF2F2, #FEE2E2)",
                                                                borderColor:
                                                                    "#FCA5A5",
                                                            }
                                                }
                                            >
                                                {isPass ? (
                                                    <>◌ PASS · no trade</>
                                                ) : (
                                                    <>
                                                        ⚡ BUY{" "}
                                                        {formatUSDC(
                                                            trade.usdc_amount,
                                                        )}{" "}
                                                        USDC {side}
                                                    </>
                                                )}
                                            </span>
                                        </div>

                                        <div className="flex min-h-4 items-center justify-between gap-3">
                                            <span className="truncate font-mono text-[10px] text-muted">
                                                {transactionHash
                                                    ? `${transactionHash.slice(0, 8)}...${transactionHash.slice(-6)}`
                                                    : isPass
                                                        ? "No onchain transaction"
                                                        : "Transaction pending"}

                                                {trade.execution_time_ms !== undefined &&
                                                    ` · ${(trade.execution_time_ms / 1000).toFixed(1)}s`}
                                            </span>

                                            {transactionHash && (
                                                <a
                                                    href={`https://testnet.arcscan.app/tx/${transactionHash}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="shrink-0 rounded-md px-2 py-1 font-mono text-[10px] font-semibold transition-all hover:bg-cyan-50"
                                                    style={{ color: "#0EA5E9" }}
                                                >
                                                    arcscan ↗
                                                </a>
                                            )}
                                        </div>
                                    </motion.article>
                                );
                            })}
                        </motion.div>
                    </AnimatePresence>
                )}
            </div>
        </section>
    );
}