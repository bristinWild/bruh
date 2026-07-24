"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";

const STEPS: {
    number: string;
    title: string;
    description: string;
    tag: string;
    terminal?: boolean;
}[] = [
        {
            number: "01",
            title: "Buy research",
            description: "Agent scans open markets and pays per article via x402 micropayments — fractions of a cent per source, settled in USDC through Circle Nanopayments. No subscription. No login. Machine speed.",
            tag: "x402 · Nanopayments",
        },
        {
            number: "02",
            title: "Form an estimate",
            description: "Sources feed an LLM reasoning loop. Output is structured: probability, confidence score, key evidence. The reasoning is logged publicly — every conclusion is auditable.",
            tag: "LLM · structured output",
        },
        {
            number: "03",
            title: "Stake USDC",
            description: "If edge exceeds the threshold, fractional Kelly sizing determines position size. Agent buys YES or NO shares on the Arc market contract. Settlement is deterministic and sub-second.",
            tag: "CPMM · Arc · Circle Wallets",
        },
        {
            number: "04",
            title: "Settle & redeem",
            description: "Market closes. Oracle agent resolves outcome via ERC-8183 escrow — bond posted, evidence submitted, USDC released. Winners redeem instantly. Every step on arcscan.",
            tag: "ERC-8183 · arcscan",
            terminal: true,
        },
    ];

const variants: Variants = {
    enter: (dir: number) => ({
        rotateX: dir > 0 ? -90 : 90,
        opacity: 0,
        scale: 0.95,
    }),
    center: {
        rotateX: 0,
        opacity: 1,
        scale: 1,
        transition: {
            duration: 0.5,
            ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
        },
    },
    exit: (dir: number) => ({
        rotateX: dir > 0 ? 90 : -90,
        opacity: 0,
        scale: 0.95,
        transition: {
            duration: 0.35,
            ease: [0.55, 0, 1, 0.45] as [number, number, number, number],
        },
    }),
};

