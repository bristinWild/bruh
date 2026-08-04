import type {
    AgentRun,
} from "./dashboard.types";

interface RunHistoryPanelProps {
    runs: AgentRun[];
}

export default function RunHistoryPanel({
    runs,
}: RunHistoryPanelProps) {
    if (runs.length === 0) {
        return (
            <section className="rounded-[22px] border border-black/10 bg-[#fffdf8] p-8">
                <p className="text-sm text-slate-500">
                    No agent runs recorded yet.
                </p>
            </section>
        );
    }

    return (
        <section className="overflow-hidden rounded-[22px] border border-black/10 bg-[#fffdf8]">
            <div className="border-b border-black/10 px-6 py-5">
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-violet-600">
                    Run history
                </p>

                <h3 className="mt-2 text-xl font-black text-slate-950">
                    Previous decisions
                </h3>
            </div>

            <div className="divide-y divide-black/5">
                {runs.map((run) => (
                    <details
                        key={run.id}
                        className="group"
                    >
                        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-4 px-6 py-5">
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-black text-slate-950">
                                    {run.market_question}
                                </p>

                                <p className="mt-1 text-[8px] font-black uppercase tracking-[0.13em] text-slate-400">
                                    {run.profile_id} ·{" "}
                                    {formatDate(
                                        run.created_at,
                                    )}
                                </p>
                            </div>

                            <ActionBadge
                                action={
                                    run.decision?.action ??
                                    "PASS"
                                }
                            />

                            <span className="min-w-[70px] text-right text-sm font-black text-slate-950">
                                {formatEdge(
                                    run.decision?.edge ??
                                    0,
                                )}
                            </span>
                        </summary>

                        <div className="bg-white/70 px-6 pb-6 pt-2">
                            <div className="grid gap-3 sm:grid-cols-3">
                                <Metric
                                    label="Forecast"
                                    value={formatPercent(
                                        run.decision
                                            ?.probability ??
                                        0,
                                    )}
                                />

                                <Metric
                                    label="Confidence"
                                    value={formatPercent(
                                        run.decision
                                            ?.confidence ??
                                        0,
                                    )}
                                />

                                <Metric
                                    label="Position"
                                    value={`${(
                                        run.decision
                                            ?.amountUsdc ?? 0
                                    ).toFixed(2)} USDC`}
                                />
                            </div>

                            <p className="mt-5 whitespace-pre-line text-sm leading-7 text-slate-600">
                                {run.decision
                                    ?.reasoning ??
                                    run.error_message ??
                                    "No reasoning was recorded."}
                            </p>
                        </div>
                    </details>
                ))}
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
        <div className="rounded-[14px] border border-black/10 bg-white px-4 py-3">
            <p className="text-[7px] font-black uppercase tracking-[0.12em] text-slate-400">
                {label}
            </p>

            <p className="mt-2 text-sm font-black text-slate-950">
                {value}
            </p>
        </div>
    );
}

function ActionBadge({
    action,
}: {
    action: string;
}) {
    return (
        <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-2 text-[8px] font-black uppercase tracking-[0.12em] text-violet-700">
            {action.replaceAll("_", " ")}
        </span>
    );
}

function formatPercent(
    value: number,
): string {
    return `${(value * 100).toFixed(
        1,
    )}%`;
}

function formatEdge(
    value: number,
): string {
    const percentage =
        value * 100;

    return `${percentage > 0 ? "+" : ""
        }${percentage.toFixed(2)}%`;
}

function formatDate(
    value: string,
): string {
    const date = new Date(value);

    if (
        !Number.isFinite(
            date.getTime(),
        )
    ) {
        return "Unknown";
    }

    return date.toLocaleString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        },
    );
}