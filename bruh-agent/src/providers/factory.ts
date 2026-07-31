import type { AgentProviders, HistoricalProvider, LlmProvider, NewsProvider, OnchainProvider, } from "../core/types";
import { DefaultHistoricalProvider, type HistoricalSourceAdapter, } from "./historical-provider";
import { DefaultLlmProvider, type LlmTransport, } from "./llm-provider";
import { DefaultNewsProvider, type NewsSourceAdapter, } from "./news-provider";
import { DefaultOnchainProvider, type OnchainSourceAdapter, } from "./onchain-provider";
import { loadProviderConfig, type BruhProviderConfig, } from "./config";
import { X402ResearchAdapter, type X402PaymentExecutor, type X402ServiceDiscovery, } from "./adapters/x402/research";



export interface ProviderFactoryDependencies {
    llmTransport: LlmTransport;

    newsAdapters: NewsSourceAdapter[];

    historicalAdapters: HistoricalSourceAdapter[];

    onchainAdapters: OnchainSourceAdapter[];

    x402PaymentExecutor?: X402PaymentExecutor;

    x402Discovery?: X402ServiceDiscovery;
}

export interface ProviderFactoryOverrides {
    news?: NewsProvider;

    historical?: HistoricalProvider;

    onchain?: OnchainProvider;

    llm?: LlmProvider;
}

export interface CreateProvidersOptions {
    config?: BruhProviderConfig;

    dependencies: ProviderFactoryDependencies;

    overrides?: ProviderFactoryOverrides;
}

export function createProviders({
    config = loadProviderConfig(),
    dependencies,
    overrides = {},
}: CreateProvidersOptions): BruhProviders {
    validateDependencies(dependencies);

    const news =
        overrides.news ??
        new DefaultNewsProvider({
            adapters: dependencies.newsAdapters,

            timeoutMs:
                config.tavily.timeoutMs,

            cacheTtlMs: 5 * 60_000,

            maximumCostUsdc:
                config.x402.enabled
                    ? config.x402.maximumPaymentUsdc
                    : undefined,

            minimumCredibilityScore: 0.45,
        });

    const historical =
        overrides.historical ??
        new DefaultHistoricalProvider({
            adapters:
                dependencies.historicalAdapters,

            timeoutMs: 20_000,

            cacheTtlMs: 30 * 60_000,

            maximumCostUsdc:
                config.x402.enabled
                    ? config.x402.maximumPaymentUsdc
                    : undefined,

            minimumSimilarityScore: 0.4,
        });

    const onchain =
        overrides.onchain ??
        new DefaultOnchainProvider({
            adapters:
                dependencies.onchainAdapters,

            timeoutMs:
                config.dune.timeoutMs,

            cacheTtlMs: 2 * 60_000,

            maximumCostUsdc:
                config.x402.enabled
                    ? config.x402.maximumPaymentUsdc
                    : undefined,

            minimumConfidenceScore: 0.4,
        });

    const llm =
        overrides.llm ??
        new DefaultLlmProvider({
            transport:
                dependencies.llmTransport,

            timeoutMs:
                config.anthropic.timeoutMs,

            temperature:
                config.anthropic.temperature,

            maxTokens:
                config.anthropic.maxTokens,
        });


    const paidResearch =
        config.x402.enabled &&
            dependencies.x402PaymentExecutor
            ? new X402ResearchAdapter({
                paymentExecutor:
                    dependencies.x402PaymentExecutor,

                discovery:
                    dependencies.x402Discovery,

                timeoutMs:
                    config.x402.timeoutMs,

                maximumPaymentUsdc:
                    config.x402.maximumPaymentUsdc,

                cacheTtlMs:
                    5 * 60_000,

                maximumSources: 10,

                minimumConfidence: 0.45,
            })
            : undefined;

    return {
        news,
        historical,
        onchain,
        llm,
        paidResearch,
    };
}

function validateDependencies(
    dependencies: ProviderFactoryDependencies,
): void {
    if (!dependencies.llmTransport) {
        throw new Error(
            "Provider factory requires an LLM transport.",
        );
    }

    if (
        !Array.isArray(
            dependencies.newsAdapters,
        ) ||
        dependencies.newsAdapters.length === 0
    ) {
        throw new Error(
            "Provider factory requires at least one news adapter.",
        );
    }

    if (
        !Array.isArray(
            dependencies.historicalAdapters,
        ) ||
        dependencies.historicalAdapters.length === 0
    ) {
        throw new Error(
            "Provider factory requires at least one historical adapter.",
        );
    }

    if (
        !Array.isArray(
            dependencies.onchainAdapters,
        ) ||
        dependencies.onchainAdapters.length === 0
    ) {
        throw new Error(
            "Provider factory requires at least one onchain adapter.",
        );
    }
}

export interface PartialProviderFactoryDependencies {
    llmTransport?: LlmTransport;

    newsAdapters?: NewsSourceAdapter[];

    historicalAdapters?: HistoricalSourceAdapter[];

    onchainAdapters?: OnchainSourceAdapter[];
}

export function validateProviderFactoryReadiness(
    dependencies: PartialProviderFactoryDependencies,
): {
    ready: boolean;
    missing: string[];
} {
    const missing: string[] = [];

    if (!dependencies.llmTransport) {
        missing.push("llmTransport");
    }

    if (!dependencies.newsAdapters?.length) {
        missing.push("newsAdapters");
    }

    if (!dependencies.historicalAdapters?.length) {
        missing.push("historicalAdapters");
    }

    if (!dependencies.onchainAdapters?.length) {
        missing.push("onchainAdapters");
    }

    return {
        ready: missing.length === 0,
        missing,
    };
}

export interface BruhProviders
    extends AgentProviders {
    paidResearch?:
    X402ResearchAdapter;
}