"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAccount, useSignMessage } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useRouter } from "next/navigation";
import { getNonce, verifySignature } from "@/src/lib/api";

export default function GetStarted() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { address, isConnected } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const router = useRouter();

    useEffect(() => {
        if (isConnected && address) handleAuth();
    }, [isConnected, address]);

    async function handleAuth() {
        setLoading(true);
        setError(null);
        try {
            const message = await getNonce();
            const signature = await signMessageAsync({ message });
            const jwt = await verifySignature(address!, signature, message);
            localStorage.setItem("bruh_token", jwt);
            router.push("/dashboard");
        } catch (err: any) {
            setError(err.message || "Auth failed");
            setLoading(false);
        }
    }

    return (
        <div className="relative min-h-screen overflow-hidden bg-[#eef2f5] px-6">
            <div className="pointer-events-none absolute inset-0">
                <div
                    className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px]"
                    style={{
                        background:
                            "radial-gradient(circle, rgba(56,189,248,0.22), transparent 68%)",
                    }}
                />

                <motion.div
                    className="absolute left-[18%] top-[20%] h-2 w-2 rounded-full bg-cyan-300"
                    animate={{
                        y: [0, -14, 0],
                        opacity: [0.25, 0.8, 0.25],
                    }}
                    transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />

                <motion.div
                    className="absolute bottom-[22%] right-[20%] h-1.5 w-1.5 rounded-full bg-sky-400"
                    animate={{
                        y: [0, 12, 0],
                        opacity: [0.2, 0.7, 0.2],
                    }}
                    transition={{
                        duration: 5,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 0.8,
                    }}
                />
            </div>

            <div className="relative z-10 flex min-h-screen items-center justify-center py-16">
                <motion.div
                    initial={{ opacity: 0, y: 22, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{
                        duration: 0.55,
                        ease: [0.22, 1, 0.36, 1],
                    }}
                    className="relative w-full max-w-[440px] overflow-hidden rounded-[28px] border bg-white/90 p-8 backdrop-blur-xl sm:p-10"
                    style={{
                        borderColor: "rgba(56,189,248,0.22)",
                        boxShadow:
                            "0 30px 80px -32px rgba(14,165,233,0.34), 0 18px 45px -28px rgba(15,23,42,0.25), inset 0 0 0 1px rgba(255,255,255,0.8)",
                    }}
                >
                    <div
                        className="absolute left-1/2 top-0 h-px w-3/4 -translate-x-1/2"
                        style={{
                            background:
                                "linear-gradient(90deg, transparent, #38BDF8, #6EE7FF, transparent)",
                        }}
                    />

                    <div className="flex flex-col items-center text-center">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8, rotate: -6 }}
                            animate={{ opacity: 1, scale: 1, rotate: 0 }}
                            transition={{
                                delay: 0.12,
                                type: "spring",
                                stiffness: 260,
                                damping: 20,
                            }}
                            className="relative mb-7"
                        >
                            <motion.div
                                className="absolute inset-0 rounded-2xl blur-xl"
                                style={{
                                    background:
                                        "linear-gradient(135deg, rgba(56,189,248,0.55), rgba(110,231,255,0.4))",
                                }}
                                animate={{
                                    scale: [0.9, 1.15, 0.9],
                                    opacity: [0.25, 0.5, 0.25],
                                }}
                                transition={{
                                    duration: 3,
                                    repeat: Infinity,
                                    ease: "easeInOut",
                                }}
                            />

                            <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden">
                                <motion.div
                                    className="absolute h-12 w-12 rounded-full blur-[7px]"
                                    style={{
                                        background:
                                            "conic-gradient(from 0deg, #22D3EE, #3B82F6, #A855F7, #EC4899, #22D3EE)",
                                    }}
                                    animate={{
                                        rotate: 360,
                                        scale: [0.92, 1.08, 0.92],
                                    }}
                                    transition={{
                                        rotate: {
                                            duration: 5,
                                            repeat: Infinity,
                                            ease: "linear",
                                        },
                                        scale: {
                                            duration: 2.4,
                                            repeat: Infinity,
                                            ease: "easeInOut",
                                        },
                                    }}
                                />

                                <motion.div
                                    className="absolute h-10 w-10 rounded-full"
                                    style={{
                                        background:
                                            "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.95), rgba(125,211,252,0.55) 30%, rgba(99,102,241,0.45) 58%, rgba(236,72,153,0.28) 78%, transparent 100%)",
                                        boxShadow:
                                            "inset 0 0 12px rgba(255,255,255,0.75), 0 0 18px rgba(56,189,248,0.5)",
                                    }}
                                    animate={{
                                        scale: [0.94, 1.04, 0.97, 1.06, 0.94],
                                        borderRadius: [
                                            "48% 52% 55% 45% / 46% 48% 52% 54%",
                                            "55% 45% 48% 52% / 52% 45% 55% 48%",
                                            "46% 54% 45% 55% / 55% 52% 48% 45%",
                                            "52% 48% 54% 46% / 45% 55% 46% 54%",
                                            "48% 52% 55% 45% / 46% 48% 52% 54%",
                                        ],
                                    }}
                                    transition={{
                                        duration: 3.2,
                                        repeat: Infinity,
                                        ease: "easeInOut",
                                    }}
                                />

                                <motion.div
                                    className="absolute h-7 w-7 rounded-full blur-[4px]"
                                    style={{
                                        background:
                                            "linear-gradient(135deg, rgba(34,211,238,0.75), rgba(99,102,241,0.7), rgba(236,72,153,0.6))",
                                    }}
                                    animate={{
                                        x: [-2, 3, -1, 2, -2],
                                        y: [1, -2, 2, -1, 1],
                                        scale: [0.9, 1.12, 0.96, 1.08, 0.9],
                                    }}
                                    transition={{
                                        duration: 2.8,
                                        repeat: Infinity,
                                        ease: "easeInOut",
                                    }}
                                />

                                <motion.div
                                    className="absolute h-3 w-3 rounded-full bg-white/80 blur-[1px]"
                                    animate={{
                                        x: [-6, 5, -3, 4, -6],
                                        y: [-5, 2, 5, -3, -5],
                                        opacity: [0.45, 0.9, 0.55, 0.85, 0.45],
                                    }}
                                    transition={{
                                        duration: 3.5,
                                        repeat: Infinity,
                                        ease: "easeInOut",
                                    }}
                                />

                                <motion.div
                                    className="absolute h-[46px] w-[46px] rounded-full border border-white/40"
                                    animate={{
                                        scale: [0.85, 1.15, 0.85],
                                        opacity: [0.2, 0.55, 0.2],
                                    }}
                                    transition={{
                                        duration: 2.6,
                                        repeat: Infinity,
                                        ease: "easeInOut",
                                    }}
                                />
                            </div>
                        </motion.div>

                        <motion.span
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.18 }}
                            className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-600"
                        >
                            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                            Secure wallet login
                        </motion.span>

                        <motion.h1
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.22 }}
                            className="text-2xl font-bold tracking-tight text-ink"
                            style={{ fontFamily: "var(--font-display)" }}
                        >
                            Connect to Bruh
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.26 }}
                            className="mt-3 max-w-[320px] text-sm leading-relaxed text-muted"
                        >
                            Connect your wallet and sign a secure message to access
                            your autonomous agent dashboard.
                        </motion.p>

                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="mt-7 grid w-full grid-cols-3 gap-2"
                        >
                            {[
                                { label: "No password", icon: "✦" },
                                { label: "Non-custodial", icon: "◈" },
                                { label: "Arc ready", icon: "◎" },
                            ].map((item) => (
                                <div
                                    key={item.label}
                                    className="rounded-xl border px-2 py-3"
                                    style={{
                                        borderColor: "rgba(110,231,255,0.22)",
                                        background:
                                            "linear-gradient(135deg, rgba(56,189,248,0.05), rgba(255,255,255,0.8))",
                                    }}
                                >
                                    <p className="text-sm text-sky-500">
                                        {item.icon}
                                    </p>

                                    <p className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-muted">
                                        {item.label}
                                    </p>
                                </div>
                            ))}
                        </motion.div>

                        <div className="mt-7 w-full">
                            {!isConnected ? (
                                <ConnectButton.Custom>
                                    {({ openConnectModal }) => (
                                        <motion.button
                                            whileHover={{
                                                scale: 1.015,
                                                y: -2,
                                                boxShadow:
                                                    "0 18px 38px -16px rgba(14,165,233,0.7)",
                                            }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={openConnectModal}
                                            className="relative w-full overflow-hidden rounded-2xl py-4 text-sm font-semibold text-white"
                                            style={{
                                                background:
                                                    "linear-gradient(135deg, #38BDF8, #0EA5E9)",
                                                boxShadow:
                                                    "0 14px 30px -16px rgba(14,165,233,0.7)",
                                            }}
                                        >
                                            <motion.span
                                                className="absolute inset-y-0 w-24 bg-white/25 blur-xl"
                                                animate={{ x: [-120, 480] }}
                                                transition={{
                                                    duration: 2.8,
                                                    repeat: Infinity,
                                                    ease: "linear",
                                                }}
                                            />

                                            <span className="relative">
                                                Connect wallet →
                                            </span>
                                        </motion.button>
                                    )}
                                </ConnectButton.Custom>
                            ) : (
                                <motion.button
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleAuth}
                                    disabled={loading}
                                    className="relative w-full overflow-hidden rounded-2xl py-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                                    style={{
                                        background:
                                            "linear-gradient(135deg, #38BDF8, #0EA5E9)",
                                        boxShadow:
                                            "0 14px 30px -16px rgba(14,165,233,0.7)",
                                    }}
                                >
                                    <span className="relative flex items-center justify-center gap-2">
                                        {loading ? (
                                            <>
                                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                                                Authenticating…
                                            </>
                                        ) : (
                                            <>Sign in with wallet →</>
                                        )}
                                    </span>
                                </motion.button>
                            )}
                        </div>

                        {error && (
                            <p className="mt-4 text-xs font-medium text-red-500">
                                {error}
                            </p>
                        )}

                        <p className="mt-4 text-[10px] leading-relaxed text-muted">
                            Signing does not create a transaction or cost gas.
                        </p>
                    </div>
                </motion.div>
            </div>
        </div>
    );

}