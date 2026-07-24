import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./app/**/*.{ts,tsx}",
        "./components/**/*.{ts,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                bg: "var(--color-bg)",
                surface: "var(--color-surface)",
                ink: "var(--color-ink)",
                muted: "var(--color-muted)",
                line: "var(--color-line)",
                primary: "var(--color-primary)",
                "primary-soft": "var(--color-primary-soft)",
                yes: "var(--color-yes)",
                "yes-soft": "var(--color-yes-soft)",
                no: "var(--color-no)",
                "no-soft": "var(--color-no-soft)",
                amber: "var(--color-amber)",
                "amber-soft": "var(--color-amber-soft)",
            },
            fontFamily: {
                display: "var(--font-display)",
                sans: "var(--font-sans)",
                mono: "var(--font-mono)",
            },
            borderRadius: {
                card: "var(--radius-card)",
            },
        },
    },
    plugins: [],
};

export default config;