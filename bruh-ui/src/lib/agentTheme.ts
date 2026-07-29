export interface AgentTheme {
    primary: string;
    secondary: string;
    soft: string;
    border: string;
    shadow: string;
    text: string;
}

const AGENT_THEMES: AgentTheme[] = [
    {
        primary: "#38BDF8",
        secondary: "#6366F1",
        soft: "rgba(56, 189, 248, 0.08)",
        border: "rgba(56, 189, 248, 0.32)",
        shadow: "rgba(56, 189, 248, 0.28)",
        text: "#0284C7",
    },
    {
        primary: "#2DD4BF",
        secondary: "#6EE7B7",
        soft: "rgba(45, 212, 191, 0.08)",
        border: "rgba(45, 212, 191, 0.32)",
        shadow: "rgba(45, 212, 191, 0.28)",
        text: "#0F9F8F",
    },
    {
        primary: "#A78BFA",
        secondary: "#F0ABFC",
        soft: "rgba(167, 139, 250, 0.08)",
        border: "rgba(167, 139, 250, 0.32)",
        shadow: "rgba(167, 139, 250, 0.28)",
        text: "#7C3AED",
    },
    {
        primary: "#FB7185",
        secondary: "#FDA4AF",
        soft: "rgba(251, 113, 133, 0.08)",
        border: "rgba(251, 113, 133, 0.32)",
        shadow: "rgba(251, 113, 133, 0.28)",
        text: "#E11D48",
    },
    {
        primary: "#F59E0B",
        secondary: "#FDE68A",
        soft: "rgba(245, 158, 11, 0.08)",
        border: "rgba(245, 158, 11, 0.32)",
        shadow: "rgba(245, 158, 11, 0.28)",
        text: "#D97706",
    },
];

function hashSeed(seed: string) {
    let hash = 0;

    for (let index = 0; index < seed.length; index++) {
        hash = seed.charCodeAt(index) + ((hash << 5) - hash);
        hash |= 0;
    }

    return Math.abs(hash);
}

export function getAgentTheme(seed: string): AgentTheme {
    return AGENT_THEMES[hashSeed(seed) % AGENT_THEMES.length];
}