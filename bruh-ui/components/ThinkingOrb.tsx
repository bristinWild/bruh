"use client";

import { motion } from "framer-motion";

export default function ThinkingOrb() {
    return (
        <div className="relative flex items-center justify-center">
            {/* glow */}
            <motion.div
                className="absolute h-52 w-52 rounded-full"
                style={{
                    background:
                        "radial-gradient(circle,#38BDF855 0%,transparent 70%)",
                }}
                animate={{
                    scale: [0.95, 1.08, 0.95],
                    opacity: [0.35, 0.7, 0.35],
                }}
                transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                }}
            />

            {/* ring */}
            <motion.div
                className="absolute h-44 w-44 rounded-full border"
                style={{
                    borderColor: "#38BDF833",
                }}
                animate={{
                    rotate: 360,
                }}
                transition={{
                    duration: 18,
                    repeat: Infinity,
                    ease: "linear",
                }}
            />

            {/* orb */}
            <motion.div
                className="relative flex h-36 w-36 items-center justify-center overflow-hidden rounded-full"
                style={{
                    background:
                        "radial-gradient(circle at 35% 30%,#E8FBFF,#38BDF8)",
                    boxShadow:
                        "0 0 40px rgba(56,189,248,.5)",
                }}
                animate={{
                    scale: [1, 1.04, 1],
                }}
                transition={{
                    duration: 2,
                    repeat: Infinity,
                }}
            >
                {[0, 1, 2].map((i) => (
                    <motion.div
                        key={i}
                        className="absolute rounded-full"
                        style={{
                            width: 120,
                            height: 34,
                            background: "rgba(255,255,255,.18)",
                            filter: "blur(2px)",
                        }}
                        animate={{
                            x: [-35, 35, -35],
                            scaleY: [1, 1.5, 1],
                            rotate: [0, 6, 0],
                        }}
                        transition={{
                            duration: 2.2 + i * 0.4,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: i * 0.3,
                        }}
                    />
                ))}
            </motion.div>

            {/* particles */}
            {[...Array(12)].map((_, i) => (
                <motion.span
                    key={i}
                    className="absolute h-1 w-1 rounded-full bg-cyan-300"
                    style={{
                        left: "50%",
                        top: "50%",
                    }}
                    animate={{
                        x: Math.cos((i * 30 * Math.PI) / 180) * 95,
                        y: Math.sin((i * 30 * Math.PI) / 180) * 95,
                        opacity: [0.2, 1, 0.2],
                        scale: [1, 1.8, 1],
                    }}
                    transition={{
                        repeat: Infinity,
                        duration: 2,
                        delay: i * 0.08,
                    }}
                />
            ))}
        </div>
    );
}