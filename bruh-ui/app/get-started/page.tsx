"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useAccount, useSignMessage } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft,
    ArrowRight,
    Check,
    Fingerprint,
    LockKeyhole,
    ShieldCheck,
    Sparkles,
    Wallet,
    Zap,
} from "lucide-react";
import { getNonce, verifySignature } from "@/src/lib/api";

export default function GetStarted() {
    const reduceMotion = useReducedMotion();
    const router = useRouter();

    const { address, isConnected } = useAccount();
    const { signMessageAsync } = useSignMessage();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleAuth() {
        if (!address || loading) return;

        setLoading(true);
        setError(null);

        try {
            const message = await getNonce();

            const signature = await signMessageAsync({
                message,
            });

            const jwt = await verifySignature(
                address,
                signature,
                message,
            );

            localStorage.setItem("bruh_token", jwt);

            router.push("/dashboard");
        } catch (error: unknown) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Authentication failed. Please try again.";

            setError(message);
            setLoading(false);
        }
    }

    const shortenedAddress = address
        ? `${address.slice(0, 6)}...${address.slice(-4)}`
        : "";

    return (
        <main className="relative min-h-screen overflow-hidden bg-[#f7f6f2] px-6 py-8">
            {/* Background */}
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-[-220px] top-[-100px] h-[520px] w-[520px] rounded-full bg-violet-300/15 blur-[160px]" />

                <div className="absolute bottom-[-180px] right-[-200px] h-[520px] w-[520px] rounded-full bg-blue-300/15 blur-[160px]" />

                <div
                    className="absolute inset-0 opacity-[0.025]"
                    style={{
                        backgroundImage: `
                            linear-gradient(
                                to right,
                                rgba(99,102,241,0.2) 1px,
                                transparent 1px
                            ),
                            linear-gradient(
                                to bottom,
                                rgba(99,102,241,0.2) 1px,
                                transparent 1px
                            )
                        `,
                        backgroundSize: "48px 48px",
                    }}
                />

                <motion.div
                    className="absolute left-[12%] top-[22%] h-2 w-2 rounded-full bg-violet-400"
                    animate={
                        reduceMotion
                            ? undefined
                            : {
                                y: [0, -14, 0],
                                opacity: [0.2, 0.75, 0.2],
                            }
                    }
                    transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />

                <motion.div
                    className="absolute bottom-[18%] right-[14%] h-1.5 w-1.5 rounded-full bg-blue-400"
                    animate={
                        reduceMotion
                            ? undefined
                            : {
                                y: [0, 12, 0],
                                opacity: [0.2, 0.7, 0.2],
                            }
                    }
                    transition={{
                        duration: 5,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 0.8,
                    }}
                />
            </div>

            {/* Back link */}
            <div className="relative z-10 mx-auto max-w-6xl">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 transition-colors hover:text-violet-600"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back home
                </Link>
            </div>

            <div className="relative z-10 mx-auto flex min-h-[calc(100vh-80px)] max-w-6xl items-center justify-center py-10">
                <motion.section
                    initial={
                        reduceMotion
                            ? { opacity: 1 }
                            : {
                                opacity: 0,
                                y: 24,
                                scale: 0.98,
                            }
                    }
                    animate={{
                        opacity: 1,
                        y: 0,
                        scale: 1,
                    }}
                    transition={{
                        duration: 0.55,
                        ease: [0.22, 1, 0.36, 1],
                    }}
                    className="grid w-full max-w-5xl overflow-hidden rounded-[32px] border border-violet-200/70 bg-[#fffdf8]/90 shadow-[0_35px_90px_-55px_rgba(79,70,229,0.55)] backdrop-blur-xl lg:grid-cols-[1.08fr_0.92fr]"
                >
                    {/* Left side */}
                    <div
                        className="relative overflow-hidden border-b border-black/10 px-7 py-10 sm:px-10 sm:py-14 lg:border-b-0 lg:border-r"
                        style={{
                            background: `
                                radial-gradient(
                                    circle at 15% 10%,
                                    rgba(139,92,246,0.13),
                                    transparent 35%
                                ),
                                radial-gradient(
                                    circle at 85% 90%,
                                    rgba(59,130,246,0.11),
                                    transparent 38%
                                ),
                                linear-gradient(
                                    145deg,
                                    #fffdf8,
                                    #f8f3eb
                                )
                            `,
                        }}
                    >
                        <div
                            className="pointer-events-none absolute inset-0 opacity-[0.026] mix-blend-multiply"
                            style={{
                                backgroundImage:
                                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='.9'/%3E%3C/svg%3E\")",
                            }}
                        />

                        <div className="relative">
                            <div className="inline-flex rounded-full bg-gradient-to-r from-violet-500 to-blue-500 p-px">
                                <div className="flex items-center gap-2 rounded-full bg-[#fbf8f2] px-4 py-2">
                                    <Sparkles className="h-3.5 w-3.5 text-violet-600" />

                                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-600">
                                        Secure wallet access
                                    </span>
                                </div>
                            </div>

                            <h1
                                className="mt-7 max-w-lg text-[42px] font-black uppercase leading-[0.92] tracking-[-0.055em] text-slate-950 sm:text-[56px]"
                                style={{
                                    fontFamily: "var(--font-display)",
                                }}
                            >
                                Enter the{" "}
                                <span className="bg-gradient-to-r from-violet-600 to-blue-500 bg-clip-text text-transparent">
                                    agent economy.
                                </span>
                            </h1>

                            <p className="mt-6 max-w-lg text-[15px] font-medium leading-[1.75] text-slate-600">
                                Connect your wallet and verify ownership
                                with a gasless signature to access your
                                Bruh agent dashboard.
                            </p>

                            <div className="mt-9 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                                <FeatureCard
                                    icon={LockKeyhole}
                                    title="No password"
                                    description="Your wallet is your identity."
                                />

                                <FeatureCard
                                    icon={ShieldCheck}
                                    title="Non-custodial"
                                    description="You always control your funds."
                                />

                                <FeatureCard
                                    icon={Zap}
                                    title="Gasless login"
                                    description="Signing costs no gas."
                                />
                            </div>

                            <div className="mt-10 border-t border-black/10 pt-6">
                                <p className="text-[8px] font-black uppercase tracking-[0.18em] text-slate-400">
                                    Powered by
                                </p>

                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    {[
                                        "Arc Testnet",
                                        "Circle USDC",
                                        "RainbowKit",
                                        "Wallet signatures",
                                    ].map((item) => (
                                        <span
                                            key={item}
                                            className="rounded-full border border-black/10 bg-white/60 px-3 py-1.5 font-mono text-[8px] font-black uppercase tracking-[0.12em] text-slate-500"
                                        >
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right side */}
                    <div className="relative flex items-center px-7 py-10 sm:px-10 sm:py-14">
                        <div className="w-full">
                            {/* Animated icon */}
                            <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center">
                                <motion.div
                                    className="absolute h-24 w-24 rounded-[30px] bg-gradient-to-br from-violet-500/25 to-blue-500/25 blur-2xl"
                                    animate={
                                        reduceMotion
                                            ? undefined
                                            : {
                                                scale: [
                                                    0.9,
                                                    1.12,
                                                    0.9,
                                                ],
                                                opacity: [
                                                    0.2,
                                                    0.48,
                                                    0.2,
                                                ],
                                            }
                                    }
                                    transition={{
                                        duration: 3,
                                        repeat: Infinity,
                                        ease: "easeInOut",
                                    }}
                                />

                                <motion.div
                                    className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-[25px] border border-white/80"
                                    style={{
                                        background: `
                                            linear-gradient(
                                                145deg,
                                                rgba(255,255,255,0.9),
                                                rgba(139,92,246,0.18)
                                            )
                                        `,
                                        boxShadow:
                                            "inset 0 0 0 1px rgba(255,255,255,0.7), 0 22px 40px -28px rgba(79,70,229,0.7)",
                                    }}
                                    animate={
                                        reduceMotion
                                            ? undefined
                                            : {
                                                y: [0, -4, 0],
                                                rotate: [0, 2, -2, 0],
                                            }
                                    }
                                    transition={{
                                        duration: 4,
                                        repeat: Infinity,
                                        ease: "easeInOut",
                                    }}
                                >
                                    <Wallet className="h-8 w-8 text-violet-600" />

                                    <motion.div
                                        className="absolute right-3 top-3 h-2 w-2 rounded-full bg-blue-500"
                                        animate={
                                            reduceMotion
                                                ? undefined
                                                : {
                                                    scale: [
                                                        0.8,
                                                        1.35,
                                                        0.8,
                                                    ],
                                                    opacity: [
                                                        0.4,
                                                        1,
                                                        0.4,
                                                    ],
                                                }
                                        }
                                        transition={{
                                            duration: 2,
                                            repeat: Infinity,
                                            ease: "easeInOut",
                                        }}
                                    />
                                </motion.div>
                            </div>

                            <div className="text-center">
                                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-violet-600">
                                    Step 01
                                </p>

                                <h2
                                    className="mt-3 text-[30px] font-black uppercase tracking-[-0.04em] text-slate-950"
                                    style={{
                                        fontFamily:
                                            "var(--font-display)",
                                    }}
                                >
                                    {isConnected
                                        ? "Verify your wallet"
                                        : "Connect your wallet"}
                                </h2>

                                <p className="mx-auto mt-3 max-w-sm text-[13px] font-medium leading-[1.7] text-slate-500">
                                    {isConnected
                                        ? "Sign a secure message to prove ownership and continue to your dashboard."
                                        : "Choose a supported wallet to begin. No account registration is required."}
                                </p>
                            </div>

                            {isConnected && address && (
                                <div className="mt-7 flex items-center justify-between rounded-[16px] border border-violet-200 bg-violet-50/70 px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-gradient-to-br from-violet-500 to-blue-500 text-white">
                                            <Fingerprint className="h-4 w-4" />
                                        </div>

                                        <div>
                                            <p className="text-[7px] font-black uppercase tracking-[0.15em] text-slate-400">
                                                Connected wallet
                                            </p>

                                            <p className="mt-1 font-mono text-[11px] font-black text-slate-700">
                                                {shortenedAddress}
                                            </p>
                                        </div>
                                    </div>

                                    <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1.5 text-[8px] font-black uppercase tracking-[0.12em] text-emerald-700">
                                        <Check className="h-3 w-3" />
                                        Connected
                                    </span>
                                </div>
                            )}

                            <div className="mt-7">
                                {!isConnected ? (
                                    <ConnectButton.Custom>
                                        {({
                                            openConnectModal,
                                        }) => (
                                            <motion.button
                                                type="button"
                                                onClick={
                                                    openConnectModal
                                                }
                                                whileHover={
                                                    reduceMotion
                                                        ? undefined
                                                        : {
                                                            y: -3,
                                                            scale: 1.01,
                                                        }
                                                }
                                                whileTap={{
                                                    scale: 0.98,
                                                }}
                                                className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-[15px] px-5 py-4 text-[11px] font-black uppercase tracking-[0.12em] text-white"
                                                style={{
                                                    background:
                                                        "linear-gradient(135deg, #8B5CF6, #3B82F6)",
                                                    boxShadow:
                                                        "0 18px 36px -22px rgba(79,70,229,0.75)",
                                                }}
                                            >
                                                {!reduceMotion && (
                                                    <motion.span
                                                        className="absolute inset-y-0 w-24 bg-white/25 blur-xl"
                                                        animate={{
                                                            x: [
                                                                -140,
                                                                520,
                                                            ],
                                                        }}
                                                        transition={{
                                                            duration: 3,
                                                            repeat: Infinity,
                                                            ease: "linear",
                                                        }}
                                                    />
                                                )}

                                                <Wallet className="relative h-4 w-4" />

                                                <span className="relative">
                                                    Connect wallet
                                                </span>

                                                <ArrowRight className="relative h-4 w-4" />
                                            </motion.button>
                                        )}
                                    </ConnectButton.Custom>
                                ) : (
                                    <motion.button
                                        type="button"
                                        onClick={handleAuth}
                                        disabled={loading}
                                        whileHover={
                                            loading ||
                                                reduceMotion
                                                ? undefined
                                                : {
                                                    y: -3,
                                                    scale: 1.01,
                                                }
                                        }
                                        whileTap={
                                            loading
                                                ? undefined
                                                : {
                                                    scale: 0.98,
                                                }
                                        }
                                        className="flex w-full items-center justify-center gap-2 rounded-[15px] px-5 py-4 text-[11px] font-black uppercase tracking-[0.12em] text-white disabled:cursor-not-allowed disabled:opacity-60"
                                        style={{
                                            background:
                                                "linear-gradient(135deg, #8B5CF6, #3B82F6)",
                                            boxShadow:
                                                "0 18px 36px -22px rgba(79,70,229,0.75)",
                                        }}
                                    >
                                        {loading ? (
                                            <>
                                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                                                Waiting for signature
                                            </>
                                        ) : (
                                            <>
                                                <Fingerprint className="h-4 w-4" />
                                                Sign in securely
                                                <ArrowRight className="h-4 w-4" />
                                            </>
                                        )}
                                    </motion.button>
                                )}
                            </div>

                            {error && (
                                <motion.div
                                    initial={{
                                        opacity: 0,
                                        y: 6,
                                    }}
                                    animate={{
                                        opacity: 1,
                                        y: 0,
                                    }}
                                    className="mt-4 rounded-[13px] border border-rose-200 bg-rose-50 px-4 py-3 text-center text-[10px] font-semibold leading-relaxed text-rose-600"
                                >
                                    {error}
                                </motion.div>
                            )}

                            <div className="mt-5 flex items-center justify-center gap-2 text-[9px] font-semibold text-slate-400">
                                <ShieldCheck className="h-3.5 w-3.5" />
                                Signing does not create a transaction or
                                cost gas.
                            </div>

                            <p className="mt-7 text-center text-[9px] font-medium leading-relaxed text-slate-400">
                                By continuing, you agree to Bruh&apos;s{" "}
                                <Link
                                    href="#"
                                    className="font-black text-slate-600 hover:text-violet-600"
                                >
                                    terms
                                </Link>{" "}
                                and{" "}
                                <Link
                                    href="#"
                                    className="font-black text-slate-600 hover:text-violet-600"
                                >
                                    privacy policy
                                </Link>
                                .
                            </p>
                        </div>
                    </div>
                </motion.section>
            </div>
        </main>
    );
}

function FeatureCard({
    icon: Icon,
    title,
    description,
}: {
    icon: typeof LockKeyhole;
    title: string;
    description: string;
}) {
    return (
        <div className="rounded-[16px] border border-black/10 bg-white/55 p-4 backdrop-blur-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-violet-50 text-violet-600">
                <Icon className="h-4 w-4" />
            </div>

            <p className="mt-4 text-[9px] font-black uppercase tracking-[0.14em] text-slate-800">
                {title}
            </p>

            <p className="mt-2 text-[10px] font-medium leading-[1.55] text-slate-500">
                {description}
            </p>
        </div>
    );
}