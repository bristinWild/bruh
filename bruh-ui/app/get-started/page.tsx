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
        <div className="min-h-screen bg-bg relative overflow-hidden flex items-center justify-center px-6">
            <div className="pointer-events-none absolute inset-0 hero-glow" />

            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative z-10 w-full max-w-md rounded-2xl border border-line bg-surface p-8 flex flex-col items-center gap-6 text-center"
                style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.06)" }}
            >
                <motion.div
                    initial={{ scale: 0, rotate: -8 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
                    className="h-16 w-16 rounded-2xl border flex items-center justify-center"
                    style={{ borderColor: "#6EE7FF", background: "#ecfeff" }}
                >
                    <span className="font-mono text-2xl font-bold" style={{ color: "#0EA5E9" }}>B</span>
                </motion.div>

                <div>
                    <h1 className="text-xl font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>
                        Connect your wallet
                    </h1>
                    <p className="mt-2 text-sm text-muted max-w-xs">
                        Sign a message to authenticate. No password. No account.
                    </p>
                </div>

                <ConnectButton.Custom>
                    {({ openConnectModal }) => (
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={openConnectModal}
                            className="rounded-full px-8 py-3 text-sm font-semibold text-white"
                            style={{ background: "#38BDF8" }}
                        >
                            Connect Wallet
                        </motion.button>
                    )}
                </ConnectButton.Custom>

                {loading && (
                    <p className="text-sm text-muted flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "#38BDF8" }} />
                        Signing in...
                    </p>
                )}
                {error && <p className="text-sm text-no">{error}</p>}
            </motion.div>
        </div>
    );
}