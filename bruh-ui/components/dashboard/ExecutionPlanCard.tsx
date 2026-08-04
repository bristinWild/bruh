import type {
    ExecutionPlan,
} from "./dashboard.types";

interface ExecutionPlanCardProps {
    plan: ExecutionPlan | null;
}

export default function ExecutionPlanCard({
    plan,
}: ExecutionPlanCardProps) {
    if (!plan) {
        return null;
    }

    const deadline =
        new Date(plan.execution.deadline);

    const expired =
        Number.isFinite(
            deadline.getTime(),
        ) &&
        deadline.getTime() <
        Date.now();

    return (
        <section className="rounded-[22px] border border-black/10 bg-slate-950 p-6 text-white">
            <div className="flex flex-wrap items-start justify-between gap-5">
                <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-cyan-300">
                        Final execution plan
                    </p>

                    <h3 className="mt-3 text-3xl font-black">
                        {plan.action.replaceAll(
                            "_",
                            " ",
                        )}
                    </h3>

                    <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
                        {plan.marketQuestion}
                    </p>
                </div>

                <StatusBadge
                    executable={
                        plan.execution
                            .allowExecution
                    }
                    expired={expired}
                />
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <DarkMetric
                    label="Amount"
                    value={`${plan.amountUsdc.toFixed(
                        2,
                    )} USDC`}
                />

                <DarkMetric
                    label="Side"
                    value={plan.side ?? "None"}
                />

                <DarkMetric
                    label="Risk"
                    value={plan.riskLevel}
                />

                <DarkMetric
                    label="Slippage"
                    value={`${(
                        plan.execution
                            .slippageBps / 100
                    ).toFixed(2)}%`}
                />
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-2">
                <InfoBlock
                    label="Agent wallet"
                    value={
                        plan.walletAddress ??
                        "Not assigned"
                    }
                />

                <InfoBlock
                    label="Market contract"
                    value={
                        plan.execution
                            .expectedContract ??
                        plan.marketId
                    }
                />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 text-[8px] font-black uppercase tracking-[0.13em] text-slate-400">
                <span>
                    Created{" "}
                    {formatDate(
                        plan.createdAt,
                    )}
                </span>

                <span>•</span>

                <span>
                    Expires{" "}
                    {formatDate(
                        plan.expiresAt,
                    )}
                </span>
            </div>

            {plan.risks.length > 0 && (
                <div className="mt-6 border-t border-white/10 pt-5">
                    <p className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-500">
                        Identified risks
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                        {plan.risks.map(
                            (risk) => (
                                <span
                                    key={risk}
                                    className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[9px] leading-4 text-slate-300"
                                >
                                    {risk}
                                </span>
                            ),
                        )}
                    </div>
                </div>
            )}
        </section>
    );
}

function DarkMetric({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-[16px] border border-white/10 bg-white/5 px-4 py-4">
            <p className="text-[8px] font-black uppercase tracking-[0.13em] text-slate-500">
                {label}
            </p>

            <p className="mt-2 truncate text-base font-black capitalize text-white">
                {value}
            </p>
        </div>
    );
}

function InfoBlock({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="min-w-0 rounded-[16px] border border-white/10 bg-white/5 p-4">
            <p className="text-[8px] font-black uppercase tracking-[0.13em] text-slate-500">
                {label}
            </p>

            <p className="mt-2 truncate font-mono text-[10px] text-slate-300">
                {value}
            </p>
        </div>
    );
}

function StatusBadge({
    executable,
    expired,
}: {
    executable: boolean;
    expired: boolean;
}) {
    const label = expired
        ? "Expired"
        : executable
            ? "Ready"
            : "Skipped";

    return (
        <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[8px] font-black uppercase tracking-[0.14em] text-slate-300">
            {label}
        </span>
    );
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