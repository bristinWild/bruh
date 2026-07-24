"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";

const LINKS = {
    Product: ["Markets", "Agents", "How it works", "Docs"],
    "Built with": ["Arc Testnet", "Circle USDC", "x402 Protocol", "ERC-8183"],
    Hackathon: ["Encode × Circle", "Agentic Economy", "Submit by Aug 9", "arcscan"],
};

export default function Footer() {
    const reduce = useReducedMotion();

    return (
        <footer className="relative overflow-hidden border-t border-line">

            {/* speed lines */}
            <div className="pointer-events-none absolute inset-0">
                <svg className="h-full w-full" viewBox="0 0 1440 320" preserveAspectRatio="xMidYMid slice" fill="none">
                    {[
                        { x1: 0, x2: 420, y: 40, op: 0.06, dur: 2.1 },
                        { x1: 0, x2: 680, y: 88, op: 0.04, dur: 1.7 },
                        { x1: 200, x2: 900, y: 130, op: 0.07, dur: 2.4 },
                        { x1: 0, x2: 560, y: 172, op: 0.05, dur: 1.9 },
                        { x1: 400, x2: 1100, y: 210, op: 0.08, dur: 2.6 },
                        { x1: 100, x2: 750, y: 248, op: 0.04, dur: 2.0 },
                        { x1: 0, x2: 440, y: 284, op: 0.06, dur: 1.8 },
                        { x1: 600, x2: 1440, y: 60, op: 0.05, dur: 2.3 },
                        { x1: 800, x2: 1440, y: 160, op: 0.07, dur: 1.6 },
                        { x1: 900, x2: 1440, y: 230, op: 0.04, dur: 2.2 },
                        { x1: 1000, x2: 1440, y: 300, op: 0.06, dur: 1.9 },
                    ].map((l, i) => (
                        <motion.line
                            key={i}
                            x1={l.x1} y1={l.y}
                            x2={l.x1} y2={l.y}
                            stroke="var(--color-ink)"
                            strokeWidth={i % 3 === 0 ? 1.5 : 0.75}
                            strokeLinecap="round"
                            opacity={l.op}
                            animate={reduce ? {} : {
                                x1: [l.x1, l.x2 + 200],
                                x2: [l.x1 + (l.x2 - l.x1), l.x2 + 200 + (l.x2 - l.x1)],
                            }}
                            transition={{ duration: l.dur, repeat: Infinity, ease: "linear", delay: i * 0.18 }}
                        />
                    ))}
                </svg>
            </div>


            {/* CTA strip — with logo */}
            <div className="relative pt-2 pb-4">
                <motion.div
                    initial={reduce ? { opacity: 1 } : { opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                    className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-6 text-center"
                >
                    <Image src="/bruh-new.png" alt="Bruh" width={540} height={444} className="h-78 w-auto -mb-8" />

                    <p className="max-w-md text-base text-muted pt-2">
                        Talk is cheap. For AI, now it isn't.
                        <br />
                        Agents that put money where their model is.
                    </p>

                    <div className="mt-4 flex flex-wrap gap-3">
                        <a href="#markets" className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-surface transition-transform hover:scale-[1.02] active:scale-[0.98]">
                            View live markets
                        </a>
                        <a href="https://github.com/bristinWild/bruh" target="_blank" rel="noreferrer" className="rounded-full border border-line bg-surface px-6 py-3 text-sm font-semibold transition-colors hover:border-ink">
                            GitHub
                        </a>
                    </div>
                </motion.div>
            </div>

            {/* links + meta */}
            <div className="relative mx-auto max-w-6xl px-6 py-15">
                <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">

                    {/* col 1 — description */}
                    <div className="col-span-2 sm:col-span-1 flex flex-col gap-3">
                        <p className="text-xs text-muted leading-relaxed">
                            Autonomous forecasting agents on Arc. Built for the Programmable Money Hackathon.
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yes opacity-60" />
                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-yes" />
                            </span>
                            Arc Testnet · live
                        </div>
                    </div>

                    {/* cols 2-4 — links */}
                    {Object.entries(LINKS).map(([heading, items]) => (
                        <div key={heading} className="flex flex-col gap-4">
                            <p className="text-[11px] font-semibold uppercase tracking-widest text-ink">
                                {heading}
                            </p>
                            <ul className="flex flex-col gap-2.5">
                                {items.map((item) => (
                                    <li key={item}>
                                        <a href="#" className="text-sm text-muted transition-colors hover:text-ink">
                                            {item}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}

                </div>

                {/* bottom bar */}
                <div className="mt-16 flex flex-col items-start gap-3 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-mono text-[11px] text-muted">
                        © 2026 Bruh · Built on Arc · Encode × Circle Hackathon
                    </p>
                    <div className="flex items-center gap-4">
                        <span className="font-mono text-[11px] text-muted">
                            Final submission: Sun 9 Aug 2026
                        </span>
                        <span className="h-1 w-1 rounded-full bg-line" />
                        <a href="#" className="font-mono text-[11px] text-muted transition-colors hover:text-ink">
                            arcscan
                        </a>
                    </div>
                </div>
            </div>

        </footer>
    );
}