"use client";

import {
    AnimatePresence,
    motion,
    useReducedMotion,
    useScroll,
    useTransform,
} from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import {
    ArrowUpRight,
    Menu,
    X,
} from "lucide-react";
import { useState } from "react";

const NAV_LINKS = [
    { label: "Markets", href: "#markets" },
    { label: "Agents", href: "#agents" },
    { label: "How it works", href: "#how" },
    { label: "Docs", href: "#" },
];

export default function Navbar() {
    const reduceMotion = useReducedMotion();

    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <motion.header
            initial={
                reduceMotion
                    ? { opacity: 1 }
                    : { opacity: 0, y: -10 }
            }
            animate={{
                opacity: 1,
                y: 0,
            }}
            transition={{
                duration: 0.45,
                ease: [0.22, 1, 0.36, 1],
            }}
            className="relative z-50"
        >
            {/* Scrolled background */}


            <motion.nav
                className="relative mx-auto flex h-[72px] max-w-6xl items-center px-6"
            >
                {/* Logo */}
                <Link
                    href="/"
                    aria-label="Bruh home"
                    className="absolute left-6 top-1/2 flex -translate-y-1/2 items-center"
                >
                    <Image
                        src="/bruh-new-logo-wbg.png"
                        alt="Bruh"
                        width={840}
                        height={744}
                        priority
                        className="h-[62px] w-auto sm:h-[68px]"
                    />
                </Link>

                {/* Desktop navigation */}
                <div className="absolute left-1/2 hidden -translate-x-1/2 md:block">
                    <ul
                        className="flex items-center gap-1 rounded-full border px-1.5 py-1.5"
                        style={{
                            borderColor:
                                "rgba(99,102,241,0.12)",
                            background:
                                "rgba(255,253,248,0.68)",
                            boxShadow:
                                "0 10px 28px -24px rgba(79,70,229,0.5)",
                        }}
                    >
                        {NAV_LINKS.map((link) => (
                            <li key={link.label}>
                                <Link
                                    href={link.href}
                                    className="group relative block rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 transition-colors hover:text-violet-600"
                                >
                                    <span className="relative z-10">
                                        {link.label}
                                    </span>

                                    <span className="absolute inset-0 scale-90 rounded-full bg-gradient-to-r from-violet-100 to-blue-100 opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:opacity-100" />
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Right controls */}
                <div className="ml-auto flex items-center gap-3">
                    <div className="hidden items-center gap-2 rounded-full border border-black/10 bg-white/50 px-3 py-2 sm:flex">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-40" />

                            <span className="relative h-2 w-2 rounded-full bg-emerald-500" />
                        </span>

                        <span className="font-mono text-[8px] font-black uppercase tracking-[0.16em] text-slate-500">
                            Arc Testnet
                        </span>
                    </div>

                    <motion.div
                        whileHover={
                            reduceMotion
                                ? undefined
                                : { y: -2 }
                        }
                        whileTap={{
                            scale: 0.98,
                        }}
                        className="hidden sm:block"
                    >
                        <Link
                            href="/markets"
                            className="flex items-center gap-2 rounded-[13px] px-4 py-2.5 text-[10px] font-black text-white"
                            style={{
                                background:
                                    "linear-gradient(135deg, #8B5CF6, #3B82F6)",
                                boxShadow:
                                    "0 14px 28px -18px rgba(79,70,229,0.75)",
                            }}
                        >
                            View markets
                            <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                    </motion.div>

                    {/* Mobile toggle */}
                    <button
                        type="button"
                        aria-label={
                            mobileOpen
                                ? "Close navigation"
                                : "Open navigation"
                        }
                        onClick={() =>
                            setMobileOpen((open) => !open)
                        }
                        className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-black/10 bg-white/60 text-slate-700 md:hidden"
                    >
                        {mobileOpen ? (
                            <X className="h-4.5 w-4.5" />
                        ) : (
                            <Menu className="h-4.5 w-4.5" />
                        )}
                    </button>
                </div>
            </motion.nav>

            {/* Mobile menu */}
            <AnimatePresence>
                {mobileOpen && (
                    <motion.div
                        initial={
                            reduceMotion
                                ? { opacity: 1 }
                                : {
                                    opacity: 0,
                                    y: -10,
                                    scale: 0.98,
                                }
                        }
                        animate={{
                            opacity: 1,
                            y: 0,
                            scale: 1,
                        }}
                        exit={{
                            opacity: 0,
                            y: -10,
                            scale: 0.98,
                        }}
                        transition={{
                            duration: 0.22,
                        }}
                        className="px-4 pb-4 md:hidden"
                    >
                        <div
                            className="mx-auto max-w-6xl overflow-hidden rounded-[20px] border p-3"
                            style={{
                                borderColor:
                                    "rgba(99,102,241,0.14)",
                                background: `
                                    radial-gradient(
                                        circle at 10% 0%,
                                        rgba(139,92,246,0.1),
                                        transparent 36%
                                    ),
                                    rgba(255,253,248,0.96)
                                `,
                                boxShadow:
                                    "0 24px 55px -36px rgba(79,70,229,0.4)",
                            }}
                        >
                            <div className="flex flex-col gap-1">
                                {NAV_LINKS.map((link) => (
                                    <Link
                                        key={link.label}
                                        href={link.href}
                                        onClick={() =>
                                            setMobileOpen(false)
                                        }
                                        className="rounded-[12px] px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-slate-600 transition-colors hover:bg-violet-50 hover:text-violet-600"
                                    >
                                        {link.label}
                                    </Link>
                                ))}
                            </div>

                            <Link
                                href="/markets"
                                onClick={() =>
                                    setMobileOpen(false)
                                }
                                className="mt-3 flex items-center justify-center gap-2 rounded-[13px] px-4 py-3 text-[10px] font-black text-white"
                                style={{
                                    background:
                                        "linear-gradient(135deg, #8B5CF6, #3B82F6)",
                                }}
                            >
                                View markets
                                <ArrowUpRight className="h-3.5 w-3.5" />
                            </Link>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.header>
    );
}