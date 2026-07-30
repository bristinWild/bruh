"use client";

import {
    useEffect,
    useRef,
    useState,
} from "react";
import {
    AnimatePresence,
    motion,
    useReducedMotion,
    type Variants,
} from "framer-motion";
import {
    ArrowLeft,
    ArrowRight,
    BrainCircuit,
    Check,
    Coins,
    FileSearch,
    ShieldCheck,
    Sparkles,
} from "lucide-react";

const STEPS = [
    {
        number: "01",
        title: "Buy research",
        description:
            "The agent scans open markets and purchases relevant sources through x402 micropayments. Each source is paid for instantly in USDC without subscriptions or manual approval.",
        tag: "x402 · Nanopayments",
        icon: FileSearch,
        primary: "#8B5CF6",
        secondary: "#D946EF",
        soft: "#F5EEFF",
        border: "rgba(139, 92, 246, 0.3)",
        text: "#6D28D9",
        shadow: "rgba(139, 92, 246, 0.28)",
    },
    {
        number: "02",
        title: "Form an estimate",
        description:
            "Sources enter a structured reasoning loop. The agent produces a probability, confidence score, and supporting evidence that can be inspected and verified.",
        tag: "LLM · Structured output",
        icon: BrainCircuit,
        primary: "#A855F7",
        secondary: "#6366F1",
        soft: "#F3EEFF",
        border: "rgba(168, 85, 247, 0.3)",
        text: "#7E22CE",
        shadow: "rgba(168, 85, 247, 0.28)",
    },
    {
        number: "03",
        title: "Stake USDC",
        description:
            "When the estimated edge exceeds its threshold, the agent calculates position size and purchases YES or NO shares directly through the Arc market contract.",
        tag: "CPMM · Arc · Circle Wallets",
        icon: Coins,
        primary: "#3B82F6",
        secondary: "#6366F1",
        soft: "#EEF4FF",
        border: "rgba(59, 130, 246, 0.3)",
        text: "#2563EB",
        shadow: "rgba(59, 130, 246, 0.28)",
    },
    {
        number: "04",
        title: "Settle and redeem",
        description:
            "The market closes, the outcome is resolved, and funds are released through deterministic settlement. Winning positions can redeem their USDC immediately.",
        tag: "ERC-8183 · Arcscan",
        icon: ShieldCheck,
        primary: "#6366F1",
        secondary: "#8B5CF6",
        soft: "#F0EEFF",
        border: "rgba(99, 102, 241, 0.3)",
        text: "#4F46E5",
        shadow: "rgba(99, 102, 241, 0.3)",
    },
];

const cardVariants: Variants = {
    enter: (direction: number) => ({
        rotateX: direction > 0 ? -72 : 72,
        opacity: 0,
        y: direction > 0 ? 18 : -18,
        scale: 0.97,
    }),
    center: {
        rotateX: 0,
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
            duration: 0.55,
            ease: [0.22, 1, 0.36, 1],
        },
    },
    exit: (direction: number) => ({
        rotateX: direction > 0 ? 72 : -72,
        opacity: 0,
        y: direction > 0 ? -18 : 18,
        scale: 0.97,
        transition: {
            duration: 0.32,
            ease: [0.55, 0, 1, 0.45],
        },
    }),
};

