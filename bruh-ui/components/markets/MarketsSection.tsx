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

import {
    getMarketAgentDecisions,
    getMarketStats,
    getPublicMarkets,
} from "@/src/lib/api";


function formatClosesIn(
    closeTime: string,
): string {
    const remaining =
        new Date(closeTime).getTime() -
        Date.now();

    if (remaining <= 0) {
        return "Closed";
    }

    const totalHours =
        Math.floor(
            remaining /
            3_600_000,
        );

    const days =
        Math.floor(
            totalHours / 24,
        );

    const hours =
        totalHours % 24;

    if (days > 0) {
        return `${days}d ${hours}h`;
    }

    return `${hours}h`;
}

export default function MarketsSection() {
    const reduce = useReducedMotion();
    const scrollRef = useRef<HTMLDivElement>(null);
    const [activeIndex, setActiveIndex] = useState(0);

    const [
        markets,
        setMarkets,
    ] =
        useState<
            Market[]
        >([]);

    const [
        loading,
        setLoading,
    ] =
        useState(true);

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

            const initialIndex =
                Math.min(
                    2,
                    cards.length -
                    1,
                );

            const initialCard =
                cards[
                initialIndex
                ];

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
    }, [markets.length]);

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

    useEffect(() => {
        let cancelled =
            false;

        async function loadMarkets() {
            try {
                setLoading(
                    true,
                );

                const publicMarkets =
                    await getPublicMarkets(
                        20,
                    );

                /*
                 * Landing page should only
                 * show currently tradable markets.
                 */
                const openMarkets =
                    publicMarkets.filter(
                        (
                            market,
                        ) =>
                            market.open &&
                            !market.resolved,
                    );

                const enrichedMarkets =
                    await Promise.all(
                        openMarkets.map(
                            async (
                                market,
                            ) => {
                                const [
                                    stats,
                                    agentDecisions,
                                ] =
                                    await Promise.all([
                                        getMarketStats(
                                            market.address,
                                        ),

                                        getMarketAgentDecisions(
                                            market.address,
                                            20,
                                        ),
                                    ]);

                                /*
                                 * Count unique autonomous
                                 * agents that have analyzed
                                 * this market.
                                 */
                                const agentCount =
                                    new Set(
                                        agentDecisions
                                            .map(
                                                (
                                                    decision,
                                                ) =>
                                                    decision.agentId,
                                            )
                                            .filter(
                                                Boolean,
                                            ),
                                    ).size;

                                const cardMarket:
                                    Market = {
                                    /*
                                     * IMPORTANT:
                                     * use address as id
                                     * because your market detail
                                     * route is address-based.
                                     */
                                    id:
                                        market.address,

                                    question:
                                        market.question,

                                    yesPrice:
                                        market.yesPrice,

                                    volume:
                                        stats.totalVolumeUsdc,

                                    closesIn:
                                        formatClosesIn(
                                            market.closeTime,
                                        ),

                                    agentCount,

                                    trades:
                                        stats.tradeCount,
                                };

                                return cardMarket;
                            },
                        ),
                    );

                if (
                    !cancelled
                ) {
                    setMarkets(
                        enrichedMarkets,
                    );

                    /*
                     * Keep active index valid
                     * when fewer than 3 markets exist.
                     */
                    setActiveIndex(
                        Math.min(
                            2,
                            Math.max(
                                enrichedMarkets.length -
                                1,
                                0,
                            ),
                        ),
                    );
                }
            } catch (error) {
                console.error(
                    "Failed to load landing markets:",
                    error,
                );

                if (
                    !cancelled
                ) {
                    setMarkets(
                        [],
                    );
                }
            } finally {
                if (
                    !cancelled
                ) {
                    setLoading(
                        false,
                    );
                }
            }
        }

        void loadMarkets();

        return () => {
            cancelled =
                true;
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
                {loading ? (
                    Array.from({
                        length: 3,
                    }).map(
                        (
                            _,
                            index,
                        ) => (
                            <div
                                key={index}
                                className="
                    h-[320px]
                    w-[340px]
                    shrink-0
                    animate-pulse
                    rounded-[24px]
                    border
                    border-black/5
                    bg-slate-200/60
                "
                            />
                        ),
                    )
                ) : markets.length === 0 ? (
                    <div className="mx-auto flex min-h-[260px] w-[340px] shrink-0 items-center justify-center rounded-[24px] border border-dashed border-black/10 bg-white/40 px-8 text-center">
                        <div>
                            <p className="text-[13px] font-black text-slate-700">
                                No open markets
                            </p>

                            <p className="mt-2 text-[10px] font-medium leading-5 text-slate-400">
                                There are currently no active prediction markets.
                            </p>
                        </div>
                    </div>
                ) : (
                    markets.map(
                        (
                            market,
                            index,
                        ) => (
                            <MarketCard
                                key={market.id}
                                market={market}
                                index={index}
                                containerRef={scrollRef}
                            />
                        ),
                    )
                )}
            </div>

            {/* Carousel position */}
            <div className="relative mt-1 flex items-center justify-center gap-2">
                {markets.map((market, index) => (
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