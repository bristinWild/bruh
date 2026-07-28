"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount, useSignMessage, useConnect, useDisconnect } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { getNonce, verifySignature, createAgentWallet, getMyWallets, runAgent } from "@/src/lib/api";
type Step = "connect" | "choose" | "created" | "running";

const STRATEGIES = [
    {
        id: "newshound",
        name: "Newshound",
        tag: "News momentum",
        description: "Aggressive. Weights recent news and price action heavily. Trades fast on clear signals.",
        accent: "#38BDF8",
    },
    {
        id: "actuary",
        name: "Actuary",
        tag: "Base rates",
        description: "Conservative. Anchors on historical priors. Only trades when market is clearly mispriced.",
        accent: "#1c1d1f",
    },
    {
        id: "both",
        name: "Both Agents",
        tag: "Ensemble",
        description: "Run both strategies. Their disagreement is a signal. Their agreement is conviction.",
        accent: "#16A34A",
    },
];

export default function GetStarted() {
    const [step, setStep] = useState<Step>("connect");
    const [token, setToken] = useState<string | null>(null);
    const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
    const [wallet, setWallet] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { address, isConnected } = useAccount();
    const { signMessageAsync } = useSignMessage();

    // Auto-advance when wallet connects
    useEffect(() => {
        if (isConnected && step === "connect") {
            handleAuth();
        }
    }, [isConnected, address]);

    async function handleAuth() {
        if (!address) return;
        setLoading(true);
        setError(null);
        try {
            const message = await getNonce();
            const signature = await signMessageAsync({ message });
            const jwt = await verifySignature(address, signature, message);
            setToken(jwt);
            localStorage.setItem("bruh_token", jwt);

            // Check existing wallets
            const existing = await getMyWallets(jwt);
            if (existing?.length > 0) {
                setWallet(existing[0]);
                setStep("created");
            } else {
                setStep("choose");
            }
        } catch (err: any) {
            setError(err.message || "Auth failed");
        } finally {
            setLoading(false);
        }
    }

    async function handleCreate() {
        if (!token || !selectedStrategy) return;
        setLoading(true);
        setError(null);
        try {
            const w = await createAgentWallet(token, selectedStrategy);
            setWallet(w);
            setStep("created");
        } catch (err: any) {
            setError(err.message || "Failed to create wallet");
        } finally {
            setLoading(false);
        }
    }

    async function handleRun() {
        if (!token || !wallet) return;
        setLoading(true);
        try {
            await runAgent(token, wallet.id);
            setStep("running");
        } catch (err: any) {
            setError(err.message || "Failed to start agent");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-bg flex items-center justify-center px-6">
            <div className="w-full max-w-lg">

                {/* Logo */}
                <div className="mb-12 text-center">
                    <h1
                        className="text-4xl font-bold uppercase tracking-tight text-ink"
                        style={{ fontFamily: "var(--font-display)" }}
                    >
                        Get Started
                    </h1>
                    <p className="mt-2 text-sm text-muted">
                        Deploy an autonomous forecasting agent in 3 steps
                    </p>
                </div>

                {/* Progress */}
                <div className="flex items-center gap-2 mb-10 justify-center">
                    {["connect", "choose", "created"].map((s, i) => (
                        <div key={s} className="flex items-center gap-2">
                            <div
                                className="h-2 rounded-full transition-all duration-300"
                                style={{
                                    width: step === s ? "2rem" : "0.5rem",
                                    background: ["connect", "choose", "created", "running"].indexOf(step) >= i
                                        ? "#38BDF8" : "var(--color-line)",
                                }}
                            />
                        </div>
                    ))}
                </div>

                <AnimatePresence mode="wait">

                    {/* Step 1 — Connect */}
                    {step === "connect" && (
                        <motion.div
                            key="connect"
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -16 }}
                            className="rounded-2xl border border-line bg-surface p-8 flex flex-col items-center gap-6 text-center"
                        >
                            <div className="h-16 w-16 rounded-2xl border border-line bg-surface flex items-center justify-center mx-auto">
                                <span className="font-mono text-2xl font-bold text-ink">B</span>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>
                                    Connect your wallet
                                </h2>
                                <p className="mt-2 text-sm text-muted">
                                    Sign a message to authenticate. No password. No account.
                                </p>
                            </div>
                            <ConnectButton.Custom>
                                {({ openConnectModal }) => (
                                    <button
                                        onClick={openConnectModal}
                                        className="rounded-full px-8 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
                                        style={{ background: "#38BDF8" }}
                                    >
                                        Connect Wallet
                                    </button>
                                )}
                            </ConnectButton.Custom>
                            {loading && <p className="text-sm text-muted animate-pulse">Signing in...</p>}
                            {error && <p className="text-sm text-no">{error}</p>}
                        </motion.div>
                    )}

                    {/* Step 2 — Choose strategy */}
                    {step === "choose" && (
                        <motion.div
                            key="choose"
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -16 }}
                            className="flex flex-col gap-4"
                        >
                            <h2 className="text-xl font-bold text-ink text-center" style={{ fontFamily: "var(--font-display)" }}>
                                Choose your agent
                            </h2>
                            <p className="text-sm text-muted text-center mb-2">
                                Each agent holds its own USDC wallet and trades autonomously.
                            </p>

                            {STRATEGIES.map((s) => (
                                <motion.button
                                    key={s.id}
                                    onClick={() => setSelectedStrategy(s.id)}
                                    whileHover={{ y: -2 }}
                                    className="w-full rounded-2xl border p-5 text-left transition-all"
                                    style={{
                                        borderColor: selectedStrategy === s.id ? s.accent : "var(--color-line)",
                                        background: selectedStrategy === s.id ? `${s.accent}10` : "var(--color-surface)",
                                        boxShadow: selectedStrategy === s.id ? `0 4px 20px ${s.accent}20` : "none",
                                    }}
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="font-bold text-ink">{s.name}</p>
                                            <p className="text-xs text-muted uppercase tracking-wider mt-0.5">{s.tag}</p>
                                        </div>
                                        {selectedStrategy === s.id && (
                                            <span className="text-xs font-semibold px-2 py-1 rounded-full"
                                                style={{ background: `${s.accent}20`, color: s.accent }}>
                                                Selected
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-3 text-sm text-muted leading-relaxed">{s.description}</p>
                                </motion.button>
                            ))}

                            <button
                                onClick={handleCreate}
                                disabled={!selectedStrategy || loading}
                                className="w-full rounded-full py-3 text-sm font-semibold text-white transition-all mt-2 disabled:opacity-40"
                                style={{ background: "#38BDF8" }}
                            >
                                {loading ? "Creating agent wallet..." : "Create agent wallet →"}
                            </button>
                            {error && <p className="text-sm text-no text-center">{error}</p>}
                        </motion.div>
                    )}

                    {/* Step 3 — Created */}
                    {step === "created" && wallet && (
                        <motion.div
                            key="created"
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -16 }}
                            className="rounded-2xl border border-line bg-surface p-8 flex flex-col gap-6"
                        >
                            <div className="text-center">
                                <div className="h-16 w-16 rounded-2xl bg-yes-soft flex items-center justify-center text-3xl mx-auto">
                                    ✅
                                </div>
                                <h2 className="mt-4 text-xl font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>
                                    Agent wallet ready
                                </h2>
                                <p className="mt-2 text-sm text-muted">
                                    Your Circle Developer-Controlled Wallet is live on Arc Testnet.
                                </p>
                            </div>

                            {/* Wallet details */}
                            <div className="rounded-xl bg-bg border border-line p-4 flex flex-col gap-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted uppercase tracking-wider">Strategy</span>
                                    <span className="font-semibold text-ink capitalize">{wallet.strategy}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted uppercase tracking-wider">Address</span>
                                    <span className="font-mono text-ink">
                                        {wallet.circle_wallet_address?.slice(0, 6)}...{wallet.circle_wallet_address?.slice(-4)}
                                    </span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted uppercase tracking-wider">Status</span>
                                    <span className="font-semibold" style={{ color: "#38BDF8" }}>
                                        {wallet.status}
                                    </span>
                                </div>
                            </div>

                            <p className="text-xs text-muted text-center">
                                Fund this wallet with testnet USDC from{" "}
                                <a href="https://faucet.circle.com" target="_blank" className="underline">
                                    faucet.circle.com
                                </a>{" "}
                                before running.
                            </p>

                            <button
                                onClick={handleRun}
                                disabled={loading}
                                className="w-full rounded-full py-3 text-sm font-semibold text-white transition-all disabled:opacity-40"
                                style={{ background: "#38BDF8" }}
                            >
                                {loading ? "Starting agent..." : "Run agent cycle →"}
                            </button>
                        </motion.div>
                    )}

                    {/* Running */}
                    {step === "running" && (
                        <motion.div
                            key="running"
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="rounded-2xl border border-line bg-surface p-8 flex flex-col items-center gap-6 text-center"
                        >
                            <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-3xl"
                                style={{ background: "#38BDF810", border: "1px solid #38BDF840" }}>
                                🤖
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>
                                    Agent is running
                                </h2>
                                <p className="mt-2 text-sm text-muted">
                                    Your agent is scanning markets, reasoning with Claude, and trading autonomously.
                                </p>
                            </div>

                            <div className="flex items-center gap-2 text-sm" style={{ color: "#38BDF8" }}>
                                <span className="relative flex h-2 w-2">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                                        style={{ background: "#38BDF8" }} />
                                    <span className="relative inline-flex h-2 w-2 rounded-full"
                                        style={{ background: "#38BDF8" }} />
                                </span>
                                Live on Arc Testnet
                            </div>


                            <a href="/" className="w-full rounded-full py-3 text-sm font-semibold text-white text-center transition-all block" style={{ background: "#1c1d1f" }}>
                                View dashboard →
                            </a>
                        </motion.div>
                    )}

                </AnimatePresence>
            </div>
        </div >
    );
}