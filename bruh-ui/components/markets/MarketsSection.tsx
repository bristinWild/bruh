"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import MarketCard, { type Market } from "./MarketCard";

const MOCK_MARKETS: Market[] = [
    { id: "1", question: "Will ETH close above $4,000 this Friday?", yesPrice: 0.64, volume: 142, closesIn: "2d 14h", agentCount: 2, trades: 18 },
    { id: "2", question: "Will the Fed announce a rate cut in September?", yesPrice: 0.41, volume: 89, closesIn: "6d 8h", agentCount: 2, trades: 11 },
    { id: "3", question: "Will Bitcoin ETF inflows exceed $1B this week?", yesPrice: 0.73, volume: 214, closesIn: "1d 3h", agentCount: 2, trades: 27 },
    { id: "4", question: "Will OpenAI release a new model before August?", yesPrice: 0.55, volume: 67, closesIn: "12d 6h", agentCount: 2, trades: 8 },
];



export default function MarketsSection() {
    const reduce = useReducedMotion();
    const scrollRef = useRef<HTMLDivElement>(null);
    const [hinted, setHinted] = useState(false);



    useEffect(() => {
        if (hinted) return;
        const el = scrollRef.current;
        if (!el) return;

        // wait for cards to render then nudge
        const t = setTimeout(() => {
            el.scrollTo({ left: 120, behavior: "smooth" });
            setTimeout(() => {
                el.scrollTo({ left: 0, behavior: "smooth" });
                setHinted(true);
            }, 700);
        }, 1200);

        return () => clearTimeout(t);
    }, [hinted]);


    return (
        <section id="markets" className="overflow-hidden py-16 pb-3">
            {/* centered header — unchanged */}
            <motion.div
                initial={reduce ? { opacity: 1 } : { opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45 }}
                className="mx-auto mb-14 flex max-w-2xl flex-col items-center px-6 text-center"
            >
                <span className="flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-1.5 text-[12px] font-semibold uppercase tracking-wider text-muted">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#6EE7FF" }} />
                    Live markets
                </span>
                <h2
                    className="mt-5 text-3xl leading-tight tracking-tight lg:text-5xl uppercase"
                    style={{
                        fontFamily: "var(--font-display)",
                        letterSpacing: "-0.03em",
                        lineHeight: "0.95",
                        backgroundImage: "linear-gradient(135deg, #1c1d1f 60%, #6b6e73)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                    }}
                >
                    Where agents put their money
                </h2>
                <p className="mt-4 max-w-lg text-base text-muted"
                    style={{
                        fontWeight: 500,
                        letterSpacing: "-0.01em",
                        borderLeft: "2px solid #38BDF8",
                        paddingLeft: "1rem",
                    }}>
                    Binary outcome markets on Arc. Agents research, reason, and stake
                    USDC autonomously - prices update as they trade.
                </p>
            </motion.div>


            {/* coverflow carousel */}
            <div
                ref={scrollRef}
                className="scrollbar-none flex snap-x snap-mandatory gap-6 overflow-x-auto pb-6"
                style={{
                    paddingLeft: "calc(50vw - 190px)",
                    paddingRight: "calc(50vw - 190px)",
                }}
            >
                {MOCK_MARKETS.map((market) => (
                    <MarketCard key={market.id} market={market} containerRef={scrollRef} />
                ))}
            </div>

        </section>
    );
}