import type {
    AgentRun,
    ConsensusResult,
} from "./dashboard.types";

interface AgentTimelineProps {
    runs: AgentRun[];
    consensus: ConsensusResult | null;
    isRunning: boolean;
    runStage: RunStage;
}

interface TimelineEvent {
    id: string;
    label: string;
    detail: string;
    timestamp?: string;
    status:
    | "complete"
    | "active"
    | "skipped"
    | "failed";
}

type RunStage =
    | "idle"
    | "research"
    | "forecast"
    | "execution"
    | "done";

export default function AgentTimeline({
    runs,
    consensus,
    isRunning,
    runStage,
}: AgentTimelineProps) {
    const events =
        buildTimelineEvents({
            runs,
            consensus,
            isRunning,
            runStage,
        });

    return (
        <section className="overflow-hidden rounded-[22px] border border-violet-200 bg-[#fffdf8]">
            <div className="flex items-center justify-between border-b border-violet-100 px-6 py-5">
                <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-violet-600">
                        Agent timeline
                    </p>

                    <h3 className="mt-2 text-xl font-black text-slate-950">
                        Latest run activity
                    </h3>
                </div>

                <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-2 text-[8px] font-black uppercase tracking-[0.13em] text-violet-700">
                    Arc Testnet
                </span>
            </div>

            <div className="p-6">
                {events.length === 0 ? (
                    <p className="text-sm text-slate-500">
                        No runtime activity has
                        been recorded yet.
                    </p>
                ) : (
                    <div className="relative space-y-0">
                        <div className="absolute bottom-4 left-[7px] top-4 w-px bg-violet-100" />

                        {events.map(
                            (event) => (
                                <TimelineRow
                                    key={event.id}
                                    event={event}
                                />
                            ),
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}

function TimelineRow({
    event,
}: {
    event: TimelineEvent;
}) {
    const dotClass =
        event.status === "failed"
            ? "bg-red-500"
            : event.status ===
                "active"
                ? "animate-pulse bg-blue-500"
                : event.status ===
                    "skipped"
                    ? "bg-amber-500"
                    : "bg-violet-500";

    return (
        <div className="relative flex gap-4 pb-6 last:pb-0">
            <span
                className={`relative z-10 mt-1.5 h-[15px] w-[15px] shrink-0 rounded-full border-[4px] border-[#fffdf8] ${dotClass}`}
            />

            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-black text-slate-950">
                        {event.label}
                    </p>

                    {event.timestamp && (
                        <span className="text-[8px] font-black uppercase tracking-[0.12em] text-slate-400">
                            {formatTime(
                                event.timestamp,
                            )}
                        </span>
                    )}
                </div>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                    {event.detail}
                </p>
            </div>
        </div>
    );
}

function buildTimelineEvents({
    runs,
    consensus,
    isRunning,
    runStage,
}: {
    runs: AgentRun[];
    consensus: ConsensusResult | null;
    isRunning: boolean;
    runStage: RunStage;
}): TimelineEvent[] {
    const events: TimelineEvent[] = [];

    if (isRunning) {
        const stageContent: Record<
            Exclude<
                RunStage,
                "idle" | "done"
            >,
            {
                label: string;
                detail: string;
            }
        > = {
            research: {
                label:
                    "Researching market",
                detail:
                    "Collecting and evaluating available market evidence.",
            },

            forecast: {
                label:
                    "Generating forecast",
                detail:
                    "Calculating probability, confidence, and directional edge.",
            },

            execution: {
                label:
                    "Building execution plan",
                detail:
                    "Applying position sizing and runtime risk checks.",
            },
        };

        const currentStage =
            runStage === "research" ||
                runStage === "forecast" ||
                runStage === "execution"
                ? stageContent[
                runStage
                ]
                : {
                    label:
                        "Agent runtime active",
                    detail:
                        "The agent is evaluating the selected market.",
                };

        events.push({
            id:
                "runtime-active",

            label:
                currentStage.label,

            detail:
                currentStage.detail,

            status:
                "active",
        });
    }
    const currentMemberRunIds =
        consensus?.members.map(
            (member) => member.runId,
        ) ?? [];

    const relevantRuns =
        currentMemberRunIds.length > 0
            ? runs
                .filter((run) =>
                    currentMemberRunIds.includes(
                        run.id,
                    ),
                )
                .sort(
                    (a, b) =>
                        new Date(
                            a.created_at,
                        ).getTime() -
                        new Date(
                            b.created_at,
                        ).getTime(),
                )
            : runs.slice(0, 1);

    for (const run of relevantRuns) {
        const timestamp =
            run.completed_at ??
            run.created_at;

        events.push({
            id: `${run.id}-research`,
            label: `${formatProfile(
                run.profile_id,
            )} research completed`,
            detail:
                run.research?.summary ??
                "Research stage completed.",
            timestamp,
            status:
                run.status === "failed"
                    ? "failed"
                    : "complete",
        });

        if (run.decision) {
            events.push({
                id: `${run.id}-decision`,
                label: `${formatProfile(
                    run.profile_id,
                )} recommended ${run.decision.action.replaceAll(
                    "_",
                    " ",
                )}`,
                detail: `${(
                    run.decision.probability *
                    100
                ).toFixed(
                    1,
                )}% probability · ${(
                    run.decision.confidence *
                    100
                ).toFixed(
                    1,
                )}% confidence · ${(
                    run.decision.edge *
                    100
                ).toFixed(
                    1,
                )}% edge.`,
                timestamp,
                status:
                    run.decision.action ===
                        "PASS"
                        ? "skipped"
                        : "complete",
            });
        }

        if (run.execution_plan) {
            const allowExecution =
                run.execution_plan
                    .execution
                    ?.allowExecution ??
                false;

            events.push({
                id: `${run.id}-execution`,
                label:
                    run.execution_plan
                        .status ===
                        "skipped"
                        ? "Execution skipped"
                        : allowExecution
                            ? "Execution plan ready"
                            : "Execution blocked",
                detail:
                    run.execution_plan
                        .status ===
                        "skipped"
                        ? "The run completed without creating an executable position."
                        : allowExecution
                            ? `${run.execution_plan.amountUsdc.toFixed(
                                2,
                            )} USDC position approved by the runtime.`
                            : "The runtime risk checks prevented execution.",
                timestamp:
                    run.execution_plan
                        .createdAt ??
                    timestamp,
                status:
                    run.execution_plan
                        .status ===
                        "skipped" ||
                        !allowExecution
                        ? "skipped"
                        : "complete",
            });
        }
    }

    if (consensus) {
        events.push({
            id: `${consensus.id}-consensus`,
            label: `Consensus ${consensus.action.replaceAll(
                "_",
                " ",
            )}`,
            detail: `${formatAgreement(
                consensus.agreement,
            )}. Combined forecast ${(
                consensus.probability *
                100
            ).toFixed(1)}%.`,
            timestamp:
                consensus.executionPlan
                    .createdAt,
            status:
                consensus.action ===
                    "PASS"
                    ? "skipped"
                    : "complete",
        });

        events.push({
            id: `${consensus.id}-execution`,
            label:
                consensus.executionPlan
                    .execution
                    .allowExecution
                    ? "Execution plan ready"
                    : "Execution skipped",
            detail:
                consensus.executionPlan
                    .execution
                    .allowExecution
                    ? `${consensus.amountUsdc.toFixed(
                        2,
                    )} USDC position approved by the runtime.`
                    : "No executable edge was identified.",
            timestamp:
                consensus.executionPlan
                    .createdAt,
            status:
                consensus.executionPlan
                    .execution
                    .allowExecution
                    ? "complete"
                    : "skipped",
        });
    }

    return events;
}

function formatProfile(
    profileId: string,
): string {
    return profileId
        .replaceAll("-", " ")
        .replace(/\b\w/g, (value) =>
            value.toUpperCase(),
        );
}

function formatAgreement(
    agreement: string,
): string {
    if (agreement === "none") {
        return "No directional agreement";
    }

    return `${agreement} agreement`;
}

function formatTime(
    value: string,
): string {
    const date = new Date(value);

    if (
        !Number.isFinite(
            date.getTime(),
        )
    ) {
        return "";
    }

    return date.toLocaleTimeString(
        [],
        {
            hour: "2-digit",
            minute: "2-digit",
        },
    );
}