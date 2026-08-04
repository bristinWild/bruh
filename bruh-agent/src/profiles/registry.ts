import type { AgentProfile } from "../core/types";
import { actuaryProfile } from "./actuary";
import { newshoundProfile } from "./newshound";
import { whaleHunterProfile } from "./whale-hunter";

export const BUILT_IN_PROFILES = [
    newshoundProfile,
    actuaryProfile,
    whaleHunterProfile,
] as const;

export const PROFILE_REGISTRY: Readonly<
    Record<string, AgentProfile>
> = Object.freeze(
    Object.fromEntries(
        BUILT_IN_PROFILES.map((profile) => [
            profile.id,
            profile,
        ]),
    ),
);

export function getAgentProfile(
    profileId: string,
): AgentProfile {
    const normalizedId = profileId
        .trim()
        .toLowerCase();

    const profile =
        PROFILE_REGISTRY[normalizedId];

    if (!profile) {
        throw new Error(
            `Unknown agent profile "${profileId}". Available profiles: ${listAgentProfileIds().join(", ")}`,
        );
    }

    return profile;
}

export function hasAgentProfile(
    profileId: string,
): boolean {
    return Boolean(
        PROFILE_REGISTRY[
        profileId.trim().toLowerCase()
        ],
    );
}

export function listAgentProfiles(): AgentProfile[] {
    return [...BUILT_IN_PROFILES];
}

export function listAgentProfileIds(): string[] {
    return BUILT_IN_PROFILES.map(
        (profile) => profile.id,
    );
}

export function listProfilesByCategory(
    category: string,
): AgentProfile[] {
    const normalizedCategory = category
        .trim()
        .toLowerCase();

    return BUILT_IN_PROFILES.filter((profile) =>
        profile.categories.some(
            (profileCategory) =>
                profileCategory.toLowerCase() ===
                normalizedCategory,
        ),
    );
}

export function listProfilesByDifficulty(
    difficulty: AgentProfile["difficulty"],
): AgentProfile[] {
    return BUILT_IN_PROFILES.filter(
        (profile) =>
            profile.difficulty === difficulty,
    );
}