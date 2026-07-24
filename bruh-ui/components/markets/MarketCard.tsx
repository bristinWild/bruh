"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { motion } from "framer-motion";

export type Market = {
    id: string;
    question: string;
    yesPrice: number;
    volume: number;
    closesIn: string;
    agentCount: number;
    trades: number;
};

function useCoverflow(
    containerRef: RefObject<HTMLDivElement | null>,
    cardRef: RefObject<HTMLDivElement | null>
) {
    const [style, setStyle] = useState({ scale: 1, rotateY: 0, opacity: 1 });

    useEffect(() => {
        const container = containerRef.current;
        const card = cardRef.current;
        if (!container || !card) return;

        let raf = 0;
        const update = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
                const cRect = container.getBoundingClientRect();
                const center = cRect.left + cRect.width / 2;
                const rect = card.getBoundingClientRect();
                const cardCenter = rect.left + rect.width / 2;
                const d = Math.max(-1, Math.min(1, ((cardCenter - center) / cRect.width) * 2));
                setStyle({
                    scale: 1 - Math.abs(d) * 0.14,
                    rotateY: d * -16,
                    opacity: 1 - Math.abs(d) * 0.4,
                });
            });
        };

        update();
        container.addEventListener("scroll", update, { passive: true });
        window.addEventListener("resize", update);
        return () => {
            cancelAnimationFrame(raf);
            container.removeEventListener("scroll", update);
            window.removeEventListener("resize", update);
        };
    }, [containerRef, cardRef]);

    return style;
}

function VisualPanel({ yes }: { yes: number }) {
    return (
        <div className="relative h-52 overflow-hidden rounded-xl bg-bg">
            <svg
                className="absolute inset-0 h-full w-full text-line"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
            >
                <path d="M0 40 H80 L110 70 H200" />
                <path d="M340 190 H260 L230 160 H140" />
                <circle cx="80" cy="40" r="3" fill="currentColor" />
                <circle cx="200" cy="70" r="3" fill="currentColor" />
                <circle cx="260" cy="190" r="3" fill="currentColor" />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.span
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ type: "spring", stiffness: 100, damping: 16 }}
                    className="font-mono text-6xl font-bold tracking-tight text-ink"
                >
                    {yes}%
                </motion.span>
                <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
                    implied P(YES)
                </span>
                <div className="mt-4 flex h-1.5 w-40 overflow-hidden rounded-full bg-line">
                    <motion.div
                        className="bg-ink"
                        initial={{ width: 0 }}
                        whileInView={{ width: `${yes}%` }}
                        viewport={{ once: true }}
                        transition={{ type: "spring", stiffness: 80, damping: 20, delay: 0.15 }}
                    />
                </div>
            </div>
        </div>
    );
}

export default function MarketCard({
    market,
    containerRef,
}: {
    market: Market;
    containerRef: RefObject<HTMLDivElement | null>;
}) {
    const yes = Math.round(market.yesPrice * 100);
    const cardRef = useRef<HTMLDivElement>(null);
    const { scale, rotateY, opacity } = useCoverflow(containerRef, cardRef);

    return (
        <motion.div
            ref={cardRef}
            style={{ scale, rotateY, opacity, transformPerspective: 1200 }}
            className="flex w-[340px] shrink-0 snap-center flex-col rounded-2xl border border-line bg-surface p-4 will-change-transform sm:w-[380px]"
        >
            <VisualPanel yes={yes} />

            <div className="flex flex-1 flex-col px-1 pt-5">
                <div className="flex items-start justify-between gap-3">
                    <h3 className="text-[16px] font-semibold leading-snug">
                        {market.question}
                    </h3>
                    <span className="shrink-0 rounded-full bg-primary-soft px-2.5 py-1 font-mono text-[10px] font-medium">
                        {market.closesIn}
                    </span>
                </div>

                <p className="mt-2 text-[13px] leading-relaxed text-muted">
                    {market.volume} USDC volume · {market.trades} trades ·{" "}
                    {market.agentCount} agents trading autonomously.
                </p>

                <div className="mt-auto pt-5">
                    <button className="rounded-full bg-ink px-5 py-2.5 text-[13px] font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]">
                        View market
                    </button>
                </div>
            </div>
        </motion.div>
    );
}