"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

type Stage = {
    icon: string;
    label: string;
    detail: string;
    tone: "amber" | "primary" | "yes";
};

const STAGES: Stage[] = [
    {
        icon: "$",
        label: "Bought research",
        detail: "3 sources · 0.004 USDC via x402",
        tone: "amber",
    },
    {
        icon: "📟",
        label: "Formed estimate",
        detail: "P(YES) 0.64 vs market 0.51 · edge +13",
        tone: "primary",
    },
    {
        icon: "𖠌",
        label: "Executed trade",
        detail: "BUY 4.20 USDC YES · filled in 0.7s",
        tone: "yes",
    },
];

const toneClasses: Record<Stage["tone"], string> = {
    amber: "bg-amber-soft text-amber",
    primary: "bg-primary-soft text-primary",
    yes: "bg-yes-soft text-yes",
};

export default function LiveDecisionCard() {
    const [step, setStep] = useState(0); // 0..3, 3 = full card shown
    const reduce = useReducedMotion();

    useEffect(() => {
        if (reduce) {
            setStep(3);
            return;
        }
        const timings = [800, 1200, 1200, 2000]; // delay before each step advances
        let current = 0;
        const tick = () => {
            current = current >= 4 ? 0 : current + 1;
            setStep(current);
            setTimeout(tick, timings[current] ?? 2000);
        };
        const t = setTimeout(tick, 800);
        return () => clearTimeout(t);
    }, [reduce]);

    return (
        <div className="w-full max-w-md rounded-2xl p-5 shadow-[0_8px_40px_rgba(11,14,20,0.06)] bg-surface"
            style={{ border: "1px solid #6EE7FF" }}>
            {/* agent header */}
            <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft font-mono text-sm font-bold text-primary">
                    N
                </div>
                <div className="leading-tight">
                    <p className="text-sm font-semibold">Newshound</p>
                    <p className="text-xs text-muted">
                        Forecaster agent · Market: “ETH above $4k by Friday?”
                    </p>
                </div>
                <span className="ml-auto flex items-center gap-1.5 rounded-full bg-yes-soft px-2.5 py-1 text-[11px] font-medium text-yes">
                    <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yes opacity-60" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-yes" />
                    </span>
                    live
                </span>
            </div>

            {/* staged decision chips */}
            <div className="mt-4 flex flex-col gap-2.5">
                <AnimatePresence>
                    {STAGES.slice(0, Math.min(step, 3)).map((s) => (
                        <motion.div
                            key={s.label}
                            initial={{ opacity: 0, y: 10, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, transition: { duration: 0.15 } }}
                            transition={{ type: "spring", stiffness: 260, damping: 24 }}
                            className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-2.5"
                        >
                            <span
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm ${toneClasses[s.tone]}`}
                            >
                                {s.icon}
                            </span>
                            <div className="leading-tight">
                                <p className="text-[13px] font-semibold">{s.label}</p>
                                <p className="font-mono text-[11px] text-muted">{s.detail}</p>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* tx footer */}
            <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                <p className="font-mono text-[11px] text-muted">
                    tx 0x3f8a…c21e · Arc Testnet
                </p>
                <p className="font-mono text-[11px] text-primary">arcscan ↗</p>
            </div>
        </div>
    );
}