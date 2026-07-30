"use client";

import {
    useEffect,
    useRef,
    useState,
    type RefObject,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
    ArrowUpRight,
    Clock3,
    Sparkles,
    Users,
} from "lucide-react";

export type Market = {
    id: string;
    question: string;
    yesPrice: number;
    volume: number;
    closesIn: string;
    agentCount: number;
    trades: number;
};

const MARKET_THEMES = [
    {
        primary: "#8B5CF6",
        secondary: "#D946EF",
        soft: "#F5EEFF",
        border: "rgba(139, 92, 246, 0.34)",
        text: "#6D28D9",
        shadow: "rgba(139, 92, 246, 0.3)",
    },
    {
        primary: "#3B82F6",
        secondary: "#6366F1",
        soft: "#EDF4FF",
        border: "rgba(59, 130, 246, 0.32)",
        text: "#2563EB",
        shadow: "rgba(59, 130, 246, 0.28)",
    },
    {
        primary: "#A855F7",
        secondary: "#7C3AED",
        soft: "#F4EDFF",
        border: "rgba(168, 85, 247, 0.32)",
        text: "#7E22CE",
        shadow: "rgba(168, 85, 247, 0.28)",
    },
    {
        primary: "#38BDF8",
        secondary: "#6366F1",
        soft: "#EEF8FF",
        border: "rgba(56, 189, 248, 0.34)",
        text: "#0284C7",
        shadow: "rgba(56, 189, 248, 0.28)",
    },
];

function useCoverflow(
    containerRef: RefObject<HTMLDivElement | null>,
    cardRef: RefObject<HTMLDivElement | null>,
) {
    const [style, setStyle] = useState({
        scale: 1,
        rotateY: 0,
        opacity: 1,
        y: 0,
    });

    useEffect(() => {
        const container = containerRef.current;
        const card = cardRef.current;

        if (!container || !card) return;

        let raf = 0;

        const update = () => {
            cancelAnimationFrame(raf);

            raf = requestAnimationFrame(() => {
                const containerRect = container.getBoundingClientRect();
                const containerCenter =
                    containerRect.left + containerRect.width / 2;

                const cardRect = card.getBoundingClientRect();
                const cardCenter = cardRect.left + cardRect.width / 2;

                const distance = Math.max(
                    -1,
                    Math.min(
                        1,
                        ((cardCenter - containerCenter) /
                            containerRect.width) *
                        2,
                    ),
                );

                setStyle({
                    scale: 1 - Math.abs(distance) * 0.1,
                    rotateY: distance * -10,
                    opacity: 1 - Math.abs(distance) * 0.22,
                    y: Math.abs(distance) * 10,
                });
            });
        };

        update();

        container.addEventListener("scroll", update, {
            passive: true,
        });

        window.addEventListener("resize", update);

        return () => {
            cancelAnimationFrame(raf);
            container.removeEventListener("scroll", update);
            window.removeEventListener("resize", update);
        };
    }, [containerRef, cardRef]);

    return style;
}

