"use client";

import { motion } from "framer-motion";
import { getAgentTheme } from "@/src/lib/agentTheme";

function seedToHue(seed: string): number {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % 360;
}

export function AgentCover({ seed }: { seed: string }) {
    const hue = seedToHue(seed || "default");
    const theme = getAgentTheme(seed);

    return (
        <div className="relative h-24 w-full overflow-hidden rounded-t-2xl">
            <div
                className="absolute inset-0"
                style={{
                    background: `
        linear-gradient(
            135deg,
            ${theme.primary},
            ${theme.secondary}
        )
    `,
                }}
            />

            <motion.div
                className="absolute -top-6 -left-6 h-20 w-20 rounded-full opacity-40 blur-2xl"
                style={{ background: "white" }}
                animate={{ x: [0, 24, 0], y: [0, 12, 0], scale: [1, 1.15, 1] }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
                className="absolute -bottom-6 right-0 h-24 w-24 rounded-full opacity-30 blur-2xl"
                style={{ background: "#1c1d1f" }}
                animate={{ x: [0, -18, 0], y: [0, -10, 0] }}
                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            />
            <motion.div
                className="absolute top-1/2 left-1/3 h-14 w-14 rounded-full opacity-25 blur-xl"
                style={{ background: "white" }}
                animate={{ x: [0, 12, -12, 0], y: [0, -8, 8, 0] }}
                transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            />

            <div
                className="absolute inset-0 opacity-[0.08] mix-blend-overlay"
                style={{
                    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23n)'/%3E%3C/svg%3E\")",
                }}
            />

            <div
                className="absolute bottom-0 inset-x-0 h-10"
                style={{ background: "linear-gradient(to bottom, transparent, var(--color-surface))" }}
            />
        </div>
    );
}