export default function HowItWorks() {
    const [active, setActive] = useState(0);
    const [direction, setDirection] = useState(1);

    const reduceMotion = useReducedMotion();
    const sectionRef = useRef<HTMLElement>(null);
    const isAnimating = useRef(false);
    const accumulatedScroll = useRef(0);
    const touchStart = useRef(0);

    const step = STEPS[active];
    const Icon = step.icon;

    const goToStep = (next: number) => {
        if (isAnimating.current) return;
        if (next < 0 || next >= STEPS.length) return;
        if (next === active) return;

        isAnimating.current = true;
        setDirection(next > active ? 1 : -1);
        setActive(next);

        window.setTimeout(() => {
            isAnimating.current = false;
        }, 550);
    };

    useEffect(() => {
        if (reduceMotion) return;

        const onWheel = (event: WheelEvent) => {
            const section = sectionRef.current;

            if (!section) return;

            const rect = section.getBoundingClientRect();

            const sectionIsActive =
                rect.top >= -30 &&
                rect.top <= window.innerHeight * 0.18;

            if (!sectionIsActive) return;

            const movingBackward = event.deltaY < 0;
            const movingForward = event.deltaY > 0;

            const atFirstStep = active === 0 && movingBackward;
            const atLastStep =
                active === STEPS.length - 1 && movingForward;

            if (atFirstStep || atLastStep) return;

            event.preventDefault();

            accumulatedScroll.current += event.deltaY;

            if (Math.abs(accumulatedScroll.current) < 65) return;

            const nextDirection =
                accumulatedScroll.current > 0 ? 1 : -1;

            accumulatedScroll.current = 0;

            goToStep(active + nextDirection);
        };

        window.addEventListener("wheel", onWheel, {
            passive: false,
        });

        return () => {
            window.removeEventListener("wheel", onWheel);
        };
    }, [active, reduceMotion]);

    const onTouchStart = (
        event: React.TouchEvent<HTMLElement>,
    ) => {
        touchStart.current = event.touches[0].clientY;
    };

    const onTouchEnd = (
        event: React.TouchEvent<HTMLElement>,
    ) => {
        const delta =
            touchStart.current -
            event.changedTouches[0].clientY;

        if (Math.abs(delta) < 35) return;

        goToStep(active + (delta > 0 ? 1 : -1));
    };

    return (
        <section
            id="how"
            ref={sectionRef}
            className="relative overflow-hidden pb-16 pt-24"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
        >
            {/* Background */}
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-[-180px] top-40 h-[440px] w-[440px] rounded-full bg-violet-300/10 blur-[150px]" />

                <div className="absolute right-[-180px] top-48 h-[440px] w-[440px] rounded-full bg-blue-300/10 blur-[150px]" />

                <div
                    className="absolute inset-0 opacity-[0.025]"
                    style={{
                        backgroundImage: `
                            linear-gradient(
                                to right,
                                rgba(99, 102, 241, 0.2) 1px,
                                transparent 1px
                            ),
                            linear-gradient(
                                to bottom,
                                rgba(99, 102, 241, 0.2) 1px,
                                transparent 1px
                            )
                        `,
                        backgroundSize: "48px 48px",
                        maskImage:
                            "linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)",
                        WebkitMaskImage:
                            "linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)",
                    }}
                />
            </div>

            {/* Header */}
            <motion.div
                initial={
                    reduceMotion
                        ? { opacity: 1 }
                        : { opacity: 0, y: 16 }
                }
                whileInView={{
                    opacity: 1,
                    y: 0,
                }}
                viewport={{ once: true }}
                transition={{ duration: 0.45 }}
                className="relative mx-auto mb-12 flex max-w-2xl flex-col items-center px-6 text-center"
            >
                <div className="inline-flex rounded-full bg-gradient-to-r from-violet-500 to-blue-500 p-px">
                    <div className="flex items-center gap-2 rounded-full bg-[#fbf8f2] px-4 py-2">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-500 opacity-40" />

                            <span className="relative h-2 w-2 rounded-full bg-violet-500" />
                        </span>

                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
                            How it works
                        </span>
                    </div>
                </div>

                <h2
                    className="mt-6 text-[42px] font-black uppercase leading-[0.92] tracking-[-0.055em] text-slate-950 sm:text-[52px]"
                    style={{
                        fontFamily: "var(--font-display)",
                    }}
                >
                    Four steps.{" "}
                    <span className="bg-gradient-to-r from-violet-600 to-blue-500 bg-clip-text text-transparent">
                        Zero guesswork.
                    </span>
                </h2>

                <p
                    className="mt-5 max-w-xl text-[16px] font-medium leading-[1.7] tracking-[-0.012em] text-muted"
                    style={{
                        fontFamily: "var(--font-sans)",
                    }}
                >
                    Research, reasoning, trading, and settlement are
                    handled autonomously by the agent and recorded onchain.
                </p>
            </motion.div>

            <div className="relative mx-auto max-w-4xl px-6">
                {/* Step navigation */}
                <div className="mb-6 grid grid-cols-4 gap-2">
                    {STEPS.map((item, index) => {
                        const StepIcon = item.icon;
                        const completed = index < active;
                        const selected = index === active;

                        return (
                            <button
                                key={item.number}
                                type="button"
                                onClick={() => goToStep(index)}
                                className="relative flex min-w-0 flex-col items-center rounded-[16px] border px-2 py-3 transition-all duration-300"
                                style={{
                                    borderColor: selected
                                        ? step.border
                                        : "rgba(15, 23, 42, 0.1)",
                                    background: selected
                                        ? step.soft
                                        : "rgba(255, 255, 255, 0.5)",
                                    transform: selected
                                        ? "translateY(-3px)"
                                        : "translateY(0)",
                                }}
                            >
                                <div
                                    className="flex h-8 w-8 items-center justify-center rounded-[10px]"
                                    style={{
                                        color:
                                            selected || completed
                                                ? item.text
                                                : "#94A3B8",
                                        background:
                                            selected || completed
                                                ? item.soft
                                                : "rgba(15, 23, 42, 0.04)",
                                    }}
                                >
                                    {completed ? (
                                        <Check className="h-4 w-4" />
                                    ) : (
                                        <StepIcon className="h-4 w-4" />
                                    )}
                                </div>

                                <span
                                    className="mt-2 font-mono text-[9px] font-black"
                                    style={{
                                        color: selected
                                            ? item.text
                                            : "#94A3B8",
                                    }}
                                >
                                    {item.number}
                                </span>

                                <span className="mt-1 hidden truncate text-[8px] font-black uppercase tracking-[0.12em] text-slate-500 sm:block">
                                    {item.title}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Main collectible card */}
                <div
                    className="relative"
                    style={{
                        perspective: "1400px",
                    }}
                >
                    <AnimatePresence
                        mode="wait"
                        custom={direction}
                    >
                        <motion.article
                            key={active}
                            custom={direction}
                            variants={
                                reduceMotion
                                    ? undefined
                                    : cardVariants
                            }
                            initial="enter"
                            animate="center"
                            exit="exit"
                            style={{
                                transformStyle: "preserve-3d",
                            }}
                            className="relative"
                        >
                            <div
                                className="relative overflow-hidden rounded-[28px] p-[3px]"
                                style={{
                                    background: `linear-gradient(
                                        135deg,
                                        ${step.primary},
                                        ${step.secondary}
                                    )`,
                                    boxShadow: `
                                        0 28px 65px -36px ${step.shadow},
                                        0 16px 38px rgba(15, 23, 42, 0.1)
                                    `,
                                }}
                            >
                                <div
                                    className="relative overflow-hidden rounded-[25px] px-6 pb-6 pt-16 sm:px-9 sm:pb-8"
                                    style={{
                                        background: `
                                            radial-gradient(
                                                circle at 88% 8%,
                                                ${step.soft},
                                                transparent 38%
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

                                    {/* Top tab */}
                                    <div
                                        className="absolute left-0 top-0 flex h-11 items-center rounded-br-[20px] px-6"
                                        style={{
                                            background: `linear-gradient(
                                                135deg,
                                                ${step.primary},
                                                ${step.secondary}
                                            )`,
                                        }}
                                    >
                                        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white">
                                            Step {step.number}
                                        </span>

                                        <Sparkles className="ml-2 h-3.5 w-3.5 text-white" />
                                    </div>

                                    <span className="absolute right-6 top-5 font-mono text-[9px] font-black tracking-[0.15em] text-slate-400">
                                        {active + 1}/{STEPS.length}
                                    </span>

                                    <div className="relative grid gap-7 sm:grid-cols-[150px_1fr] sm:items-center">
                                        {/* Icon panel */}
                                        <div
                                            className="relative mx-auto flex h-[140px] w-[140px] items-center justify-center overflow-hidden rounded-[28px] border"
                                            style={{
                                                borderColor:
                                                    step.border,
                                                background: `
                                                    radial-gradient(
                                                        circle at 35% 25%,
                                                        rgba(255,255,255,0.95),
                                                        transparent 30%
                                                    ),
                                                    linear-gradient(
                                                        145deg,
                                                        ${step.soft},
                                                        rgba(255,255,255,0.75)
                                                    )
                                                `,
                                            }}
                                        >
                                            <motion.div
                                                animate={
                                                    reduceMotion
                                                        ? {}
                                                        : {
                                                            rotate: [
                                                                0,
                                                                4,
                                                                -4,
                                                                0,
                                                            ],
                                                            scale: [
                                                                1,
                                                                1.05,
                                                                1,
                                                            ],
                                                        }
                                                }
                                                transition={{
                                                    duration: 4,
                                                    repeat: Infinity,
                                                    ease: "easeInOut",
                                                }}
                                            >
                                                <Icon
                                                    className="h-16 w-16"
                                                    strokeWidth={1.5}
                                                    style={{
                                                        color: step.text,
                                                    }}
                                                />
                                            </motion.div>

                                            <div
                                                className="absolute inset-x-5 bottom-4 h-1 overflow-hidden rounded-full bg-black/[0.06]"
                                            >
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{
                                                        width: `${((active + 1) / STEPS.length) * 100}%`,
                                                    }}
                                                    transition={{
                                                        duration: 0.45,
                                                        ease: "easeOut",
                                                    }}
                                                    className="h-full rounded-full"
                                                    style={{
                                                        background: `linear-gradient(
                                                            90deg,
                                                            ${step.primary},
                                                            ${step.secondary}
                                                        )`,
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        {/* Step content */}
                                        <div>
                                            <p
                                                className="text-[10px] font-black uppercase tracking-[0.2em]"
                                                style={{
                                                    color: step.text,
                                                }}
                                            >
                                                Autonomous workflow
                                            </p>

                                            <h3
                                                className="mt-3 text-[34px] font-black uppercase leading-[0.94] tracking-[-0.05em] text-slate-950 sm:text-[44px]"
                                                style={{
                                                    fontFamily:
                                                        "var(--font-display)",
                                                }}
                                            >
                                                {step.title}
                                            </h3>

                                            <p
                                                className="mt-5 max-w-xl text-[15px] font-medium leading-[1.75] tracking-[-0.01em] text-slate-600"
                                                style={{
                                                    fontFamily:
                                                        "var(--font-sans)",
                                                }}
                                            >
                                                {step.description}
                                            </p>

                                            <div
                                                className="mt-6 inline-flex items-center gap-2 rounded-full border px-3.5 py-2"
                                                style={{
                                                    borderColor:
                                                        step.border,
                                                    color: step.text,
                                                    background: step.soft,
                                                }}
                                            >
                                                <span
                                                    className="h-1.5 w-1.5 rounded-full"
                                                    style={{
                                                        background:
                                                            step.primary,
                                                    }}
                                                />

                                                <span className="font-mono text-[9px] font-black uppercase tracking-[0.15em]">
                                                    {step.tag}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="relative mt-8 flex items-center justify-between border-t border-black/10 pt-4">
                                        <div>
                                            <p className="text-[8px] font-black uppercase tracking-[0.18em] text-slate-400">
                                                Bruh protocol
                                            </p>

                                            <p className="mt-1 text-[10px] font-semibold text-slate-500">
                                                Autonomous market execution
                                            </p>
                                        </div>

                                        <span
                                            className="font-mono text-[11px] font-black"
                                            style={{
                                                color: step.text,
                                            }}
                                        >
                                            #{step.number}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </motion.article>
                    </AnimatePresence>
                </div>

                {/* Controls */}
                <div className="mt-6 flex items-center justify-between">
                    <motion.button
                        type="button"
                        onClick={() => goToStep(active - 1)}
                        disabled={active === 0}
                        whileHover={
                            active === 0
                                ? {}
                                : { y: -2 }
                        }
                        whileTap={
                            active === 0
                                ? {}
                                : { scale: 0.98 }
                        }
                        className="flex items-center gap-2 rounded-[13px] border px-4 py-2.5 text-[11px] font-black transition-opacity disabled:cursor-not-allowed disabled:opacity-30"
                        style={{
                            borderColor: step.border,
                            color: step.text,
                            background: "#fffdf8",
                        }}
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Previous
                    </motion.button>

                    <span className="font-mono text-[10px] font-black tracking-[0.15em] text-slate-400">
                        {String(active + 1).padStart(2, "0")} /{" "}
                        {String(STEPS.length).padStart(2, "0")}
                    </span>

                    <motion.button
                        type="button"
                        onClick={() => goToStep(active + 1)}
                        disabled={active === STEPS.length - 1}
                        whileHover={
                            active === STEPS.length - 1
                                ? {}
                                : { y: -2 }
                        }
                        whileTap={
                            active === STEPS.length - 1
                                ? {}
                                : { scale: 0.98 }
                        }
                        className="flex items-center gap-2 rounded-[13px] px-4 py-2.5 text-[11px] font-black text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-30"
                        style={{
                            background: `linear-gradient(
                                135deg,
                                ${step.primary},
                                ${step.secondary}
                            )`,
                            boxShadow: `0 12px 24px -16px ${step.shadow}`,
                        }}
                    >
                        Next
                        <ArrowRight className="h-3.5 w-3.5" />
                    </motion.button>
                </div>
            </div>
        </section>
    );
}