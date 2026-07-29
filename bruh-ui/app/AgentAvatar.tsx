"use client";

import Avatar from "boring-avatars";

const PALETTE = ["#38BDF8", "#6EE7FF", "#0EA5E9", "#1c1d1f", "#ecfeff"];

export function AgentAvatar({ seed, size = 40 }: { seed: string; size?: number }) {
    return (
        <div className="rounded-xl overflow-hidden" style={{ width: size, height: size }}>
            <Avatar size={size} name={seed} variant="marble" colors={PALETTE} />
        </div>
    );
}