function ProbabilityPanel({
    yes,
    theme,
}: {
    yes: number;
    theme: (typeof MARKET_THEMES)[number];
}) {
    const reduce = useReducedMotion();

    return (
        <div
            className="relative h-[190px] overflow-hidden rounded-[18px] border"
            style={{
                borderColor: theme.border,
                background: `
                    radial-gradient(
                        circle at 50% 42%,
                        ${theme.soft},
                        transparent 58%
                    ),
                    linear-gradient(
                        145deg,
                        #fffdf8,
                        #f8f3ec
                    )
                `,
            }}
        >
            {/* Technical grid */}
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.06]"
                style={{
                    backgroundImage: `
                        linear-gradient(
                            to right,
                            ${theme.primary} 1px,
                            transparent 1px
                        ),
                        linear-gradient(
                            to bottom,
                            ${theme.primary} 1px,
                            transparent 1px
                        )
                    `,
                    backgroundSize: "28px 28px",
                    maskImage:
                        "radial-gradient(circle at center, black, transparent 78%)",
                    WebkitMaskImage:
                        "radial-gradient(circle at center, black, transparent 78%)",
                }}
            />

            {/* Decorative circuit lines */}
            <svg
                className="absolute inset-0 h-full w-full opacity-35"
                fill="none"
                stroke={theme.primary}
                strokeWidth="1"
            >
                <path d="M0 40 H76 L104 67 H160" />
                <path d="M380 160 H308 L280 132 H220" />

                <circle cx="76" cy="40" r="3" fill={theme.primary} />
                <circle cx="160" cy="67" r="3" fill={theme.primary} />
                <circle cx="308" cy="160" r="3" fill={theme.primary} />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-500">
                    Market probability
                </span>

                <div className="mt-2 flex items-start">
                    <motion.span
                        initial={
                            reduce
                                ? false
                                : {
                                    opacity: 0,
                                    scale: 0.88,
                                }
                        }
                        whileInView={{
                            opacity: 1,
                            scale: 1,
                        }}
                        viewport={{ once: true }}
                        transition={{
                            type: "spring",
                            stiffness: 110,
                            damping: 16,
                        }}
                        className="font-mono text-[68px] font-black leading-none tracking-[-0.08em]"
                        style={{
                            color: theme.text,
                        }}
                    >
                        {yes}
                    </motion.span>

                    <span
                        className="mt-1.5 text-xl font-black"
                        style={{
                            color: theme.text,
                        }}
                    >
                        %
                    </span>
                </div>

                <span className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Implied P(YES)
                </span>

                <div className="mt-5 h-2 w-44 overflow-hidden rounded-full bg-black/[0.07]">
                    <motion.div
                        initial={{
                            width: reduce ? `${yes}%` : 0,
                        }}
                        whileInView={{
                            width: `${yes}%`,
                        }}
                        viewport={{ once: true }}
                        transition={{
                            type: "spring",
                            stiffness: 75,
                            damping: 20,
                            delay: 0.15,
                        }}
                        className="h-full rounded-full"
                        style={{
                            background: `linear-gradient(
                                90deg,
                                ${theme.primary},
                                ${theme.secondary}
                            )`,
                        }}
                    />
                </div>
            </div>
        </div>
    );
}

