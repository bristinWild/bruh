export type AgentDifficulty =
    | "beginner"
    | "intermediate"
    | "advanced"
    | "developer";

export type AgentProfileSource =
    | "bruh"
    | "community"
    | "custom";

export type AgentAction =
    | "BUY_YES"
    | "BUY_NO"
    | "PASS";

export type MarketCategory =
    | "crypto"
    | "artificial-intelligence"
    | "technology"
    | "politics"
    | "business"
    | "economics"
    | "macro"
    | "elections"
    | "finance"
    | "weather"
    | "public-policy"
    | "defi"
    | "bitcoin"
    | "ethereum"
    | "layer-1"
    | "etf"
    | string;

export interface AgentMarket {
    id: string;

    question: string;

    description?: string;

    categories: MarketCategory[];

    resolutionCriteria?: string;

    yesPrice: number;

    noPrice?: number;

    liquidityUsdc?: number;

    volumeUsdc?: number;

    closesAt?: string;

    assets?: string[];

    chains?: string[];

    metadata?: Record<string, unknown>;
}

export interface AgentProfileDefaults {
    edgeThreshold: number;

    kellyFraction: number;

    maxPositionUsdc: number;

    researchBudgetUsdc: number;

    maxResearchSources: number;

    maxDailyLossUsdc?: number;

    minimumConfidence?: number;

    maximumMarketExposureUsdc?: number;
}

export interface AgentRuntimeConfig
    extends AgentProfileDefaults {
    dryRun?: boolean;

    allowTrading?: boolean;

    availableBalanceUsdc: number;

    currentMarketExposureUsdc?: number;

    dailyProfitLossUsdc?: number;

    configOverrides?: Partial<AgentProfileDefaults>;
}

export interface ResearchEvidence {
    type:
    | "news"
    | "historical"
    | "onchain"
    | "social"
    | "oracle"
    | "custom";

    title: string;

    summary: string;

    source: string;

    url?: string;

    publishedAt?: string;

    credibilityScore?: number;

    metadata?: Record<string, unknown>;
}

export interface AgentResearchResult {
    profileId: string;

    marketId: string;

    collectedAt: string;

    summary: string;

    evidence: ResearchEvidence[];

    costUsdc: number;

    metadata?: Record<string, unknown>;
}

export interface AgentEstimate {
    probability: number;

    confidence: number;

    reasoning: string;

    keyFactors: string[];

    risks: string[];

    recommendedAction?: AgentAction;

    metadata?: Record<string, unknown>;
}

export interface AgentDecision {
    action: AgentAction;

    probability: number;

    confidence: number;

    marketProbability: number;

    edge: number;

    amountUsdc: number;

    reasoning: string;

    keyFactors: string[];

    risks: string[];

    researchCostUsdc: number;

    shouldExecute: boolean;

    riskChecks: RiskCheckResult[];

    metadata?: Record<string, unknown>;
}

export interface RiskCheckResult {
    id: string;

    passed: boolean;

    message: string;

    value?: number;

    limit?: number;
}

export interface RiskEvaluation {
    approved: boolean;

    checks: RiskCheckResult[];

    rejectedBy?: string[];
}

export interface PositionSizingInput {
    action: AgentAction;

    probability: number;

    marketProbability: number;

    confidence: number;

    availableBalanceUsdc: number;

    kellyFraction: number;

    maxPositionUsdc: number;

    currentMarketExposureUsdc?: number;

    maximumMarketExposureUsdc?: number;
}

export interface PositionSizingResult {
    amountUsdc: number;

    fullKellyFraction: number;

    adjustedKellyFraction: number;

    edge: number;

    reason: string;
}

export interface NewsSearchInput {
    query: string;

    description?: string;

    categories?: string[];

    lookbackHours: number;

    limit: number;
}

export interface NewsItem {
    title: string;

    summary: string;

    source: string;

    url?: string;

    publishedAt?: string;

    credibilityScore?: number;

    sentiment?: "positive" | "negative" | "neutral";