export default function HowItWorks() {
    const [active, setActive] = useState(0);
    const [dir, setDir] = useState(1);
    const reduce = useReducedMotion();
    const sectionRef = useRef<HTMLDivElement>(null);
    const lastScrollY = useRef(0);
    const isAnimating = useRef(false);
    const accumulated = useRef(0);

    const go = (next: number) => {
        if (isAnimating.current) return;
        if (next < 0 || next >= STEPS.length) return;
        isAnimating.current = true;
        setDir(next > active ? 1 : -1);
        setActive(next);
        setTimeout(() => {
            isAnimating.current = false;
        }, 550);
    };

    useEffect(() => {
        if (reduce) return;

        const onWheel = (e: WheelEvent) => {
            const section = sectionRef.current;
            if (!section) return;

            const rect = section.getBoundingClientRect();

            // section must be nearly fully in view — tight window
            const fullyInView = rect.top >= -20 && rect.top <= window.innerHeight * 0.15;
            if (!fullyInView) return;

            // only intercept if we're not at boundaries
            const atStart = active === 0 && e.deltaY < 0;
            const atEnd = active === STEPS.length - 1 && e.deltaY > 0;

            // let natural scroll pass through at boundaries
            if (atStart || atEnd) return;

            // we own this scroll — prevent page from moving
            e.preventDefault();

            accumulated.current += e.deltaY;
            if (Math.abs(accumulated.current) < 60) return;

            const direction = accumulated.current > 0 ? 1 : -1;
            accumulated.current = 0;
            go(active + direction);
        };

        window.addEventListener("wheel", onWheel, { passive: false });
        return () => window.removeEventListener("wheel", onWheel);
    }, [active, reduce]);

    // touch support
    const touchStart = useRef(0);
    const onTouchStart = (e: React.TouchEvent) =>
        (touchStart.current = e.touches[0].clientY);
    const onTouchEnd = (e: React.TouchEvent) => {
        const delta = touchStart.current - e.changedTouches[0].clientY;
        if (Math.abs(delta) < 30) return;
        go(active + (delta > 0 ? 1 : -1));
    };

    const step = STEPS[active];
    const isLast = active === STEPS.length - 1;

    return (
        <section
            id="how"
            ref={sectionRef}
            className="py-24 pb-8"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
        >
            {/* centered header */}
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45 }}
                className="mx-auto mb-16 flex max-w-2xl flex-col items-center px-6 text-center"
            >
                <span className="flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-1.5 text-[12px] font-semibold uppercase tracking-wider text-muted">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#6EE7FF" }} />
                    How it works
                </span>
                <h2
                    className="mt-5 text-3xl leading-tight tracking-tight lg:text-5xl uppercase"
                    style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.03em", lineHeight: "1.0" }}
                >
                    Four steps. Zero humans.
                </h2>
                <p className="mt-4 max-w-lg text-base text-muted">
                    Every decision , research, reasoning, staking, settlement are made
                    and paid for by the agent. Scroll to step through.
                </p>
            </motion.div>

            {/* flip card + controls */}
            <div className="mx-auto max-w-2xl px-6">
                {/* progress dots */}
                <div className="mb-8 flex items-center justify-center gap-2">
                    {STEPS.map((s, i) => (
                        <button
                            key={s.number}
                            onClick={() => go(i)}
                            className="transition-all duration-300 rounded-full"
                            style={{
                                width: i === active ? "2rem" : "0.5rem",
                                height: "0.5rem",
                                background: i === active ? "#38BDF8" : "var(--color-line)",
                            }}
                        />
                    ))}
                </div>

                {/* the flip card */}
                <div style={{ perspective: "1200px" }}>
                    <AnimatePresence mode="wait" custom={dir}>
                        <motion.div
                            key={active}
                            custom={dir}
                            variants={reduce ? undefined : variants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            style={{ transformStyle: "preserve-3d" }}
                            className={`w-full rounded-2xl p-10 ${isLast
                                ? "bg-ink text-surface"
                                : "border border-line bg-surface"
                                }`}
                        >
                            {/* step number */}
                            <p
                                className={`font-mono text-[11px] font-semibold uppercase tracking-widest ${isLast ? "text-muted" : "text-muted"
                                    }`}
                            >
                                Step {step.number} / {STEPS.length}
                            </p>

                            {/* title */}
                            <h3
                                className={`mt-4 text-4xl font-bold uppercase leading-tight ${isLast ? "text-surface" : "text-ink"
                                    }`}
                                style={{ fontFamily: "var(--font-display)" }}
                            >
                                {step.title}
                            </h3>

                            {/* description */}
                            <p
                                className={`mt-5 text-base leading-relaxed ${isLast ? "text-muted" : "text-muted"
                                    }`}
                            >
                                {step.description}
                            </p>

                            {/* tag */}
                            <span
                                className="mt-8 inline-block rounded-full px-3.5 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider"
                                style={
                                    step.terminal
                                        ? { background: "rgba(255,255,255,0.1)", color: "var(--color-surface)" }
                                        : { background: "#ecfeff", color: "#0EA5E9", border: "1px solid #6EE7FF" }
                                }
                            >
                                {step.tag}
                            </span>

                            {/* progress bar */}
                            <div className="mt-8 h-px w-full bg-line overflow-hidden rounded-full">
                                <motion.div
                                    className="h-full rounded-full"
                                    style={{ background: step.terminal ? "var(--color-surface)" : "#38BDF8" }}
                                    initial={false}
                                    animate={{ width: `${((active + 1) / STEPS.length) * 100}%` }}
                                    transition={{ duration: 0.4, ease: "easeOut" }}
                                />
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* prev / next buttons */}
                <div className="mt-6 flex items-center justify-between">
                    <button
                        onClick={() => go(active - 1)}
                        disabled={active === 0}
                        className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-ink transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        onMouseEnter={e => {
                            e.currentTarget.style.borderColor = "#22D3EE";
                            e.currentTarget.style.color = "#0EA5E9";
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.borderColor = "var(--color-line)";
                            e.currentTarget.style.color = "var(--color-ink)";
                        }}
                    >
                        ← Prev
                    </button>
                    <span className="font-mono text-[12px] text-muted">
                        {active + 1} / {STEPS.length}
                    </span>
                    <button
                        onClick={() => go(active + 1)}
                        disabled={active === STEPS.length - 1}
                        className="rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        style={{ background: "#38BDF8" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#0EA5E9")}
                        onMouseLeave={e => (e.currentTarget.style.background = "#38BDF8")}
                    >
                        Next →
                    </button>
                </div>
            </div>
        </section>
    );
}