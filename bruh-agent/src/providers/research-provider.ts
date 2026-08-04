import type {
    AgentResearchResult,
    ResearchEvidence,
} from "../core/types";

export type ResearchProviderName =
    | "news"
    | "historical"
    | "onchain"
    | "custom";

export interface ResearchProviderOptions {
    timeoutMs?: number;
    cacheTtlMs?: number;
    maximumCostUsdc?: number;
}

export interface ResearchCacheEntry<T> {
    value: T;
    expiresAt: number;
}

export interface ResearchProviderExecution {
    provider: ResearchProviderName;
    startedAt: string;
    completedAt: string;
    durationMs: number;
    costUsdc: number;
    cached: boolean;
}

export interface ResearchProviderResponse<T> {
    data: T;
    execution: ResearchProviderExecution;
}

export class ResearchProviderError extends Error {
    readonly provider: ResearchProviderName;
    readonly code: string;
    readonly cause?: unknown;

    constructor({
        provider,
        code,
        message,
        cause,
    }: {
        provider: ResearchProviderName;
        code: string;
        message: string;
        cause?: unknown;
    }) {
        super(message);

        this.name = "ResearchProviderError";
        this.provider = provider;
        this.code = code;
        this.cause = cause;
    }
}

export class ResearchBudgetExceededError extends ResearchProviderError {
    constructor({
        provider,
        attemptedCostUsdc,
        maximumCostUsdc,
    }: {
        provider: ResearchProviderName;
        attemptedCostUsdc: number;
        maximumCostUsdc: number;
    }) {
        super({
            provider,
            code: "RESEARCH_BUDGET_EXCEEDED",
            message:
                `${provider} research would cost ${attemptedCostUsdc} USDC, ` +
                `which exceeds the configured limit of ${maximumCostUsdc} USDC.`,
        });

        this.name = "ResearchBudgetExceededError";
    }
}

export class InMemoryResearchCache {
    private readonly entries = new Map<
        string,
        ResearchCacheEntry<unknown>
    >();

    get<T>(key: string): T | null {
        const entry = this.entries.get(key);

        if (!entry) {
            return null;
        }

        if (entry.expiresAt <= Date.now()) {
            this.entries.delete(key);
            return null;
        }

        return entry.value as T;
    }

    set<T>(
        key: string,
        value: T,
        ttlMs: number,
    ): void {
        this.entries.set(key, {
            value,
            expiresAt: Date.now() + ttlMs,
        });
    }

    delete(key: string): void {
        this.entries.delete(key);
    }

    clear(): void {
        this.entries.clear();
    }
}

export function createResearchCacheKey(
    provider: ResearchProviderName,
    input: unknown,
): string {
    return `${provider}:${stableStringify(input)}`;
}

export function stableStringify(
    input: unknown,
): string {
    if (
        input === null ||
        typeof input !== "object"
    ) {
        return JSON.stringify(input);
    }

    if (Array.isArray(input)) {
        return `[${input
            .map((item) => stableStringify(item))
            .join(",")}]`;
    }

    const record = input as Record<
        string,
        unknown
    >;

    return `{${Object.keys(record)
        .sort()
        .map(
            (key) =>
                `${JSON.stringify(key)}:${stableStringify(
                    record[key],
                )}`,
        )
        .join(",")}}`;
}

export async function withTimeout<T>(
    operation: Promise<T>,
    timeoutMs: number,
    provider: ResearchProviderName,
): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>(
        (_, reject) => {
            timer = setTimeout(() => {
                reject(
                    new ResearchProviderError({
                        provider,
                        code: "PROVIDER_TIMEOUT",
                        message:
                            `${provider} provider timed out after ` +
                            `${timeoutMs}ms.`,
                    }),
                );
            }, timeoutMs);
        },
    );

    try {
        return await Promise.race([
            operation,
            timeoutPromise,
        ]);
    } finally {
        if (timer) {
            clearTimeout(timer);
        }
    }
}

export function enforceResearchBudget({
    provider,
    costUsdc,
    maximumCostUsdc,
}: {
    provider: ResearchProviderName;
    costUsdc: number;
    maximumCostUsdc?: number;
}): void {
    if (
        maximumCostUsdc === undefined ||
        costUsdc <= maximumCostUsdc
    ) {
        return;
    }

    throw new ResearchBudgetExceededError({
        provider,
        attemptedCostUsdc: costUsdc,
        maximumCostUsdc,
    });
}

export function normalizeCredibilityScore(
    score: number | undefined,
): number | undefined {
    if (score === undefined) {
        return undefined;
    }

    if (!Number.isFinite(score)) {
        return undefined;
    }

    return clamp(score, 0, 1);
}

export function normalizeEvidence(
    evidence: ResearchEvidence,
): ResearchEvidence {
    return {
        ...evidence,

        title: evidence.title.trim(),

        summary: evidence.summary.trim(),

        source: evidence.source.trim(),

        credibilityScore:
            normalizeCredibilityScore(
                evidence.credibilityScore,
            ),
    };
}

export function deduplicateEvidence(
    evidence: ResearchEvidence[],
): ResearchEvidence[] {
    const seen = new Set<string>();

    return evidence.filter((item) => {
        const key = [
            item.type,
            item.url?.toLowerCase() ?? "",
            item.title.toLowerCase().trim(),
        ].join(":");

        if (seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    });
}

export function createEmptyResearchResult({
    profileId,
    marketId,
    summary,
}: {
    profileId: string;
    marketId: string;
    summary: string;
}): AgentResearchResult {
    return {
        profileId,
        marketId,
        collectedAt: new Date().toISOString(),
        summary,
        evidence: [],
        costUsdc: 0,
        metadata: {
            empty: true,
        },
    };
}

export function clamp(
    value: number,
    minimum: number,
    maximum: number,
): number {
    return Math.min(
        Math.max(value, minimum),
        maximum,
    );
}