    isPrimarySource?: boolean;
}

export interface NewsSearchResult {
    summary: string;

    items: NewsItem[];

    costUsdc?: number;

    provider?: string;
}

export interface HistoricalAnalyzeInput {
    question: string;

    description?: string;

    categories?: string[];

    resolutionCriteria?: string;

    limit: number;
}

export interface HistoricalComparable {
    title: string;

    summary: string;

    source: string;

    url?: string;

    date?: string;

    outcome?: string;

    credibilityScore?: number;

    similarityScore?: number;

    category?: string;
}

export interface HistoricalAnalyzeResult {
    summary: string;

    comparables: HistoricalComparable[];

    baseRate: number;

    sampleSize?: number;

    confidenceInterval?: {
        lower: number;
        upper: number;
    };

    costUsdc?: number;

    provider?: string;
}

export interface OnchainAnalyzeInput {
    question: string;

    description?: string;

    categories?: string[];

    assets: string[];

    chains: string[];

    lookbackHours: number;

    minimumTransferUsd: number;

    limit: number;
}

export interface OnchainSignal {
    type: string;

    title: string;

    summary: string;

    provider: string;

    explorerUrl?: string;

    timestamp?: string;

    confidenceScore?: number;

    chain?: string;

    asset?: string;

    walletAddress?: string;

    walletLabel?: string;

    transactionHash?: string;

    valueUsd?: number;

    direction?: "inflow" | "outflow" | "neutral";
}

export interface OnchainAnalyzeResult {
    summary: string;

    signals: OnchainSignal[];

    netExchangeFlowUsd?: number;

    netBridgeFlowUsd?: number;

    accumulationScore?: number;

    costUsdc?: number;

    provider?: string;
}

export interface LlmEstimateInput {
    profileId: string;

    systemPrompt: string;

    market: AgentMarket;

    research: AgentResearchResult;

    marketProbability: number;

    instructions: string;
}

export interface NewsProvider {
    search(
        input: NewsSearchInput,
    ): Promise<NewsSearchResult>;
}

export interface HistoricalProvider {
    analyze(
        input: HistoricalAnalyzeInput,
    ): Promise<HistoricalAnalyzeResult>;
}

export interface OnchainProvider {
    analyze(
        input: OnchainAnalyzeInput,
    ): Promise<OnchainAnalyzeResult>;
}

export interface LlmProvider {
    estimate(
        input: LlmEstimateInput,
    ): Promise<AgentEstimate>;
}

export interface AgentProviders {
    news: NewsProvider;

    historical: HistoricalProvider;

    onchain: OnchainProvider;

    llm: LlmProvider;
    paidResearch?: PaidResearchProvider;
}

export interface AgentResearchContext {
    market: AgentMarket;

    config: AgentRuntimeConfig;

    providers: AgentProviders;

    memory?: RuntimeMemoryContext;
}

export interface AgentReasoningContext {
    market: AgentMarket;

    config: AgentRuntimeConfig;

    providers: AgentProviders;

    research: AgentResearchResult;

    marketProbability: number;

    memory?: RuntimeMemoryContext;
}

export interface AgentProfile {
    id: string;

    name: string;

    version: string;

    source: AgentProfileSource;

    description: string;

    difficulty: AgentDifficulty;

    categories: string[];

    capabilities: string[];

    defaults: AgentProfileDefaults;

    systemPrompt: string;

    research(
        context: AgentResearchContext,
    ): Promise<AgentResearchResult>;

    estimate(
        context: AgentReasoningContext,
    ): Promise<AgentEstimate>;
}

export interface AgentRuntimeInput {
    profile: AgentProfile;

    market: AgentMarket;

    providers: AgentProviders;

    config: AgentRuntimeConfig;

    runId?: string;

    agentId?: string;

    walletAddress?: string;

    network?: string;

    executionPlanExpiresInSeconds?: number;

