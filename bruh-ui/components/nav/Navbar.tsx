"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import Image from "next/image";


const NAV_LINKS = [
    { label: "Markets", href: "#markets" },
    { label: "Agents", href: "#agents" },
    { label: "How it works", href: "#how" },
    { label: "Docs", href: "#" },
];

export default function Navbar() {
    const reduce = useReducedMotion();
    const { scrollY } = useScroll();

    const bgOpacity = useTransform(scrollY, [0, 40], [0, 1]);
    const borderOpacity = useTransform(scrollY, [0, 40], [0, 1]);

    return (
        <motion.header
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="fixed inset-x-0 top-0 z-50"
        >
            <motion.div
                className="absolute inset-0 bg-white/85 backdrop-blur-md"
                style={{ opacity: bgOpacity }}
            />
            <motion.div
                className="absolute inset-x-0 bottom-0 h-px bg-line"
                style={{ opacity: borderOpacity }}
            />

            <nav className="relative mx-auto flex max-w-6xl items-center px-6 py-2">

                {/* left — logo wordmark */}
                <Link href="/" className="flex items-center shrink-0">
                    <Image
                        src="/bruh-new.png"
                        alt="Bruh"
                        width={840}
                        height={744}
                        className="h-12 w-auto"
                    />
                </Link>

                {/* center — nav links */}
                <ul className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-2">
                    {NAV_LINKS.map((link) => (
                        <li key={link.label}>
                            <Link
                                href={link.href}
                                className="rounded-full px-4 py-2 text-[13px] font-semibold uppercase tracking-wider text-muted transition-colors hover:bg-primary-soft hover:text-ink"
                            >
                                {link.label}
                            </Link>
                        </li>
                    ))}
                </ul>

                {/* right — status + CTA */}
                <div className="ml-auto flex items-center gap-5">
                    <div className="hidden sm:flex items-center gap-2 text-[12px] font-medium uppercase tracking-wider text-muted">
                        <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yes opacity-60" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-yes" />
                        </span>
                        Arc Testnet
                    </div>

                    <Link
                        href="#markets"
                        className="flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98] -mr-10"
                    >
                        View markets
                        <span className="text-[11px] opacity-60">↗</span>
                    </Link>
                </div>

            </nav>
        </motion.header>
    );
}