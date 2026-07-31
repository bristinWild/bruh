"use client";

import { useEffect, useMemo, useState } from "react";
import {
    AnimatePresence,
    motion,
    useReducedMotion,
    useScroll,
    useTransform,
} from "framer-motion";
import {
    Activity,
    Check,
    CircleDollarSign,
    ExternalLink,
    Eye,
    LineChart,
    ShieldCheck,
    ShoppingCart,
    Sparkles,
} from "lucide-react";
import { getAgentTheme } from "@/src/lib/agentTheme";

type Agent = {
    id: string;
    name: string;
    type: string;
    market: string;
    hp: number;
    cardNumber: string;
    transaction: string;
    steps: {
        title: string;
        description: string;
        time: string;
        icon: "research" | "estimate" | "trade" | "secure";
        status: "complete" | "running";
    }[];
};

const AGENTS: Agent[] = [
    {
        id: "newshound",
        name: "Newshound",
        type: "News Momentum",
        market: "ETH above $4k by Friday?",
        hp: 151,
        cardNumber: "001/151",
        transaction: "0x3f8a...c21e",
        steps: [
            {
                title: "Bought research",
                description: "3 sources · 0.004 USDC via x402",
                time: "12:41:22",
                icon: "research",
                status: "complete",
            },
            {
                title: "Formed estimate",
                description: "P(YES) 0.64 vs market 0.51 · edge +13",
                time: "12:41:23",
                icon: "estimate",
                status: "complete",
            },
            {
                title: "Executed trade",
                description: "BUY 4.20 USDC YES · filled in 0.7s",
                time: "12:41:24",
                icon: "trade",
                status: "complete",
            },
            // {
            //     title: "Position secured",
            //     description: "Escrowed on Arc · capital at risk",
            //     time: "12:41:25",
            //     icon: "secure",
            //     status: "running",
            // },
        ],
    },
    {
        id: "actuary",
        name: "Actuary",
        type: "Probability Edge",
        market: "ETH above $4k by Friday?",
        hp: 142,
        cardNumber: "002/151",
        transaction: "0x91bd...a74f",
        steps: [
            {
                title: "Bought data models",
                description: "7 models · 0.006 USDC via x402",
                time: "12:41:22",
                icon: "research",
                status: "complete",
            },
            {
                title: "Simulated outcomes",
                description: "P(YES) 0.67 vs market 0.51 · edge +16",
                time: "12:41:23",
                icon: "estimate",
                status: "complete",
            },
            {
                title: "Executed trade",
                description: "BUY 5.10 USDC YES · filled in 0.6s",
                time: "12:41:24",
                icon: "trade",
                status: "complete",
            },
            // {
            //     title: "Position secured",
            //     description: "Escrowed on Arc · capital at risk",
            //     time: "12:41:25",
            //     icon: "secure",
            //     status: "running",
            // },
        ],
    },
];

const STEP_ICONS = {
    research: CircleDollarSign,
    estimate: LineChart,
    trade: ShoppingCart,
    secure: ShieldCheck,
};