export default function MarketCard({
    market,
    index,
    containerRef,
}: {
    market: Market;
    index: number;
    containerRef: RefObject<HTMLDivElement | null>;
}) {
    const yes = Math.round(market.yesPrice * 100);
    const cardRef = useRef<HTMLDivElement>(null);
    const theme = MARKET_THEMES[index % MARKET_THEMES.length];

    const {
        scale,
        rotateY,
        opacity,
        y,
    } = useCoverflow(containerRef, cardRef);

    return (
        <motion.article
            ref={cardRef}
            data-market-card
            className="
                relative
                flex
                w-[340px]
                shrink-0
                snap-center
                flex-col
                will-change-transform
                sm:w-[390px]
            "
            style={{
                scale,
                rotateY,
                opacity,
                y,
                transformPerspective: 1400,
                transformStyle: "preserve-3d",
            }}
        >
            {/* Gradient card frame */}
            <div
                className="relative overflow-hidden rounded-[27px] p-[3px]"
                style={{
                    background: `linear-gradient(
                        135deg,
                        ${theme.primary},
                        ${theme.secondary}
                    )`,
                    boxShadow: `
                        0 28px 60px -34px ${theme.shadow},
                        0 16px 36px rgba(15, 23, 42, 0.1)
                    `,
                }}
            >
                <div
                    className="relative overflow-hidden rounded-[24px] px-4 pb-4 pt-5"
                    style={{
                        background: `
                            radial-gradient(
                                circle at 90% 6%,
                                ${theme.soft},
                                transparent 35%
                            ),
                            linear-gradient(
                                145deg,
                                #fffdf8 0%,
                                #f8f3eb 100%
                            )
                        `,
                    }}
                >
                    {/* Paper grain */}
                    <div
                        className="pointer-events-none absolute inset-0 opacity-[0.032] mix-blend-multiply"
                        style={{
                            backgroundImage:
                                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.9'/%3E%3C/svg%3E\")",
                        }}
                    />

                    {/* Market tab */}
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
                        <span className="text-[9px] font-black uppercase tracking-[0.22em] text-white">
                            Market
                        </span>

                        <Sparkles className="ml-2 h-3 w-3 text-white" />
                    </div>

                    {/* Collector number */}
                    <span className="absolute right-4 top-4 font-mono text-[9px] font-bold tracking-[0.13em] text-slate-400">
                        #{String(index + 1).padStart(2, "0")}
                    </span>

                    <div className="relative mt-8">
                        <ProbabilityPanel
                            yes={yes}
                            theme={theme}
                        />

                        <div className="px-1 pt-5">
                            <div className="flex items-start justify-between gap-3">
                                <h3
                                    className="max-w-[270px] text-[20px] font-black leading-[1.08] tracking-[-0.035em] text-slate-950"
                                    style={{
                                        fontFamily: "var(--font-display)",
                                    }}
                                >
                                    {market.question}
                                </h3>

                                <div
                                    className="flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5"
                                    style={{
                                        borderColor: theme.border,
                                        color: theme.text,
                                        background: theme.soft,
                                    }}
                                >
                                    <Clock3 className="h-3 w-3" />

                                    <span className="font-mono text-[9px] font-black">
                                        {market.closesIn}
                                    </span>
                                </div>
                            </div>

                            {/* Metadata */}
                            <div className="mt-5 grid grid-cols-3 divide-x divide-black/10 border-y border-black/10 py-3">
                                <div>
                                    <p className="text-[8px] font-black uppercase tracking-[0.15em] text-slate-400">
                                        Volume
                                    </p>

                                    <p
                                        className="mt-1 font-mono text-[13px] font-black"
                                        style={{
                                            color: theme.text,
                                        }}
                                    >
                                        {market.volume}
                                    </p>

                                    <p className="text-[8px] font-semibold text-slate-400">
                                        USDC
                                    </p>
                                </div>

                                <div className="px-3">
                                    <p className="text-[8px] font-black uppercase tracking-[0.15em] text-slate-400">
                                        Trades
                                    </p>

                                    <p
                                        className="mt-1 font-mono text-[13px] font-black"
                                        style={{
                                            color: theme.text,
                                        }}
                                    >
                                        {market.trades}
                                    </p>
                                </div>

                                <div className="pl-3">
                                    <p className="text-[8px] font-black uppercase tracking-[0.15em] text-slate-400">
                                        Agents
                                    </p>

                                    <div className="mt-1 flex items-center gap-1">
                                        <Users
                                            className="h-3 w-3"
                                            style={{
                                                color: theme.text,
                                            }}
                                        />

                                        <p
                                            className="font-mono text-[13px] font-black"
                                            style={{
                                                color: theme.text,
                                            }}
                                        >
                                            {market.agentCount}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Footer CTA */}
                            <div className="mt-4 flex items-center justify-between">
                                <div>
                                    <p className="text-[8px] font-black uppercase tracking-[0.18em] text-slate-400">
                                        Bruh Markets
                                    </p>

                                    <p className="mt-1 text-[10px] font-semibold text-slate-500">
                                        Settles on Arc in USDC
                                    </p>
                                </div>

                                <motion.button
                                    type="button"
                                    whileHover={{
                                        y: -2,
                                        scale: 1.015,
                                    }}
                                    whileTap={{
                                        scale: 0.98,
                                    }}
                                    className="flex items-center gap-2 rounded-[13px] px-4 py-2.5 text-[11px] font-black text-white"
                                    style={{
                                        background: `linear-gradient(
                                            135deg,
                                            ${theme.primary},
                                            ${theme.secondary}
                                        )`,
                                        boxShadow: `0 12px 24px -16px ${theme.shadow}`,
                                    }}
                                >
                                    View market
                                    <ArrowUpRight className="h-3.5 w-3.5" />
                                </motion.button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </motion.article>
    );
}