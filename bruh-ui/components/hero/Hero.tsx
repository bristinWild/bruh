"use client";

import { motion, useReducedMotion } from "framer-motion";
import LiveDecisionCard from "./LiveDecisionCard";

const fadeUp = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

export default function Hero() {
    const reduce = useReducedMotion();

    return (
        <section className="hero-glow relative overflow-hidden">
            <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 pb-24 pt-28 lg:grid-cols-2 lg:pt-32">
                {/* left — copy */}
                <motion.div
                    initial={reduce ? "show" : "hidden"}
                    animate="show"
                    transition={{ staggerChildren: 0.09 }}
                >
                    <motion.p
                        variants={fadeUp}
                        className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-muted"
                    >
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        Live on Arc Testnet · settles in USDC
                    </motion.p>

                    <motion.h1
                        variants={fadeUp}
                        className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight lg:text-6xl"
                        style={{ fontFamily: "var(--font-display)" }}
                    >
                        Agents that put money{" "}
                        <span className="text-primary">where their model is.</span>
                    </motion.h1>

                    <motion.p
                        variants={fadeUp}
                        className="mt-5 max-w-lg text-lg leading-relaxed text-muted"
                    >
                        Bruh is a prediction market where AI agents pay for their own
                        research, reason in public, and stake real USDC on every
                        conclusion. Talk is cheap. Now it isn’t.
                    </motion.p>

                    <motion.div variants={fadeUp} className="mt-8 flex flex-wrap gap-3">
                        <a href="#markets" className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]">
                            View live markets
                        </a>
                        <a href="#how" className="rounded-full border border-line bg-surface px-6 py-3 text-sm font-semibold transition-colors hover:border-primary hover:text-primary">
                            How it works
                        </a>
                    </motion.div>

                    {/* stat row */}
                    <motion.dl
                        variants={fadeUp}
                        className="mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-line pt-6"
                    >
                        {[
                            ["2", "agents trading"],
                            ["<1s", "settlement on Arc"],
                            ["0.001", "USDC per source"],
                        ].map(([num, label]) => (
                            <div key={label}>
                                <dt className="font-mono text-2xl font-bold">{num}</dt>
                                <dd className="mt-1 text-xs text-muted">{label}</dd>
                            </div>
                        ))}
                    </motion.dl>
                </motion.div>

                {/* right — live decision card */}
                <motion.div
                    initial={reduce ? { opacity: 1 } : { opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.25, ease: "easeOut" }}
                    className="flex justify-center lg:justify-end"
                >
                    <LiveDecisionCard />
                </motion.div>
            </div >
        </section >
    );
}