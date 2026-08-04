import type {
    AgentDifficulty,
    AgentProfileSource,
} from "../core/types";

export type AgentManifestCapability =
    | "research"
    | "prediction"
    | "trading"
    | "news-research"
    | "historical-research"
    | "onchain-research"
    | "paid-research"
    | "source-evaluation"
    | "sentiment-analysis"
    | "base-rate-analysis"
    | "bayesian-reasoning"
    | "wallet-monitoring"
    | "capital-flow-analysis"
    | "risk-management"
    | "position-sizing"
    | string;

export interface AgentManifestAuthor {
    name: string;

    walletAddress?: string;

    website?: string;

    email?: string;

    github?: string;

    metadata?: Record<string, unknown>;
}

export interface AgentManifestRepository {
    type?: "git";

    url: string;

    commit?: string;

    directory?: string;
}

export interface AgentManifestRuntime {
    /**
     * Minimum compatible Bruh runtime version.
     */
    minimumVersion?: string;

    /**
     * Maximum compatible Bruh runtime version.
     */
    maximumVersion?: string;

    /**
     * Optional runtime entry point for packaged agents.
     */
    entrypoint?: string;

    /**
     * Whether Bruh should execute this agent locally or remotely.
     */
    executionMode?: "local" | "remote";

    /**
     * Required only for remote agents.
     */
    endpoint?: string;

    timeoutMs?: number;
}

export interface AgentManifestPermissions {
    canResearch: boolean;

    canPurchaseResearch: boolean;

    canTrade: boolean;

    canAccessHistoricalData: boolean;

    canAccessOnchainData: boolean;

    canUseExternalApis: boolean;

    maximumResearchSpendUsdc?: number;

    maximumTradeUsdc?: number;

    allowedMarketCategories?: string[];

    allowedNetworks?: string[];
}

export interface AgentManifestRiskDefaults {
    edgeThreshold?: number;

    kellyFraction?: number;

    maxPositionUsdc?: number;

    researchBudgetUsdc?: number;

    maximumMarketExposureUsdc?: number;

    maxDailyLossUsdc?: number;

    minimumConfidence?: number;
}

export interface AgentManifest {
    /**
     * Stable lowercase identifier.
     *
     * Example:
     * fed-watcher
     */
    id: string;

    name: string;

    version: string;

    description: string;

    source: AgentProfileSource;

    difficulty: AgentDifficulty;

    author: AgentManifestAuthor;

    categories: string[];

    capabilities: AgentManifestCapability[];

    tags?: string[];

    icon?: string;

    banner?: string;

    website?: string;

    documentation?: string;

    repository?: AgentManifestRepository;

    runtime?: AgentManifestRuntime;

    permissions: AgentManifestPermissions;

    riskDefaults?: AgentManifestRiskDefaults;

    metadata?: Record<string, unknown>;
}

export interface AgentManifestValidationResult {
    valid: boolean;

    errors: AgentManifestValidationIssue[];

    warnings: AgentManifestValidationIssue[];
}

export interface AgentManifestValidationIssue {
    field: string;

    code: string;

    message: string;
}

export class AgentManifestValidationError extends Error {
    readonly issues: AgentManifestValidationIssue[];

    constructor(
        message: string,
        issues: AgentManifestValidationIssue[],
    ) {
        super(message);

        this.name = "AgentManifestValidationError";
        this.issues = issues;
    }
}