export default function LiveDecisionCard() {
    const reduceMotion = useReducedMotion();
    const [activeIndex, setActiveIndex] = useState(0);
    const [paused, setPaused] = useState(false);

    const agent = AGENTS[activeIndex];

    const theme = useMemo(
        () => getAgentTheme(agent.name),
        [agent.name],
    );

    useEffect(() => {
        if (paused || reduceMotion) return;

        const interval = window.setInterval(() => {
            setActiveIndex((current) => (current + 1) % AGENTS.length);
        }, 2500);

        return () => window.clearInterval(interval);
    }, [paused, reduceMotion]);

    const showNextAgent = () => {
        setActiveIndex((current) => (current + 1) % AGENTS.length);
    };

    return (
        <div
            className="relative mx-auto w-full max-w-[460px] perspective-[1800px]"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
        >
            {/* Ambient card glow */}
            <div
                className="pointer-events-none absolute inset-8 rounded-[40px] blur-[70px]"
                style={{
                    background: `linear-gradient(
                        135deg,
                        ${theme.primary},
                        ${theme.secondary}
                    )`,
                    opacity: 0.18,
                }}
            />

            <AnimatePresence mode="wait">
                <motion.article
                    key={agent.id}
                    initial={
                        reduceMotion
                            ? { opacity: 0 }
                            : {
                                opacity: 0,
                                rotateY: -88,
                                scale: 0.96,
                            }
                    }
                    animate={{
                        opacity: 1,
                        rotateY: 0,
                        scale: 1,
                    }}
                    exit={
                        reduceMotion
                            ? { opacity: 0 }
                            : {
                                opacity: 0,
                                rotateY: 88,
                                scale: 0.96,
                            }
                    }
                    transition={{
                        duration: reduceMotion ? 0.2 : 0.72,
                        ease: [0.22, 1, 0.36, 1],
                    }}
                    className="relative preserve-3d"
                >
                    <div
                        className="relative overflow-hidden rounded-[26px] p-[3px]"
                        style={{
                            background: `linear-gradient(
                135deg,
                ${theme.primary},
                ${theme.secondary}
            )`,
                            boxShadow: `
                0 26px 60px -34px ${theme.shadow},
                0 14px 34px rgba(15,23,42,0.10)
            `,
                        }}
                    >
                        <div
                            className="relative overflow-hidden rounded-[23px] border px-5 pb-4 pt-4"
                            style={{
                                borderColor: theme.border,
                                background: `
                    radial-gradient(
                        circle at 88% 12%,
                        ${theme.soft},
                        transparent 34%
                    ),
                    linear-gradient(
                        145deg,
                        #fffdf8 0%,
                        #fbf8f2 68%,
                        ${theme.soft} 100%
                    )
                `,
                            }}
                        >
                            {/* texture */}
                            <div
                                className="pointer-events-none absolute inset-0 opacity-[0.028] mix-blend-multiply"
                                style={{
                                    backgroundImage:
                                        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.9'/%3E%3C/svg%3E\")",
                                }}
                            />

                            {/* agent tab */}
                            <div
                                className="absolute left-0 top-0 flex h-9 items-center rounded-br-[18px] px-5"
                                style={{
                                    background: `linear-gradient(
                        135deg,
                        ${theme.primary},
                        ${theme.secondary}
                    )`,
                                }}
                            >
                                <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white">
                                    Agent
                                </span>

                                <Sparkles className="ml-2 h-3 w-3 text-white" />
                            </div>

                            {/* compact header */}
                            <header className="relative mt-8 flex items-center gap-4 rounded-[18px] border border-black/10 bg-white/60 px-4 py-4 backdrop-blur-sm">
                                <AnimatedAgentOrb
                                    theme={theme}
                                    reduceMotion={Boolean(reduceMotion)}
                                />

                                <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <h3
                                                className="truncate text-[30px] font-black leading-none tracking-[-0.055em] text-slate-950"
                                                style={{
                                                    fontFamily: "var(--font-display)",
                                                }}
                                            >
                                                {agent.name}
                                            </h3>

                                            <p className="mt-2 text-[9px] font-black uppercase tracking-[0.16em]">
                                                <span className="text-slate-500">Type:</span>{" "}
                                                <span style={{ color: theme.text }}>
                                                    {agent.type}
                                                </span>
                                            </p>
                                        </div>

                                        <div className="flex shrink-0 items-baseline gap-1">
                                            <span className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
                                                HP
                                            </span>

                                            <span
                                                className="font-mono text-[30px] font-black leading-none tracking-[-0.06em]"
                                                style={{ color: theme.text }}
                                            >
                                                {agent.hp}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mt-3 flex items-center justify-between gap-3">
                                        <p className="truncate text-[12px] font-medium text-slate-600">
                                            Market: “{agent.market}”
                                        </p>

                                        <div
                                            className="flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5"
                                            style={{
                                                borderColor: theme.border,
                                                color: theme.text,
                                                background: theme.soft,
                                            }}
                                        >
                                            <span
                                                className="h-1.5 w-1.5 rounded-full"
                                                style={{ background: theme.primary }}
                                            />

                                            <span className="text-[8px] font-black uppercase tracking-[0.18em]">
                                                Live
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </header>

                            {/* compact steps */}
                            <div className="relative mt-3 space-y-2">
                                {agent.steps.slice(0, 3).map((step, index) => {
                                    const Icon = STEP_ICONS[step.icon];

                                    return (
                                        <motion.div
                                            key={`${agent.id}-${step.title}`}
                                            initial={
                                                reduceMotion
                                                    ? false
                                                    : {
                                                        opacity: 0,
                                                        y: 8,
                                                    }
                                            }
                                            animate={{
                                                opacity: 1,
                                                y: 0,
                                            }}
                                            transition={{
                                                delay: 0.1 + index * 0.08,
                                                duration: 0.35,
                                            }}
                                            className="grid grid-cols-[42px_28px_1fr_auto] items-center gap-2 rounded-[16px] border bg-white/65 px-3 py-3"
                                            style={{
                                                borderColor:
                                                    index === 0
                                                        ? theme.border
                                                        : "rgba(15,23,42,0.10)",
                                            }}
                                        >
                                            <div
                                                className="flex h-10 w-10 items-center justify-center rounded-[12px] border"
                                                style={{
                                                    borderColor: theme.border,
                                                    background:
                                                        index === 0
                                                            ? theme.soft
                                                            : "rgba(255,255,255,0.82)",
                                                    color: theme.text,
                                                }}
                                            >
                                                <Icon className="h-4.5 w-4.5" />
                                            </div>

                                            <span
                                                className="font-mono text-[12px] font-black"
                                                style={{ color: theme.primary }}
                                            >
                                                {String(index + 1).padStart(2, "0")}
                                            </span>

                                            <div className="min-w-0">
                                                <p className="truncate text-[13px] font-extrabold tracking-[-0.02em] text-slate-950">
                                                    {step.title}
                                                </p>

                                                <p className="mt-1 truncate text-[9px] font-medium text-slate-500">
                                                    {step.description}
                                                </p>
                                            </div>

                                            <div className="flex flex-col items-end gap-2">
                                                <span
                                                    className="font-mono text-[8px] font-semibold"
                                                    style={{ color: theme.text }}
                                                >
                                                    {step.time}
                                                </span>

                                                <span className="flex h-4 w-4 items-center justify-center rounded-full border border-emerald-500 text-emerald-600">
                                                    <Check className="h-2.5 w-2.5" />
                                                </span>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>

                            {/* compact footer */}
                            <footer className="relative mt-3 border-t border-black/10 pt-3">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="min-w-0">
                                        <p className="text-[7px] font-black uppercase tracking-[0.17em] text-slate-400">
                                            Transaction
                                        </p>

                                        <p className="mt-1 truncate font-mono text-[9px] font-semibold text-slate-600">
                                            {agent.transaction} · Arc Testnet
                                        </p>
                                    </div>

                                    <div className="text-center">
                                        <p className="text-[7px] font-black uppercase tracking-[0.17em] text-slate-400">
                                            Card No.
                                        </p>

                                        <p
                                            className="mt-1 font-mono text-[11px] font-black"
                                            style={{ color: theme.text }}
                                        >
                                            {agent.cardNumber}
                                        </p>
                                    </div>

                                    <a
                                        href="#"
                                        className="flex items-center gap-1 text-[9px] font-black"
                                        style={{ color: theme.text }}
                                    >
                                        Arcscan
                                        <ExternalLink className="h-3 w-3" />
                                    </a>
                                </div>

                                <div
                                    className="mt-3 flex items-center justify-between rounded-[13px] px-3 py-2"
                                    style={{
                                        background: `linear-gradient(
                            135deg,
                            ${theme.primary},
                            ${theme.secondary}
                        )`,
                                    }}
                                >
                                    <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white">
                                        Bruh Agents
                                    </span>

                                    <span className="rounded-full border border-white/30 px-3 py-1 text-[7px] font-black uppercase tracking-[0.15em] text-white">
                                        Settles in USDC
                                    </span>

                                    <span className="text-[9px] text-white">
                                        ★★★★☆
                                    </span>
                                </div>
                            </footer>
                        </div>
                    </div>
                </motion.article>
            </AnimatePresence>

            {/* Flip control */}
            <button
                type="button"
                onClick={showNextAgent}
                className="mx-auto mt-5 flex items-center gap-3 rounded-full border bg-white/70 px-4 py-2 backdrop-blur-sm transition-transform hover:scale-[1.02] active:scale-[0.98]"
                style={{
                    borderColor: theme.border,
                    color: theme.text,
                }}
                aria-label={`Show ${AGENTS[(activeIndex + 1) % AGENTS.length].name
                    }`}
            >
                <Activity className="h-3.5 w-3.5" />

                <span className="text-[9px] font-black uppercase tracking-[0.2em]">
                    Flipping live
                </span>

                <span className="font-mono text-[9px]">
                    {activeIndex + 1}/{AGENTS.length}
                </span>
            </button>
        </div>
    );
}

function AnimatedAgentOrb({
    theme,
    reduceMotion,
}: {
    theme: ReturnType<typeof getAgentTheme>;
    reduceMotion: boolean;
}) {
    return (
        <div className="relative flex h-[58px] w-[58px] shrink-0 items-center justify-center">
            <motion.div
                className="absolute inset-1 rounded-full blur-xl"
                style={{
                    background: theme.primary,
                    opacity: 0.25,
                }}
                animate={
                    reduceMotion
                        ? {}
                        : {
                            scale: [0.86, 1.08, 0.86],
                            opacity: [0.18, 0.35, 0.18],
                        }
                }
                transition={{
                    duration: 3.2,
                    repeat: Infinity,
                    ease: "easeInOut",
                }}
            />

            <motion.div
                className="relative h-[48px] w-[48px] overflow-hidden rounded-full border border-white/80"
                style={{
                    background: `
                        radial-gradient(
                            circle at 32% 24%,
                            rgba(255,255,255,0.98) 0%,
                            rgba(255,255,255,0.5) 18%,
                            ${theme.primary} 54%,
                            ${theme.secondary} 100%
                        )
                    `,
                    boxShadow: `
                        inset -10px -12px 20px rgba(44, 24, 100, 0.24),
                        inset 10px 8px 18px rgba(255,255,255,0.6),
                        0 10px 25px -10px ${theme.shadow}
                    `,
                }}
                animate={
                    reduceMotion
                        ? {}
                        : {
                            rotate: [0, 360],
                            scale: [1, 1.04, 1],
                        }
                }
                transition={{
                    rotate: {
                        duration: 12,
                        repeat: Infinity,
                        ease: "linear",
                    },
                    scale: {
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut",
                    },
                }}
            >
                <div className="absolute left-[18%] top-[14%] h-[20%] w-[22%] rounded-full bg-white/80 blur-[2px]" />
            </motion.div>
        </div>
    );
}