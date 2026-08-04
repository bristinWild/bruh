import type {
    ConsensusResult,
} from "./dashboard.types";

interface ConsensusPanelProps {
    consensus:
    ConsensusResult | null;

    latestRun?: {
        profile_id: string;
        market_question: string;
        status: string;
        decision?: {
            action?: string;
            probability?: number;
            confidence?: number;
            edge?: number;
            reasoning?: string;
        } | null;
        execution_plan?: {
            action?: string;
            amountUsdc?: number;
            riskLevel?: string;
            execution?: {
                allowExecution?: boolean;
            };
        } | null;
    } | null;

    error?: string | null;
}

export default function ConsensusPanel({
    consensus,
    latestRun,
    error,
}: ConsensusPanelProps) {
    if (error) {
        return (
            <section className="rounded-[22px] border border-red-200 bg-red-50 p-6">
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-red-600">
                    Agent run failed
                </p>

                <p className="mt-3 text-sm leading-6 text-red-900">
                    {error}
                </p>
            </section>
        );
    }

    const decision =
        consensus
            ? {
                action:
                    consensus.action,
                probability:
                    consensus.probability,
                confidence:
                    consensus.confidence,
                edge:
                    consensus.edge,
                reasoning:
                    consensus.reasoning,
                amountUsdc:
                    consensus.amountUsdc,
                agreement:
                    consensus.agreement,
                allowExecution:
                    consensus
                        .executionPlan
                        .execution
                        .allowExecution,
            }
            : latestRun?.decision
                ? {
                    action:
                        latestRun.decision
                            .action ??
                        "PASS",

                    probability:
                        latestRun.decision
                            .probability ??
                        0,

                    confidence:
                        latestRun.decision
                            .confidence ??
                        0,

                    edge:
                        latestRun.decision
                            .edge ??
                        0,

                    reasoning:
                        latestRun.decision
                            .reasoning ??
                        "",

                    amountUsdc:
                        latestRun
                            .execution_plan
                            ?.amountUsdc ??
                        0,

                    agreement:
                        latestRun.profile_id,

                    allowExecution:
                        latestRun
                            .execution_plan
                            ?.execution
                            ?.allowExecution ??
                        false,
                }
                : null;

    if (!decision) {
        return (
            <section className="rounded-[22px] border border-black/10 bg-[#fffdf8] p-8">
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">
                    No decision yet
                </p>

                <h2 className="mt-3 text-2xl font-black text-slate-950">
                    Run the agent to generate an execution plan.
                </h2>
            </section>
        );
    }

    const actionClass =
        decision.action ===
            "BUY_YES"
            ? "text-emerald-600"
            : decision.action ===
                "BUY_NO"
                ? "text-red-600"
                : "text-amber-600";

    return (
        <section className="rounded-[22px] border border-violet-200 bg-[#fffdf8] p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-violet-600">
                        Final decision
                    </p>

                    <h2
                        className={`mt-3 text-4xl font-black ${actionClass}`}
                    >
                        {decision.action.replace(
                            "_",
                            " ",
                        )}
                    </h2>

                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        {decision.agreement}
                    </p>
                </div>

                <div className="rounded-[16px] border border-black/10 bg-white px-4 py-3 text-right">
                    <p className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Executable
                    </p>

                    <p className="mt-1 text-sm font-black text-slate-900">
                        {decision.allowExecution
                            ? "Yes"
                            : "No"}
                    </p>
                </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-4">
                <Metric
                    label="Probability"
                    value={`${(
                        decision.probability *
                        100
                    ).toFixed(1)}%`}
                />

                <Metric
                    label="Confidence"
                    value={`${(
                        decision.confidence *
                        100
                    ).toFixed(1)}%`}
                />

                <Metric
                    label="Edge"
                    value={`${(
                        decision.edge *
                        100
                    ).toFixed(2)}%`}
                />

                <Metric
                    label="Position"
                    value={`${decision.amountUsdc.toFixed(
                        2,
                    )} USDC`}
                />
            </div>

            <div className="mt-6 rounded-[16px] border border-black/10 bg-white/70 p-5">
                <p className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-400">
                    Reasoning
                </p>

                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">
                    {decision.reasoning}
                </p>
            </div>

            {consensus &&
                consensus.members.length >
                0 && (
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        {consensus.members.map(
                            (member) => (
                                <div
                                    key={member.runId}
                                    className="rounded-[16px] border border-black/10 bg-white p-4"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                                            {member.profileId}
                                        </p>

                                        <p className="text-xs font-black text-slate-900">
                                            {member.action}
                                        </p>
                                    </div>

                                    <p className="mt-3 text-xs leading-5 text-slate-500">
                                        {(
                                            member.probability *
                                            100
                                        ).toFixed(1)}
                                        % probability ·{" "}
                                        {(
                                            member.confidence *
                                            100
                                        ).toFixed(1)}
                                        % confidence
                                    </p>
                                </div>
                            ),
                        )}
                    </div>
                )}
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
        <div className="rounded-[16px] border border-black/10 bg-white px-4 py-3">
            <p className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-400">
                {label}
            </p>

            <p className="mt-2 text-lg font-black text-slate-950">
                {value}
            </p>
        </div>
    );
}