import type {
    AgentRun,
    ConsensusResult,
} from "./dashboard.types";

interface ConsensusOverviewProps {
    consensus: ConsensusResult | null;
    latestRun: AgentRun | null;
    error?: string | null;
}

export default function ConsensusOverview({
    consensus,
    latestRun,
    error,
}: ConsensusOverviewProps) {
    if (error) {
        return (
            <section className="rounded-[24px] border border-red-200 bg-red-50 p-6">
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-red-600">
                    Agent run failed
                </p>

                <p className="mt-3 text-sm leading-6 text-red-900">
                    {error}
                </p>
            </section>
        );
    }

    const decision = consensus
        ? {
            action: consensus.action,
            probability:
                consensus.probability,
            marketProbability:
                consensus.marketProbability,
            confidence:
                consensus.confidence,
            edge: consensus.edge,
            amountUsdc:
                consensus.amountUsdc,
            reasoning:
                consensus.reasoning,
            agreement:
                consensus.agreement,
            executable:
                consensus.executionPlan.execution
                    .allowExecution,
        }
        : latestRun?.decision
            ? {
                action:
                    latestRun.decision.action,
                probability:
                    latestRun.decision
                        .probability,
                marketProbability:
                    latestRun.decision
                        .marketProbability,
                confidence:
                    latestRun.decision
                        .confidence,
                edge:
                    latestRun.decision.edge,
                amountUsdc:
                    latestRun.decision
                        .amountUsdc,
                reasoning:
                    latestRun.decision
                        .reasoning,
                agreement:
                    latestRun.profile_id,
                executable:
                    latestRun.execution_plan
                        ?.execution
                        .allowExecution ??
                    false,
            }
            : null;

    if (!decision) {
        return (
            <section className="rounded-[24px] border border-black/10 bg-[#fffdf8] p-8">
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">
                    Consensus engine
                </p>

                <h2 className="mt-3 max-w-lg text-2xl font-black leading-tight text-slate-950">
                    Run this agent to generate a
                    forecast and execution plan.
                </h2>
            </section>
        );
    }

    const actionClass =
        decision.action === "BUY_YES"
            ? "text-emerald-600"
            : decision.action === "BUY_NO"
                ? "text-red-600"
                : "text-amber-600";

    return (
        <section className="rounded-[24px] border border-violet-200 bg-[#fffdf8] p-6 shadow-[0_18px_55px_rgba(76,29,149,0.06)]">
            <div className="flex flex-wrap items-start justify-between gap-5">
                <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-violet-600">
                        Consensus engine
                    </p>

                    <h2
                        className={`mt-3 text-5xl font-black tracking-[-0.05em] ${actionClass}`}
                    >
                        {formatAction(
                            decision.action,
                        )}
                    </h2>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Badge>
                            {formatAgreement(
                                decision.agreement,
                            )}
                        </Badge>

                        <Badge>
                            Market{" "}
                            {formatPercent(
                                decision.marketProbability,
                                1,
                            )}
                        </Badge>
                    </div>
                </div>

                <div className="min-w-[110px] rounded-[18px] border border-black/10 bg-white px-5 py-4 text-right">
                    <p className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Executable
                    </p>

                    <p className="mt-2 text-lg font-black text-slate-950">
                        {decision.executable
                            ? "Yes"
                            : "No"}
                    </p>
                </div>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Metric
                    label="Forecast"
                    value={formatPercent(
                        decision.probability,
                        1,
                    )}
                />

                <Metric
                    label="Confidence"
                    value={formatPercent(
                        decision.confidence,
                        1,
                    )}
                />

                <Metric
                    label="Edge"
                    value={formatSignedPercent(
                        decision.edge,
                    )}
                />

                <Metric
                    label="Position"
                    value={`${decision.amountUsdc.toFixed(
                        2,
                    )} USDC`}
                />
            </div>

            <div className="mt-5 rounded-[18px] border border-black/10 bg-white/75 p-5">
                <p className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-400">
                    Consensus summary
                </p>

                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">
                    {decision.reasoning}
                </p>
            </div>
        </section>
    );
}

function Metric({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-[18px] border border-black/10 bg-white px-5 py-4">
            <p className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-400">
                {label}
            </p>

            <p className="mt-2 text-xl font-black text-slate-950">
                {value}
            </p>
        </div>
    );
}

function Badge({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.13em] text-violet-700">
            {children}
        </span>
    );
}

function formatAction(
    action: string,
): string {
    return action.replaceAll("_", " ");
}

function formatAgreement(
    agreement: string,
): string {
    if (agreement === "none") {
        return "No directional agreement";
    }

    return `${agreement} agreement`;
}

function formatPercent(
    value: number,
    digits = 1,
): string {
    return `${(value * 100).toFixed(
        digits,
    )}%`;
}

function formatSignedPercent(
    value: number,
): string {
    const percent = value * 100;

    return `${percent > 0 ? "+" : ""
        }${percent.toFixed(2)}%`;
}