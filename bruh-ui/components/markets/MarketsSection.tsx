"use client";

import {
    useEffect,
    useRef,
    useState,
} from "react";
import {
    motion,
    useReducedMotion,
} from "framer-motion";
import MarketCard, {
    type Market,
} from "./MarketCard";

const MOCK_MARKETS: Market[] = [
    {
        id: "1",
        question: "Will ETH close above $4,000 this Friday?",
        yesPrice: 0.64,
        volume: 142,
        closesIn: "2d 14h",
        agentCount: 2,
        trades: 18,
    },
    {
        id: "2",
        question: "Will the Fed announce a rate cut in September?",
        yesPrice: 0.41,
        volume: 89,
        closesIn: "6d 8h",
        agentCount: 2,
        trades: 11,
    },
    {
        id: "3",
        question: "Will Bitcoin ETF inflows exceed $1B this week?",
        yesPrice: 0.73,
        volume: 214,
        closesIn: "1d 3h",
        agentCount: 2,
        trades: 27,
    },
    {
        id: "4",
        question: "Will OpenAI release a new model before August?",
        yesPrice: 0.55,
        volume: 67,
        closesIn: "12d 6h",
        agentCount: 2,
        trades: 8,
    },
    {
        id: "5",
        question: "Will Solana process over 150M transactions tomorrow?",
        yesPrice: 0.58,
        volume: 301,
        closesIn: "18h",
        agentCount: 2,
        trades: 34,
    }
];

export default function MarketsSection() {
    const reduce = useReducedMotion();
    const scrollRef = useRef<HTMLDivElement>(null);
    const [activeIndex, setActiveIndex] = useState(2);

    /*
     * Start on the second card.
     * This gives the carousel content on both sides.
     */
    useEffect(() => {
        const container = scrollRef.current;

        if (!container) return;

        const frame = window.requestAnimationFrame(() => {
            const cards =
                container.querySelectorAll<HTMLElement>(
                    "[data-market-card]",
                );

            const initialCard = cards[2];

            if (!initialCard) return;

            const left =
                initialCard.offsetLeft -
                container.clientWidth / 2 +
                initialCard.clientWidth / 2;

            container.scrollTo({
                left,
                behavior: "auto",
            });
        });

        return () => window.cancelAnimationFrame(frame);
    }, []);

    /*
     * Track whichever card is closest to the center.
     */
    useEffect(() => {
        const container = scrollRef.current;

        if (!container) return;

        let frame = 0;

        const updateActiveCard = () => {
            cancelAnimationFrame(frame);

            frame = requestAnimationFrame(() => {
                const cards =
                    container.querySelectorAll<HTMLElement>(
                        "[data-market-card]",
                    );

                const center =
                    container.scrollLeft +
                    container.clientWidth / 2;

                let closestIndex = 0;
                let closestDistance = Infinity;

                cards.forEach((card, index) => {
                    const cardCenter =
                        card.offsetLeft +
                        card.clientWidth / 2;

                    const distance = Math.abs(
                        cardCenter - center,
                    );

                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestIndex = index;
                    }
                });

                setActiveIndex(closestIndex);
            });
        };

        updateActiveCard();

        container.addEventListener(
            "scroll",
            updateActiveCard,
            {
                passive: true,
            },
        );

        return () => {
            cancelAnimationFrame(frame);
            container.removeEventListener(
                "scroll",
                updateActiveCard,
            );
        };
    }, []);

    const scrollToMarket = (index: number) => {
        const container = scrollRef.current;

        if (!container) return;

        const cards =
            container.querySelectorAll<HTMLElement>(
                "[data-market-card]",
            );

        const card = cards[index];

        if (!card) return;

        const left =
            card.offsetLeft -
            container.clientWidth / 2 +
            card.clientWidth / 2;

        container.scrollTo({
            left,
            behavior: reduce ? "auto" : "smooth",
        });
    };

    return (
        <section
            id="markets"
            className="relative overflow-hidden pb-10 pt-20"
        >
            {/* Background */}
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-[-160px] top-32 h-[420px] w-[420px] rounded-full bg-violet-300/10 blur-[140px]" />

                <div className="absolute right-[-160px] top-40 h-[420px] w-[420px] rounded-full bg-blue-300/10 blur-[140px]" />
            </div>

            {/* Header */}
            <motion.div
                initial={
                    reduce
                        ? {
                            opacity: 1,
                        }
                        : {
                            opacity: 0,
                            y: 16,
                        }
                }
                whileInView={{
                    opacity: 1,
                    y: 0,
                }}
                viewport={{
                    once: true,
                }}
                transition={{
                    duration: 0.45,
                }}
                className="relative mx-auto mb-12 flex max-w-2xl flex-col items-center px-6 text-center"
            >
                <div className="inline-flex overflow-hidden rounded-full bg-gradient-to-r from-violet-400 to-blue-400 p-px">
                    <div className="flex items-center gap-2 rounded-full bg-[#fbf8f2] px-4 py-2">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-500 opacity-40" />

                            <span className="relative h-2 w-2 rounded-full bg-violet-500" />
                        </span>

                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
                            Live markets
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
                    Where agents put{" "}
                    <span className="bg-gradient-to-r from-violet-600 to-blue-500 bg-clip-text text-transparent">
                        their money
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
                    Binary outcome markets on Arc. Agents research,
                    reason, and stake USDC autonomously as prices
                    update with every trade.
                </p>
            </motion.div>

            {/* Carousel */}
            <div
                ref={scrollRef}
                className="
                    scrollbar-none
                    relative
                    flex
                    snap-x
                    snap-mandatory
                    gap-6
                    overflow-x-auto
                    px-[calc(50vw-170px)]
                    pb-9
                    pt-4
                    sm:px-[calc(50vw-195px)]
                "
            >
                {MOCK_MARKETS.map((market, index) => (
                    <MarketCard
                        key={market.id}
                        market={market}
                        index={index}
                        containerRef={scrollRef}
                    />
                ))}
            </div>

            {/* Carousel position */}
            <div className="relative mt-1 flex items-center justify-center gap-2">
                {MOCK_MARKETS.map((market, index) => (
                    <button
                        key={market.id}
                        type="button"
                        onClick={() => scrollToMarket(index)}
                        aria-label={`View market ${index + 1}`}
                        className="relative h-2 rounded-full transition-all duration-300"
                        style={{
                            width:
                                activeIndex === index
                                    ? 28
                                    : 8,
                            background:
                                activeIndex === index
                                    ? "linear-gradient(90deg, #8B5CF6, #3B82F6)"
                                    : "rgba(100, 116, 139, 0.25)",
                        }}
                    />
                ))}
            </div>
        </section>
    );
}