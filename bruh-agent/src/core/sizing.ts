import type { PositionSizingInput, PositionSizingResult, } from "./types";

const ZERO_POSITION: PositionSizingResult = {
    amountUsdc: 0,
    fullKellyFraction: 0,
    adjustedKellyFraction: 0,
    edge: 0,
    reason: "No position should be opened.",
};

function clamp(
    value: number,
    minimum: number,
    maximum: number,
): number {
    return Math.min(
        Math.max(value, minimum),
        maximum,
    );
}

function calculateBinaryKellyFraction(
    probability: number,
    price: number,
): number {
    if (
        price <= 0 ||
        price >= 1 ||
        probability <= 0 ||
        probability >= 1
    ) {
        return 0;
    }

    const netOdds = (1 - price) / price;

    const lossProbability = 1 - probability;

    const fraction =
        (netOdds * probability - lossProbability) /
        netOdds;

    return Math.max(0, fraction);
}

export function calculatePositionSize(
    input: PositionSizingInput,
): PositionSizingResult {
    if (input.action === "PASS") {
        return {
            ...ZERO_POSITION,
            reason:
                "The agent selected PASS, so no position was sized.",
        };
    }

    if (input.availableBalanceUsdc <= 0) {
        return {
            ...ZERO_POSITION,
            reason:
                "The agent wallet does not have an available balance.",
        };
    }

    const selectedProbability =
        input.action === "BUY_YES"
            ? input.probability
            : 1 - input.probability;

    const selectedMarketPrice =
        input.action === "BUY_YES"
            ? input.marketProbability
            : 1 - input.marketProbability;

    const edge =
        selectedProbability - selectedMarketPrice;

    if (edge <= 0) {
        return {
            ...ZERO_POSITION,
            edge,
            reason:
                "The estimated probability does not provide a positive edge.",
        };
    }

    const fullKellyFraction =
        calculateBinaryKellyFraction(
            selectedProbability,
            selectedMarketPrice,
        );

    const confidenceMultiplier = clamp(
        input.confidence,
        0,
        1,
    );

    const adjustedKellyFraction = clamp(
        fullKellyFraction *
        input.kellyFraction *
        confidenceMultiplier,
        0,
        1,
    );

    const balanceBasedPosition =
        input.availableBalanceUsdc *
        adjustedKellyFraction;

    let exposureCapacity = Number.POSITIVE_INFINITY;

    if (
        typeof input.maximumMarketExposureUsdc ===
        "number"
    ) {
        exposureCapacity = Math.max(
            0,
            input.maximumMarketExposureUsdc -
            (input.currentMarketExposureUsdc ?? 0),
        );
    }

    const amountUsdc = Math.max(
        0,
        Math.min(
            balanceBasedPosition,
            input.maxPositionUsdc,
            input.availableBalanceUsdc,
            exposureCapacity,
        ),
    );

    return {
        amountUsdc: Number(amountUsdc.toFixed(6)),

        fullKellyFraction,

        adjustedKellyFraction,

        edge,

        reason:
            amountUsdc > 0
                ? "Position sized using fractional Kelly, confidence and configured exposure limits."
                : "The calculated position was reduced to zero by balance or exposure limits.",
    };
}