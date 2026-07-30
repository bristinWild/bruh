"use client";

import { motion, useReducedMotion, useInView } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { AgentCover } from "@/components/AgentCover";
import { AgentAvatar } from "@/app/AgentAvatar";
import { getAgentTheme } from "@/src/lib/agentTheme";
import Link from "next/link";

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


type AgentTheme = ReturnType<typeof getAgentTheme>;

function CardStat({
    label,
    value,
    theme,
}: {
    label: string;
    value: string;
    theme: AgentTheme;
}) {
    return (
        <div
            className="rounded-xl border px-3 py-3 text-center"
            style={{
                borderColor: theme.border,
                background: theme.soft,
            }}
        >
            <p className="font-mono text-xl font-bold text-ink">
                {value}
            </p>

            <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.12em] text-muted">
                {label}
            </p>
        </div>
    );
}



function AgentCard({
    agent,
    index,
}: {
    agent: Agent;
    index: number;
}) {
    const reduce = useReducedMotion();
    const ref = useRef<HTMLDivElement | null>(null);
    const inView = useInView(ref, {
        once: true,
        margin: "-60px",
    });

    const theme = getAgentTheme(agent.name);

    const artwork =
        agent.name === "Newshound"
            ? "/agents/newshound-card-art.png"
            : "/agents/actuary-card-art.png";

    return (
        <motion.article
            ref={ref}
            initial={
                reduce
                    ? { opacity: 1 }
                    : {
                        opacity: 0,
                        y: 30,
                        rotateX: 4,
                    }
            }
            animate={
                inView
                    ? {
                        opacity: 1,
                        y: 0,
                        rotateX: 0,
                    }
                    : {}
            }
            transition={{
                duration: 0.55,
                ease: [0.22, 1, 0.36, 1],
                delay: index * 0.1,
            }}
            whileHover={
                reduce
                    ? {}
                    : {
                        y: -8,
                        rotateX: 1.5,
                        rotateY: index % 2 === 0 ? -1.5 : 1.5,
                    }
            }
            className="relative"
            style={{
                perspective: 1000,
            }}
        >
            <div
                className="relative overflow-hidden rounded-[26px] p-[6px]"
                style={{
                    background: `
                        linear-gradient(
                            145deg,
                            ${theme.primary},
                            ${theme.secondary}
                        )
                    `,
                    boxShadow: `
                        0 28px 60px -32px ${theme.shadow},
                        inset 0 0 0 1px rgba(255,255,255,0.45)
                    `,
                }}
            >
                {/* Decorative outer frame */}
                <div
                    className="pointer-events-none absolute inset-[6px] rounded-[21px] border"
                    style={{
                        borderColor: "rgba(255,255,255,0.5)",
                    }}
                />

                <div className="relative overflow-hidden rounded-[20px] bg-[#fbf8f2]">
                    {/* Top header */}
                    <div className="relative flex min-h-[96px] items-center justify-between px-5 pb-3 pt-4">
                        <div
                            className="absolute left-0 top-0 rounded-br-2xl px-5 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white"
                            style={{
                                background: `linear-gradient(
                                    135deg,
                                    ${theme.primary},
                                    ${theme.secondary}
                                )`,
                            }}
                        >
                            Agent
                        </div>

                        <div className="flex items-center gap-3 pt-5">

                            <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden">
                                <motion.div
                                    className="absolute h-12 w-12 rounded-full blur-[7px]"
                                    style={{
                                        background:
                                            "conic-gradient(from 0deg, #22D3EE, #3B82F6, #A855F7, #EC4899, #22D3EE)",
                                    }}
                                    animate={{
                                        rotate: 360,
                                        scale: [0.92, 1.08, 0.92],
                                    }}
                                    transition={{
                                        rotate: {
                                            duration: 5,
                                            repeat: Infinity,
                                            ease: "linear",
                                        },
                                        scale: {
                                            duration: 2.4,
                                            repeat: Infinity,
                                            ease: "easeInOut",
                                        },
                                    }}
                                />

                                <motion.div
                                    className="absolute h-10 w-10 rounded-full"
                                    style={{
                                        background:
                                            "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.95), rgba(125,211,252,0.55) 30%, rgba(99,102,241,0.45) 58%, rgba(236,72,153,0.28) 78%, transparent 100%)",
                                        boxShadow:
                                            "inset 0 0 12px rgba(255,255,255,0.75), 0 0 18px rgba(56,189,248,0.5)",
                                    }}
                                    animate={{
                                        scale: [0.94, 1.04, 0.97, 1.06, 0.94],
                                        borderRadius: [
                                            "48% 52% 55% 45% / 46% 48% 52% 54%",
                                            "55% 45% 48% 52% / 52% 45% 55% 48%",
                                            "46% 54% 45% 55% / 55% 52% 48% 45%",
                                            "52% 48% 54% 46% / 45% 55% 46% 54%",
                                            "48% 52% 55% 45% / 46% 48% 52% 54%",
                                        ],
                                    }}
                                    transition={{
                                        duration: 3.2,
                                        repeat: Infinity,
                                        ease: "easeInOut",
                                    }}
                                />

                                <motion.div
                                    className="absolute h-7 w-7 rounded-full blur-[4px]"
                                    style={{
                                        background:
                                            "linear-gradient(135deg, rgba(34,211,238,0.75), rgba(99,102,241,0.7), rgba(236,72,153,0.6))",
                                    }}
                                    animate={{
                                        x: [-2, 3, -1, 2, -2],
                                        y: [1, -2, 2, -1, 1],
                                        scale: [0.9, 1.12, 0.96, 1.08, 0.9],
                                    }}
                                    transition={{
                                        duration: 2.8,
                                        repeat: Infinity,
                                        ease: "easeInOut",
                                    }}
                                />

                                <motion.div
                                    className="absolute h-3 w-3 rounded-full bg-white/80 blur-[1px]"
                                    animate={{
                                        x: [-6, 5, -3, 4, -6],
                                        y: [-5, 2, 5, -3, -5],
                                        opacity: [0.45, 0.9, 0.55, 0.85, 0.45],
                                    }}
                                    transition={{
                                        duration: 3.5,
                                        repeat: Infinity,
                                        ease: "easeInOut",
                                    }}
                                />

                                <motion.div
                                    className="absolute h-[46px] w-[46px] rounded-full border border-white/40"
                                    animate={{
                                        scale: [0.85, 1.15, 0.85],
                                        opacity: [0.2, 0.55, 0.2],
                                    }}
                                    transition={{
                                        duration: 2.6,
                                        repeat: Infinity,
                                        ease: "easeInOut",
                                    }}
                                />
                            </div>

                            <div>
                                <h3
                                    className="text-2xl font-bold tracking-tight text-ink"
                                    style={{
                                        fontFamily: "var(--font-display)",
                                    }}
                                >
                                    {agent.name}
                                </h3>

                                <p
                                    className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em]"
                                    style={{
                                        color: theme.text,
                                    }}
                                >
                                    Type: {agent.strategy}
                                </p>
                            </div>
                        </div>

                        <div className="pt-3 text-right">
                            <div className="flex items-baseline justify-end gap-1">
                                <span className="text-xs font-bold uppercase text-ink">
                                    HP
                                </span>

                                <span className="font-mono text-3xl font-bold text-ink">
                                    {agent.calibration}
                                </span>
                            </div>

                            <span
                                className="mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em]"
                                style={{
                                    color: theme.text,
                                    borderColor: theme.border,
                                    background: theme.soft,
                                }}
                            >
                                <span
                                    className="h-1.5 w-1.5 rounded-full"
                                    style={{
                                        background: theme.primary,
                                    }}
                                />

                                {agent.status}
                            </span>
                        </div>
                    </div>

                    {/* Artwork */}
                    <div className="px-4">
                        <div
                            className="relative aspect-[16/9] overflow-hidden rounded-[14px] border-[3px]"
                            style={{
                                borderColor: theme.primary,
                                background: `linear-gradient(
                                    135deg,
                                    ${theme.primary},
                                    ${theme.secondary}
                                )`,
                            }}
                        >
                            <img
                                src={artwork}
                                alt={`${agent.name} artwork`}
                                className="h-full w-full object-cover"
                            />

                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/10" />

                            <motion.div
                                className="absolute inset-y-0 w-20 skew-x-[-18deg] bg-white/15 blur-xl"
                                animate={{
                                    x: [-160, 520],
                                }}
                                transition={{
                                    duration: 4,
                                    repeat: Infinity,
                                    ease: "linear",
                                    delay: index * 0.7,
                                }}
                            />
                        </div>
                    </div>

                    <div className="space-y-3 px-4 pb-4 pt-4">
                        {/* Description and PnL */}
                        <div className="flex items-center justify-between gap-4 rounded-xl border border-black/10 bg-white/45 px-4 py-3">
                            <p className="text-sm font-medium leading-relaxed text-ink">
                                {agent.description}
                            </p>

                            <span
                                className={`shrink-0 font-mono text-lg font-bold ${agent.pnlPositive
                                    ? "text-yes"
                                    : "text-no"
                                    }`}
                            >
                                {agent.pnl}
                            </span>
                        </div>


                        {/* Collector footer */}
                        <div className="flex items-center justify-between pt-1 font-mono text-[9px] text-muted">
                            <span>
                                {String(index + 1).padStart(3, "0")}/151
                            </span>

                            <span className="font-semibold uppercase tracking-[0.16em]">
                                Bruh Agents
                            </span>
                        </div>
                    </div>

                    {/* Texture */}
                    <div
                        className="pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-multiply"
                        style={{
                            backgroundImage:
                                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.8'/%3E%3C/svg%3E\")",
                        }}
                    />
                </div>
            </div>
        </motion.article>
    );
}