export function validateAgentManifest(
    manifest: AgentManifest,
): AgentManifestValidationResult {
    const errors: AgentManifestValidationIssue[] = [];
    const warnings: AgentManifestValidationIssue[] = [];

    if (!manifest.id?.trim()) {
        errors.push({
            field: "id",
            code: "MISSING_AGENT_ID",
            message: "Agent manifest requires an ID.",
        });
    } else if (!isValidAgentId(manifest.id)) {
        errors.push({
            field: "id",
            code: "INVALID_AGENT_ID",
            message:
                "Agent ID must contain lowercase letters, numbers and hyphens only.",
        });
    }

    if (!manifest.name?.trim()) {
        errors.push({
            field: "name",
            code: "MISSING_AGENT_NAME",
            message: "Agent manifest requires a name.",
        });
    }

    if (!manifest.version?.trim()) {
        errors.push({
            field: "version",
            code: "MISSING_AGENT_VERSION",
            message: "Agent manifest requires a version.",
        });
    } else if (!isValidSemanticVersion(manifest.version)) {
        errors.push({
            field: "version",
            code: "INVALID_AGENT_VERSION",
            message:
                "Agent version must use semantic versioning, for example 1.0.0.",
        });
    }

    if (!manifest.description?.trim()) {
        errors.push({
            field: "description",
            code: "MISSING_AGENT_DESCRIPTION",
            message: "Agent manifest requires a description.",
        });
    }

    if (!manifest.author?.name?.trim()) {
        errors.push({
            field: "author.name",
            code: "MISSING_AGENT_AUTHOR",
            message: "Agent manifest requires an author name.",
        });
    }

    if (!Array.isArray(manifest.categories)) {
        errors.push({
            field: "categories",
            code: "INVALID_AGENT_CATEGORIES",
            message: "Agent categories must be an array.",
        });
    }

    if (
        !Array.isArray(manifest.capabilities) ||
        manifest.capabilities.length === 0
    ) {
        errors.push({
            field: "capabilities",
            code: "MISSING_AGENT_CAPABILITIES",
            message: "Agent manifest requires at least one capability.",
        });
    }

    validatePermissions(manifest.permissions, errors);
    validateRiskDefaults(manifest.riskDefaults, errors);

    if (
        manifest.runtime?.executionMode === "remote" &&
        !manifest.runtime.endpoint
    ) {
        errors.push({
            field: "runtime.endpoint",
            code: "MISSING_REMOTE_AGENT_ENDPOINT",
            message:
                "Remote agents must provide a runtime endpoint.",
        });
    }

    if (
        manifest.runtime?.endpoint &&
        !isValidUrl(manifest.runtime.endpoint)
    ) {
        errors.push({
            field: "runtime.endpoint",
            code: "INVALID_REMOTE_AGENT_ENDPOINT",
            message: "Agent runtime endpoint must be a valid URL.",
        });
    }

    if (
        manifest.permissions.canTrade &&
        !manifest.capabilities.includes("trading")
    ) {
        warnings.push({
            field: "capabilities",
            code: "TRADING_CAPABILITY_NOT_DECLARED",
            message:
                "The agent can trade but does not declare the trading capability.",
        });
    }

    if (
        manifest.permissions.canPurchaseResearch &&
        !manifest.capabilities.includes("paid-research")
    ) {
        warnings.push({
            field: "capabilities",
            code: "PAID_RESEARCH_CAPABILITY_NOT_DECLARED",
            message:
                "The agent can purchase research but does not declare the paid-research capability.",
        });
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}

export function assertValidAgentManifest(
    manifest: AgentManifest,
): AgentManifest {
    const result = validateAgentManifest(manifest);

    if (!result.valid) {
        throw new AgentManifestValidationError(
            `Invalid agent manifest for "${manifest.name || manifest.id || "unknown"}".`,
            result.errors,
        );
    }

    return manifest;
}

export function normalizeAgentManifest(
    manifest: AgentManifest,
): AgentManifest {
    return {
        ...manifest,

        id: manifest.id.trim().toLowerCase(),

        name: manifest.name.trim(),

        version: manifest.version.trim(),

        description: manifest.description.trim(),

        categories: normalizeStrings(manifest.categories),

        capabilities: normalizeStrings(
            manifest.capabilities,
        ),

        tags: manifest.tags
            ? normalizeStrings(manifest.tags)
            : undefined,

        author: {
            ...manifest.author,
            name: manifest.author.name.trim(),
        },

        runtime: manifest.runtime
            ? {
                ...manifest.runtime,

                endpoint:
                    manifest.runtime.endpoint?.trim(),
            }
            : undefined,

        permissions: {
            ...manifest.permissions,

            allowedMarketCategories:
                manifest.permissions.allowedMarketCategories
                    ? normalizeStrings(
                        manifest.permissions
                            .allowedMarketCategories,
                    )
                    : undefined,

            allowedNetworks:
                manifest.permissions.allowedNetworks
                    ? normalizeStrings(
                        manifest.permissions.allowedNetworks,
                    )
                    : undefined,
        },
    };
}

function validatePermissions(
    permissions: AgentManifestPermissions | undefined,
    errors: AgentManifestValidationIssue[],
): void {
    if (!permissions) {
        errors.push({
            field: "permissions",
            code: "MISSING_AGENT_PERMISSIONS",
            message: "Agent manifest requires permissions.",
        });

        return;
    }

    const booleanFields: Array<
        keyof AgentManifestPermissions
    > = [
            "canResearch",
            "canPurchaseResearch",
            "canTrade",
            "canAccessHistoricalData",
            "canAccessOnchainData",
            "canUseExternalApis",
        ];

    for (const field of booleanFields) {
        if (typeof permissions[field] !== "boolean") {
            errors.push({
                field: `permissions.${field}`,
                code: "INVALID_AGENT_PERMISSION",
                message: `${field} must be a boolean.`,
            });
        }
    }

    validateOptionalNonNegativeNumber(
        permissions.maximumResearchSpendUsdc,
        "permissions.maximumResearchSpendUsdc",
        errors,
    );

    validateOptionalNonNegativeNumber(
        permissions.maximumTradeUsdc,
        "permissions.maximumTradeUsdc",
        errors,
    );
}

function validateRiskDefaults(
    defaults: AgentManifestRiskDefaults | undefined,
    errors: AgentManifestValidationIssue[],
): void {
    if (!defaults) {
        return;
    }

    validateOptionalProbability(
        defaults.edgeThreshold,
        "riskDefaults.edgeThreshold",
        errors,
    );

    validateOptionalProbability(
        defaults.kellyFraction,
        "riskDefaults.kellyFraction",
        errors,
    );

    validateOptionalProbability(
        defaults.minimumConfidence,
        "riskDefaults.minimumConfidence",
        errors,
    );

    validateOptionalNonNegativeNumber(
        defaults.maxPositionUsdc,
        "riskDefaults.maxPositionUsdc",
        errors,
    );

    validateOptionalNonNegativeNumber(
        defaults.researchBudgetUsdc,
        "riskDefaults.researchBudgetUsdc",
        errors,
    );

    validateOptionalNonNegativeNumber(
        defaults.maximumMarketExposureUsdc,
        "riskDefaults.maximumMarketExposureUsdc",
        errors,
    );

    validateOptionalNonNegativeNumber(
        defaults.maxDailyLossUsdc,
        "riskDefaults.maxDailyLossUsdc",
        errors,
    );
}

function validateOptionalProbability(
    value: number | undefined,
    field: string,
    errors: AgentManifestValidationIssue[],
): void {
    if (value === undefined) {
        return;
    }

    if (
        !Number.isFinite(value) ||
        value < 0 ||
        value > 1
    ) {
        errors.push({
            field,
            code: "INVALID_PROBABILITY_VALUE",
            message: `${field} must be between 0 and 1.`,
        });
    }
}

function validateOptionalNonNegativeNumber(
    value: number | undefined,
    field: string,
    errors: AgentManifestValidationIssue[],
): void {
    if (value === undefined) {
        return;
    }

    if (!Number.isFinite(value) || value < 0) {
        errors.push({
            field,
            code: "INVALID_NON_NEGATIVE_VALUE",
            message: `${field} must be a non-negative number.`,
        });
    }
}

function normalizeStrings<T extends string>(
    values: T[],
): T[] {
    return [
        ...new Set(
            values
                .map((value) =>
                    value.trim().toLowerCase(),
                )
                .filter(Boolean),
        ),
    ] as T[];
}

function isValidAgentId(value: string): boolean {
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
        value.trim(),
    );
}

function isValidSemanticVersion(
    value: string,
): boolean {
    return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(
        value.trim(),
    );
}

function isValidUrl(value: string): boolean {
    try {
        new URL(value);
        return true;
    } catch {
        return false;
    }
}