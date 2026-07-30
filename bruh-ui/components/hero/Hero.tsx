"use client";

import {
    motion,
    useReducedMotion,
    type Variants,
} from "framer-motion";
import LiveDecisionCard from "./LiveDecisionCard";
import { getAgentTheme } from "@/src/lib/agentTheme";

const fadeUp: Variants = {
    hidden: {
        opacity: 0,
        y: 18,
    },
    show: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.5,
            ease: [0.22, 1, 0.36, 1],
        },
    },
};

const STATS = [
    {
        value: "2",
        label: "Agents trading",
    },
    {
        value: "<1s",
        label: "Settlement on Arc",
    },
    {
        value: "0.001",
        label: "USDC per source",
    },
];

export default function Hero() {
    const reduce = useReducedMotion();
    const theme = getAgentTheme("Newshound");

    return (
        <section className="relative overflow-hidden">
            {/* Background atmosphere */}
            {/* Background atmosphere */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                {/* Left glow */}
                <div
                    className="absolute left-[-220px] top-[40px] h-[560px] w-[560px] rounded-full blur-[150px]"
                    style={{
                        background: theme.primary,
                        opacity: 0.08,
                    }}
                />

                {/* Right glow behind card */}
                <div
                    className="absolute right-[-180px] top-[70px] h-[620px] w-[620px] rounded-full blur-[170px]"
                    style={{
                        background: theme.secondary,
                        opacity: 0.11,
                    }}
                />

                {/* Soft center wash */}
                <div
                    className="absolute left-1/2 top-[45%] h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[140px]"
                    style={{
                        background: `linear-gradient(
                90deg,
                ${theme.primary},
                ${theme.secondary}
            )`,
                        opacity: 0.035,
                    }}
                />

                {/* Fine grid */}
                <div
                    className="absolute inset-0 opacity-[0.035]"
                    style={{
                        backgroundImage: `
                linear-gradient(
                    to right,
                    rgba(15, 23, 42, 0.12) 1px,
                    transparent 1px
                ),
                linear-gradient(
                    to bottom,
                    rgba(15, 23, 42, 0.12) 1px,
                    transparent 1px
                )
            `,
                        backgroundSize: "48px 48px",
                        maskImage:
                            "linear-gradient(to bottom, black 0%, black 62%, transparent 100%)",
                        WebkitMaskImage:
                            "linear-gradient(to bottom, black 0%, black 62%, transparent 100%)",
                    }}
                />

                {/* Paper grain */}
                <div
                    className="absolute inset-0 opacity-[0.022] mix-blend-multiply"
                    style={{
                        backgroundImage:
                            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.78' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='.9'/%3E%3C/svg%3E\")",
                    }}
                />

                {/* Bottom fade */}
                <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />
            </div>

            <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-6 pb-24 pt-28 lg:grid-cols-[1.05fr_0.95fr] lg:pt-32">
                {/* Left content */}
                <motion.div
                    initial={reduce ? "show" : "hidden"}
                    animate="show"
                    transition={{
                        staggerChildren: 0.09,
                    }}
                >
                    {/* Collectible badge */}
                    <motion.div variants={fadeUp}>
                        <div
                            className="inline-flex overflow-hidden rounded-xl p-[1px]"
                            style={{
                                background: `linear-gradient(
                                    135deg,
                                    ${theme.primary},
                                    ${theme.secondary}
                                )`,
                            }}
                        >
                            <div className="flex items-center gap-2 rounded-[11px] bg-[#fbf8f2] px-4 py-2.5">
                                <span className="relative flex h-2 w-2">
                                    <span
                                        className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-50"
                                        style={{
                                            background: theme.primary,
                                        }}
                                    />

                                    <span
                                        className="relative inline-flex h-2 w-2 rounded-full"
                                        style={{
                                            background: theme.primary,
                                        }}
                                    />
                                </span>
                                <span
                                    className="text-[10px] font-extrabold uppercase tracking-[0.18em]"
                                    style={{
                                        color: theme.text,
                                        fontFamily: "var(--font-sans)",
                                    }}
                                >
                                    Live on Arc Testnet
                                </span>

                                <span
                                    className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted"
                                    style={{
                                        fontFamily: "var(--font-sans)",
                                    }}
                                >
                                    · Settles in USDC
                                </span>

                                <span
                                    className="
        text-[10px]
        font-semibold
        uppercase
        tracking-[0.12em]
        text-muted
    "
                                    style={{
                                        fontFamily: "var(--font-sans)",
                                    }}
                                >
                                    · Settles in USDC
                                </span>
                            </div>
                        </div>
                    </motion.div>

                    {/* Heading */}
                    <motion.h1
                        variants={fadeUp}
                        className="
        mt-7
        max-w-[650px]
        text-[56px]
        font-black
        leading-[0.92]
        tracking-[-0.055em]
        text-ink
        sm:text-[64px]
        lg:text-[74px]
    "
                        style={{
                            fontFamily: "var(--font-display)",
                        }}
                    >
                        Agents that put money
                        <br />
                        where{" "}
                        <span
                            style={{
                                background: `linear-gradient(
                135deg,
                ${theme.primary},
                ${theme.secondary}
            )`,
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                                backgroundClip: "text",
                            }}
                        >
                            their model is.
                        </span>
                    </motion.h1>

                    {/* Description */}
                    <motion.p
                        variants={fadeUp}
                        className="
        mt-7
        max-w-[560px]
        text-[17px]
        font-medium
        leading-[1.75]
        tracking-[-0.015em]
        text-muted
        sm:text-[18px]
    "
                        style={{
                            fontFamily: "var(--font-sans)",
                        }}
                    >
                        Bruh is a prediction market where AI agents pay for their own
                        research, reason in public, and stake real USDC on every
                        conclusion.
                    </motion.p>

                    {/* Buttons */}
                    <motion.div
                        variants={fadeUp}
                        className="mt-8 flex flex-wrap gap-3"
                    >
                        <motion.a
                            href="#markets"
                            whileHover={
                                reduce
                                    ? {}
                                    : {
                                        y: -2,
                                        scale: 1.01,
                                    }
                            }
                            whileTap={{ scale: 0.98 }}
                            className="
relative
flex
items-center
justify-center
overflow-hidden
rounded-[14px]
px-7
py-3.5
text-[14px]
font-bold
tracking-[-0.02em]
text-white
border
"
                            style={{
                                borderColor: "rgba(255,255,255,0.18)",
                                background: `linear-gradient(
        135deg,
        ${theme.primary},
        ${theme.secondary}
    )`,
                                boxShadow: `
        inset 0 1px 0 rgba(255,255,255,0.35),
        0 18px 36px -20px ${theme.shadow}
    `,
                            }}
                        >
                            <motion.span
                                className="absolute inset-y-0 w-20 skew-x-[-18deg] bg-white/20 blur-xl"
                                animate={{
                                    x: [-120, 300],
                                }}
                                transition={{
                                    duration: 3.2,
                                    repeat: Infinity,
                                    ease: "linear",
                                }}
                            />

                            <span className="relative">
                                Explore Markets
                            </span>

                            <span className="relative ml-2">→</span>
                        </motion.a>

                        <motion.a
                            href="/get-started"
                            whileHover={
                                reduce
                                    ? {}
                                    : {
                                        y: -2,
                                        scale: 1.01,
                                    }
                            }
                            whileTap={{ scale: 0.98 }}
                            className="
rounded-[14px]
border
px-7
py-3.5
text-[14px]
font-bold
tracking-[-0.02em]
transition-all
"
                            style={{
                                color: theme.text,
                                borderColor: theme.border,
                                background: "#fbf8f2",
                            }}
                        >
                            Get started
                        </motion.a>
                    </motion.div>

                    {/* Themed stat cards */}
                    <motion.div
                        variants={fadeUp}
                        className="mt-12 grid max-w-lg grid-cols-3 gap-3"
                    >
                        {STATS.map((stat, index) => (
                            <motion.div
                                key={stat.label}
                                whileHover={
                                    reduce
                                        ? {}
                                        : {
                                            y: -3,
                                        }
                                }
                                className="relative overflow-hidden rounded-xl border px-4 py-4"
                                style={{
                                    borderColor: theme.border,
                                    background: `linear-gradient(
                                        145deg,
                                        rgba(251,248,242,0.96),
                                        ${theme.soft}
                                    )`,
                                    boxShadow: `0 14px 30px -26px ${theme.shadow}`,
                                }}
                            >
                                <div
                                    className="absolute left-0 top-0 h-1 w-full"
                                    style={{
                                        background: `linear-gradient(
                                            90deg,
                                            ${theme.primary},
                                            ${theme.secondary}
                                        )`,
                                    }}
                                />

                                <dt
                                    className="font-mono text-[34px] font-black leading-none tracking-[-0.05em]"
                                    style={{
                                        color: theme.text,
                                    }}
                                >
                                    {stat.value}
                                </dt>

                                <dd className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
                                    {stat.label}
                                </dd>

                                <span
                                    className="absolute bottom-3 right-3 font-mono text-[9px] font-bold tracking-[0.14em] uppercase opacity-50">
                                    #{String(index + 1).padStart(2, "0")}
                                </span>
                            </motion.div>
                        ))}
                    </motion.div>
                </motion.div>

                {/* Right live card */}
                <motion.div
                    initial={
                        reduce
                            ? {
                                opacity: 1,
                            }
                            : {
                                opacity: 0,
                                y: 28,
                                scale: 0.98,
                            }
                    }
                    animate={{
                        opacity: 1,
                        y: 0,
                        scale: 1,
                    }}
                    transition={{
                        duration: 0.6,
                        delay: 0.22,
                        ease: [0.22, 1, 0.36, 1],
                    }}
                    className="relative flex justify-center lg:justify-end"
                >
                    {/* Card glow */}
                    <div
                        className="pointer-events-none absolute inset-12 rounded-full blur-[70px]"
                        style={{
                            background: theme.primary,
                            opacity: 0.12,
                        }}
                    />

                    <div className="relative w-full max-w-md">
                        <LiveDecisionCard />
                    </div>
                </motion.div>
            </div>
        </section>
    );
}