import { randomUUID } from "node:crypto";

import type {
    AgentReflectionMemory,
    AgentResolutionMemory,
} from "./types";

export interface ReflectionGenerator {
    generate(
        input: ReflectionGenerationInput,
    ): Promise<ReflectionGenerationResult>;
}

export interface ReflectionGenerationInput {
    resolution: AgentResolutionMemory;

    previousLessons?: string[];
}

export interface ReflectionGenerationResult {
    summary: string;

    whatWorked: string[];

    whatFailed: string[];

    lessons: string[];

    futureAdjustments: string[];
}

export async function createReflection({
    resolution,
    generator,
    previousLessons = [],
}: {
    resolution: AgentResolutionMemory;

    generator?: ReflectionGenerator;

    previousLessons?: string[];
}): Promise<AgentReflectionMemory> {
    if (!generator) {
        return createBasicReflection(
            resolution,
        );
    }

    try {
        const generated =
            await generator.generate({
                resolution,
                previousLessons,
            });

        return buildReflectionMemory({
            resolution,
            generated,
            generator:
                "custom",
        });
    } catch {
        return createBasicReflection(
            resolution,
        );
    }
}

export function createBasicReflection(
    resolution: AgentResolutionMemory,
): AgentReflectionMemory {
    const outcomeAssessment =
        resolveOutcomeAssessment(
            resolution,
        );

    const generated =
        createBasicContent({
            resolution,
            outcomeAssessment,
        });

    return buildReflectionMemory({
        resolution,
        generated,
        generator:
            "basic",
    });
}

function buildReflectionMemory({
    resolution,
    generated,
    generator,
}: {
    resolution: AgentResolutionMemory;

    generated:
    ReflectionGenerationResult;

    generator: string;
}): AgentReflectionMemory {
    return {
        id: randomUUID(),

        type: "reflection",

        agentId:
            resolution.agentId,

        profileId:
            resolution.profileId,

        profileVersion:
            resolution.profileVersion,

        marketId:
            resolution.marketId,

        ...(resolution.runId
            ? {
                runId:
                    resolution.runId,
            }
            : {}),

        marketQuestion:
            resolution.marketQuestion,

        resolution:
            resolution.resolution,

        prediction:
            resolution.action,

        probability:
            resolution.probability,

        confidence:
            resolution.confidence,

        pnlUsdc:
            resolution.pnlUsdc,

        outcomeAssessment:
            resolveOutcomeAssessment(
                resolution,
            ),

        summary:
            generated.summary,

        whatWorked:
            generated.whatWorked,

        whatFailed:
            generated.whatFailed,

        lessons:
            generated.lessons,

        futureAdjustments:
            generated.futureAdjustments,

        createdAt:
            new Date().toISOString(),

        metadata: {
            generator,
        },
    };
}

function createBasicContent({
    resolution,
    outcomeAssessment,
}: {
    resolution: AgentResolutionMemory;

    outcomeAssessment:
    AgentReflectionMemory["outcomeAssessment"];
}): ReflectionGenerationResult {
    if (
        outcomeAssessment ===
        "invalid"
    ) {
        return {
            summary:
                "The market did not produce a valid binary resolution.",

            whatWorked: [],

            whatFailed: [],

            lessons: [
                "Do not update directional confidence from invalid or cancelled markets.",
            ],

            futureAdjustments: [
                "Exclude invalid resolutions from forecasting-performance calculations.",
            ],
        };
    }

    if (
        outcomeAssessment ===
        "no-position"
    ) {
        return {
            summary:
                "The agent passed and opened no position.",

            whatWorked: [
                "The risk engine prevented capital deployment without sufficient conviction.",
            ],

            whatFailed: [],

            lessons: [
                "Review whether the pass threshold was appropriately calibrated.",
            ],

            futureAdjustments: [
                "Compare similar passed markets to determine whether valid opportunities were missed.",
            ],
        };
    }

    if (
        outcomeAssessment ===
        "correct"
    ) {
        return {
            summary:
                "The agent's directional forecast matched the resolved outcome.",

            whatWorked: [
                "The selected direction matched the market resolution.",

                "The probability estimate identified positive edge relative to the market price.",
            ],

            whatFailed: [],

            lessons: [
                "Preserve the evidence patterns that contributed to this forecast.",

                "Do not increase future risk solely because this trade succeeded.",
            ],

            futureAdjustments: [
                "Compare this setup with future markets before reusing the same confidence level.",
            ],
        };
    }

    return {
        summary:
            "The agent's directional forecast did not match the resolved outcome.",

        whatWorked: [
            "Position sizing limited the maximum loss.",
        ],

        whatFailed: [
            "The chosen direction did not match the final resolution.",

            "The estimated edge may have been overstated.",

            "Available information may already have been reflected in the market price.",
        ],

        lessons: [
            "Reduce confidence when evidence is weak, duplicated, or already priced in.",

            "Compare the current setup with previous failed forecasts.",

            "Re-evaluate the weight given to the dominant research signal.",
        ],

        futureAdjustments: [
            "Increase the minimum confidence threshold for similar markets.",

            "Use additional independent sources before executing comparable trades.",

            `Review forecasts near probability ${resolution.probability.toFixed(
                2,
            )} for calibration errors.`,
        ],
    };
}

function resolveOutcomeAssessment(
    resolution: AgentResolutionMemory,
): AgentReflectionMemory["outcomeAssessment"] {
    if (
        resolution.resolution ===
        "INVALID" ||
        resolution.resolution ===
        "CANCELLED"
    ) {
        return "invalid";
    }

    if (
        resolution.action === "PASS"
    ) {
        return "no-position";
    }

    return resolution.won
        ? "correct"
        : "incorrect";
}