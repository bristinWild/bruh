"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
    ArrowUpRight,
    CircleDot,

    Sparkles,
} from "lucide-react";
import Image from "next/image";

const FOOTER_LINKS = {
    Product: [
        { label: "Markets", href: "#markets" },
        { label: "Agents", href: "#agents" },
        { label: "How it works", href: "#how" },
    ],
    Resources: [
        { label: "Docs", href: "#" },
        { label: "GitHub", href: "#" },
        { label: "Arcscan", href: "#" },
    ],
    "Built with": [
        { label: "Arc Testnet", href: "#" },
        { label: "Circle USDC", href: "#" },
        { label: "x402 Protocol", href: "#" },
        { label: "ERC-8183", href: "#" },
    ],
};

export default function Footer() {
    const reduceMotion = useReducedMotion();

    return (
        <>

            {/* Actual footer */}
            <footer className="relative border-t border-black/10 bg-[#faf8f3]">
                <div className="mx-auto max-w-6xl px-6 py-14">
                    <div className="grid gap-12 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
                        {/* Brand */}
                        <div>

                            <Image
                                src="/bruh-new-logo-wbg.png"
                                alt="Bruh"
                                width={840}
                                height={744}
                                className="h-14 w-auto"
                                priority={false}
                            />


                            <p className="mt-5 max-w-[260px] text-[12px] font-medium leading-[1.7] text-slate-500">
                                Autonomous forecasting agents powered
                                by programmable money and transparent
                                onchain execution.
                            </p>

                            <div className="mt-6 flex items-center gap-2">


                                <a
                                    href="#"
                                    className="flex h-9 items-center gap-2 rounded-[10px] border border-black/10 px-3 text-[9px] font-black uppercase tracking-[0.12em] text-slate-500 transition-colors hover:border-blue-300 hover:text-blue-600"
                                >
                                    <CircleDot className="h-3.5 w-3.5" />
                                    Arcscan
                                </a>
                            </div>
                        </div>

                        {/* Links */}
                        {Object.entries(FOOTER_LINKS).map(
                            ([heading, items]) => (
                                <div key={heading}>
                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-950">
                                        {heading}
                                    </p>

                                    <ul className="mt-5 flex flex-col gap-3">
                                        {items.map((item) => (
                                            <li key={item.label}>
                                                <a
                                                    href={item.href}
                                                    className="group inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-500 transition-colors hover:text-violet-600"
                                                >
                                                    {item.label}

                                                    <ArrowUpRight className="h-3 w-3 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ),
                        )}
                    </div>

                    {/* Bottom bar */}
                    <div className="mt-12 flex flex-col gap-4 border-t border-black/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
                        <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                            © 2026 Bruh
                        </p>

                        <div className="flex flex-wrap items-center gap-3">
                            <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                                Built on Arc
                            </span>

                            <span className="h-1 w-1 rounded-full bg-slate-300" />

                            <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                                Encode × Circle
                            </span>

                            <span className="h-1 w-1 rounded-full bg-slate-300" />

                            <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                                Agentic Economy
                            </span>
                        </div>
                    </div>
                </div>
            </footer>
        </>
    );
}