import type {
    AgentRun,
    ConsensusResult,
} from "./dashboard.types";

interface ProfileReasoningGridProps {
    runs: AgentRun[];
    consensus: ConsensusResult | null;
}

export default function ProfileReasoningGrid({
    runs,
    consensus,
}: ProfileReasoningGridProps) {
    const profileRuns = runs.filter(
        (run) =>
            run.profile_id !== "ensemble",
    );

    const members =
        consensus?.members ?? [];

    if (
        profileRuns.length === 0 &&
        members.length === 0
    ) {
        return null;
    }

    return (
        <section>
            <div className="mb-3 flex items-center justify-between">
                <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-violet-600">
                        Profile analysis
                    </p>

                    <h3 className="mt-2 text-xl font-black text-slate-950">
                        Independent agent views
                    </h3>
                </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
                {members.length > 0
                    ? members.map((member) => (
                        <ProfileCard
                            key={member.runId}
                            profileId={
                                member.profileId
                            }
                            action={
                                member.action
                            }
                            probability={
                                member.probability
                            }
                            confidence={
                                member.confidence
                            }
                            edge={
                                member.edge
                            }
                            reasoning={
                                member.reasoning
                            }
                        />
                    ))
                    : profileRuns
                        .slice(0, 3)
                        .map((run) => (
                            <ProfileCard
                                key={run.id}
                                profileId={
                                    run.profile_id
                                }
                                action={
                                    run.decision
                                        ?.action ??
                                    "PASS"
                                }
                                probability={
                                    run.decision
                                        ?.probability ??
                                    0
                                }
                                confidence={
                                    run.decision
                                        ?.confidence ??
                                    0
                                }
                                edge={
                                    run.decision
                                        ?.edge ??
                                    0
                                }
                                reasoning={
                                    run.decision
                                        ?.reasoning ??
                                    run.error_message ??
                                    "No reasoning was recorded."
                                }
                            />
                        ))}
            </div>
        </section>
    );
}

function ProfileCard({
    profileId,
    action,
    probability,
    confidence,
    edge,
    reasoning,
}: {
    profileId: string;
    action: string;
    probability: number;
    confidence: number;
    edge: number;
    reasoning: string;
}) {
    return (
        <article className="rounded-[22px] border border-black/10 bg-[#fffdf8] p-5">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-[8px] font-black uppercase tracking-[0.15em] text-slate-400">
                        Profile
                    </p>

                    <h4 className="mt-2 text-lg font-black capitalize text-slate-950">
                        {profileId.replaceAll(
                            "-",
                            " ",
                        )}
                    </h4>
                </div>

                <ActionBadge
                    action={action}
                />
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
                <SmallMetric
                    label="Forecast"
                    value={`${(
                        probability * 100
                    ).toFixed(1)}%`}
                />

                <SmallMetric
                    label="Confidence"
                    value={`${(
                        confidence * 100
                    ).toFixed(1)}%`}
                />

                <SmallMetric
                    label="Edge"
                    value={`${edge > 0 ? "+" : ""}${(
                        edge * 100
                    ).toFixed(2)}%`}
                />
            </div>

            <details className="group mt-5">
                <summary className="cursor-pointer list-none text-[9px] font-black uppercase tracking-[0.14em] text-violet-600">
                    View reasoning
                </summary>

                <p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-600">
                    {reasoning}
                </p>
            </details>
        </article>
    );
}

function SmallMetric({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-[14px] border border-black/10 bg-white px-3 py-3">
            <p className="text-[7px] font-black uppercase tracking-[0.12em] text-slate-400">
                {label}
            </p>

            <p className="mt-1.5 text-sm font-black text-slate-950">
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
    const classes =
        action === "BUY_YES"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : action === "BUY_NO"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-amber-200 bg-amber-50 text-amber-700";

    return (
        <span
            className={`rounded-full border px-3 py-2 text-[8px] font-black uppercase tracking-[0.12em] ${classes}`}
        >
            {action.replaceAll("_", " ")}
        </span>
    );
}