export default function AgentsSection() {
    const reduce = useReducedMotion();

    return (
        <section
            id="agents"
            className="relative overflow-hidden py-24"
        >
            {/* Background atmosphere */}
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-[-180px] top-28 h-[440px] w-[440px] rounded-full bg-violet-300/10 blur-[150px]" />

                <div className="absolute right-[-180px] top-36 h-[440px] w-[440px] rounded-full bg-blue-300/10 blur-[150px]" />

                <div
                    className="absolute inset-0 opacity-[0.025]"
                    style={{
                        backgroundImage: `
                            linear-gradient(
                                to right,
                                rgba(99, 102, 241, 0.18) 1px,
                                transparent 1px
                            ),
                            linear-gradient(
                                to bottom,
                                rgba(99, 102, 241, 0.18) 1px,
                                transparent 1px
                            )
                        `,
                        backgroundSize: "48px 48px",
                        maskImage:
                            "linear-gradient(to bottom, transparent, black 22%, black 78%, transparent)",
                        WebkitMaskImage:
                            "linear-gradient(to bottom, transparent, black 22%, black 78%, transparent)",
                    }}
                />
            </div>

            {/* Header */}
            <motion.div
                initial={
                    reduce
                        ? { opacity: 1 }
                        : { opacity: 0, y: 16 }
                }
                whileInView={{
                    opacity: 1,
                    y: 0,
                }}
                viewport={{ once: true }}
                transition={{ duration: 0.45 }}
                className="relative mx-auto mb-14 flex max-w-2xl flex-col items-center px-6 text-center"
            >
                <div className="inline-flex rounded-full bg-gradient-to-r from-violet-500 to-blue-500 p-px">
                    <div className="flex items-center gap-2 rounded-full bg-[#fbf8f2] px-4 py-2">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-500 opacity-40" />

                            <span className="relative h-2 w-2 rounded-full bg-violet-500" />
                        </span>

                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
                            Active agents
                        </span>
                    </div>
                </div>

                <h2
                    className="
                        mt-6
                        text-[42px]
                        font-black
                        uppercase
                        leading-[0.92]
                        tracking-[-0.055em]
                        text-slate-950
                        sm:text-[52px]
                    "
                    style={{
                        fontFamily: "var(--font-display)",
                    }}
                >
                    Meet the{" "}
                    <span className="bg-gradient-to-r from-violet-600 to-blue-500 bg-clip-text text-transparent">
                        traders
                    </span>
                </h2>

                <p
                    className="
                        mt-5
                        max-w-xl
                        text-[16px]
                        font-medium
                        leading-[1.7]
                        tracking-[-0.012em]
                        text-muted
                    "
                    style={{
                        fontFamily: "var(--font-sans)",
                    }}
                >
                    Two autonomous agents. Different strategies.
                    The same market, with their own USDC and reputation
                    on the line.
                </p>
            </motion.div>

            {/* Agent card stage */}
            <div className="relative mx-auto max-w-5xl px-6">
                <div
                    className="
                        relative
                        overflow-hidden
                        rounded-[32px]
                        border
                        px-5
                        py-8
                        sm:px-8
                        sm:py-10
                    "
                    style={{
                        borderColor: "rgba(99, 102, 241, 0.14)",
                        background: `
                            radial-gradient(
                                circle at 18% 20%,
                                rgba(139, 92, 246, 0.08),
                                transparent 34%
                            ),
                            radial-gradient(
                                circle at 82% 20%,
                                rgba(59, 130, 246, 0.08),
                                transparent 34%
                            ),
                            linear-gradient(
                                145deg,
                                rgba(255, 253, 248, 0.88),
                                rgba(248, 243, 235, 0.72)
                            )
                        `,
                        boxShadow:
                            "0 28px 70px -46px rgba(79, 70, 229, 0.3)",
                    }}
                >
                    {/* Paper grain */}
                    <div
                        className="pointer-events-none absolute inset-0 opacity-[0.025] mix-blend-multiply"
                        style={{
                            backgroundImage:
                                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.9'/%3E%3C/svg%3E\")",
                        }}
                    />

                    {/* Top metadata */}
                    <div className="relative mb-7 flex items-center justify-between">
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                                Bruh agent roster
                            </p>

                            <p className="mt-1 text-[12px] font-semibold text-slate-600">
                                Live autonomous strategies
                            </p>
                        </div>

                        <div className="flex items-center gap-2 rounded-full border border-violet-200 bg-white/65 px-3 py-1.5 backdrop-blur-sm">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />

                            <span className="font-mono text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                                {AGENTS.length} online
                            </span>
                        </div>
                    </div>

                    {/* Cards */}
                    <div className="relative grid gap-7 sm:grid-cols-2">
                        {AGENTS.map((agent, index) => (
                            <motion.div
                                key={agent.id}
                                initial={
                                    reduce
                                        ? { opacity: 1 }
                                        : {
                                            opacity: 0,
                                            y: 20,
                                            scale: 0.98,
                                        }
                                }
                                whileInView={{
                                    opacity: 1,
                                    y: 0,
                                    scale: 1,
                                }}
                                viewport={{ once: true }}
                                transition={{
                                    duration: 0.5,
                                    delay: index * 0.1,
                                    ease: [0.22, 1, 0.36, 1],
                                }}
                            >
                                <AgentCard
                                    agent={agent}
                                    index={index}
                                />
                            </motion.div>
                        ))}
                    </div>

                    {/* Bottom metadata */}
                    <div className="relative mt-8 flex flex-col gap-3 border-t border-black/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-[8px] font-black uppercase tracking-[0.18em] text-slate-400">
                                Settlement layer
                            </p>

                            <p className="mt-1 text-[10px] font-semibold text-slate-500">
                                Arc Testnet · USDC denominated
                            </p>
                        </div>

                        <p className="font-mono text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">
                            Autonomous by design
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}