    memoryProvider?: {
        getContext(input: {
            agentId: string;
            profileId?: string;
            marketId?: string;
            limit?: number;
        }): Promise<{
            summary: string;

            recentDecisions: Array<{
                marketId: string;
                action: AgentAction;
                probability: number;
                confidence: number;
                edge: number;
                reasoning: string;
            }>;

            recentResolutions: Array<{
                marketId: string;
                resolution:
                | "YES"
                | "NO"
                | "INVALID"
                | "CANCELLED";
                pnlUsdc: number;
                won: boolean | null;
            }>;

            recentReflections: Array<{
                lessons: string[];
            }>;
        }>;

        save(memory: unknown): Promise<void>;

        saveMany(
            memories: unknown[],
        ): Promise<void>;
    };

    metadata?: Record<string, unknown>;
}

export interface AgentRuntimeResult {
    runId: string;

    profileId: string;

    profileVersion: string;

    marketId: string;

    startedAt: string;

    completedAt: string;

    status:
    | "completed"
    | "rejected"
    | "failed";

    research?: AgentResearchResult;

    estimate?: AgentEstimate;

    decision?: AgentDecision;

    error?: {
        message: string;

        code?: string;
    };

    metadata?: Record<string, unknown>;
    executionPlan?: ExecutionPlan;
}

export interface PaidResearchRequest {
    url: string;

    query: string;

    budgetUsdc: number;

    category?: string;

    maximumSources?: number;

    minimumConfidence?: number;

    metadata?: Record<string, unknown>;
}

export interface PaidResearchResult {
    summary: string;

    confidence: number;

    provider: string;

    totalCostUsdc: number;

    sources: Array<{
        title: string;

        provider: string;

        content: string;

        url?: string;

        confidence?: number;

        priceUsdc?: number;
    }>;

    metadata?: Record<string, unknown>;
}

export interface PaidResearchProvider {
    purchaseResearch(
        request: PaidResearchRequest,
    ): Promise<PaidResearchResult>;
}

export type ExecutionPlanStatus =
    | "ready"
    | "simulation"
    | "skipped"
    | "expired"
    | "executing"
    | "executed"
    | "failed"
    | "rejected";

export type ExecutionRiskLevel =
    | "low"
    | "medium"
    | "high"
    | "blocked";

export interface ExecutionPlanSource {
    type: ResearchEvidence["type"];

    title: string;

    source: string;

    url?: string;

    credibilityScore?: number;
}

export interface ExecutionPlan {
    id: string;

    runId: string;

    agentId?: string;

    profileId: string;

    profileVersion: string;

    marketId: string;

    marketQuestion: string;

    network: string;

    walletAddress?: string;

    action: AgentAction;

    side: "YES" | "NO" | null;

    status: ExecutionPlanStatus;

    amountUsdc: number;

    researchCostUsdc: number;

    estimatedProbability: number;

    marketProbability: number;

    edge: number;

    confidence: number;

    expectedReturnUsdc: number;

    expectedProfitUsdc: number;

    riskLevel: ExecutionRiskLevel;

    reasoning: string;

    keyFactors: string[];

    risks: string[];

    research: {
        summary: string;

        sourceCount: number;

        sources: ExecutionPlanSource[];

        costUsdc: number;
    };

    riskChecks: RiskCheckResult[];

    execution: {
        requiresApproval: boolean;

        allowExecution: boolean;

        dryRun: boolean;

        expectedContract?: string;

        slippageBps: number;

        deadline: string;
    };

    createdAt: string;

    expiresAt: string;

    metadata?: Record<string, unknown>;
}

export interface RuntimeMemoryContext {
    summary: string;

    recentLessons: string[];

    recentDecisions: Array<{
        marketId: string;

        action: AgentAction;

        probability: number;

        confidence: number;

        edge: number;

        reasoning: string;
    }>;

    recentOutcomes: Array<{
        marketId: string;

        resolution:
        | "YES"
        | "NO"
        | "INVALID"
        | "CANCELLED";

        pnlUsdc: number;

        won: boolean | null;
    }>;
}