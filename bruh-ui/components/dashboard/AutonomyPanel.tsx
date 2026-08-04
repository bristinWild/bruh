"use client";

import {
    useEffect,
    useState,
} from "react";

import type {
    AgentAutonomyConfig,
    UpdateAgentAutonomyConfig,
} from "./dashboard.types";

interface AutonomyPanelProps {
    config: AgentAutonomyConfig | null;
    loading?: boolean;
    saving?: boolean;
    error?: string | null;

    onSave: (
        config: UpdateAgentAutonomyConfig,
    ) => Promise<void>;
}

export default function AutonomyPanel({
    config,
    loading = false,
    saving = false,
    error,
    onSave,
}: AutonomyPanelProps) {
    const [
        form,
        setForm,
    ] =
        useState<AgentAutonomyConfig>({
            autonomousEnabled: false,
            scheduleIntervalMinutes: 15,
            autoResearch: true,
            autoTrade: false,
            marketScanLimit: 10,
            lastScheduledRunAt: null,
        });

    useEffect(() => {
        if (config) {
            setForm(config);
        }
    }, [config]);

    async function save(
        patch: UpdateAgentAutonomyConfig,
    ) {
        const next = {
            ...form,
            ...patch,
        };

        setForm(next);

        try {
            await onSave(patch);
        } catch {
            if (config) {
                setForm(config);
            }
        }
    }

    if (loading) {
        return (
            <section className="rounded-[22px] border border-black/10 bg-[#fffdf8] p-6">
                <p className="text-sm text-slate-500">
                    Loading autonomy settings…
                </p>
            </section>
        );
    }

    return (
        <section className="overflow-hidden rounded-[22px] border border-violet-200 bg-[#fffdf8]">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-violet-100 px-6 py-5">
                <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-violet-600">
                        Autonomous scheduling
                    </p>

                    <h3 className="mt-2 text-xl font-black text-slate-950">
                        Agent operating permissions
                    </h3>

                    <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                        Let this agent scan open markets and run automatically on a schedule.
                    </p>
                </div>

                <StatusBadge
                    enabled={
                        form.autonomousEnabled
                    }

                />
            </div>

            <div className="space-y-5 p-6">
                {error && (
                    <div className="rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                <SettingRow
                    title="Autonomous mode"
                    description="Run this agent automatically according to the configured interval."
                >
                    <Toggle
                        checked={
                            form.autonomousEnabled
                        }
                        disabled={saving}
                        onChange={(checked) =>
                            void save({
                                autonomousEnabled:
                                    checked,
                            })
                        }
                    />
                </SettingRow>

                <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                        label="Run interval"
                        help="How often the agent checks for eligible markets."
                    >
                        <select
                            value={
                                form.scheduleIntervalMinutes
                            }
                            disabled={saving}
                            onChange={(event) =>
                                void save({
                                    scheduleIntervalMinutes:
                                        Number(
                                            event.target
                                                .value,
                                        ),
                                })
                            }
                            className="w-full rounded-[14px] border border-black/10 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-violet-400"
                        >
                            <option value={1}>
                                Every minute
                            </option>

                            <option value={5}>
                                Every 5 minutes
                            </option>

                            <option value={15}>
                                Every 15 minutes
                            </option>

                            <option value={30}>
                                Every 30 minutes
                            </option>

                            <option value={60}>
                                Every hour
                            </option>

                            <option value={360}>
                                Every 6 hours
                            </option>

                            <option value={1440}>
                                Every day
                            </option>
                        </select>
                    </Field>

                    <Field
                        label="Markets per scan"
                        help="Maximum markets inspected during each scheduled cycle."
                    >
                        <input
                            type="number"
                            min={1}
                            max={100}
                            value={
                                form.marketScanLimit
                            }
                            disabled={saving}
                            onChange={(event) =>
                                setForm(
                                    (current) => ({
                                        ...current,
                                        marketScanLimit:
                                            Number(
                                                event.target
                                                    .value,
                                            ),
                                    }),
                                )
                            }
                            onBlur={() =>
                                void save({
                                    marketScanLimit:
                                        Math.min(
                                            Math.max(
                                                form.marketScanLimit,
                                                1,
                                            ),
                                            100,
                                        ),
                                })
                            }
                            className="w-full rounded-[14px] border border-black/10 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-violet-400"
                        />
                    </Field>
                </div>

                <SettingRow
                    title="Automatic research"
                    description="Allow the scheduler to run market research before forecasting."
                >
                    <Toggle
                        checked={
                            form.autoResearch
                        }
                        disabled={saving}
                        onChange={(checked) =>
                            void save({
                                autoResearch:
                                    checked,
                            })
                        }
                    />
                </SettingRow>

                <SettingRow
                    title="Automatic trading"
                    description="Allow executable consensus plans to be sent to the Circle wallet."
                    warning
                >
                    <Toggle
                        checked={
                            form.autoTrade
                        }
                        disabled={
                            saving ||
                            !form.autonomousEnabled
                        }
                        onChange={(checked) =>
                            void save({
                                autoTrade:
                                    checked,
                            })
                        }
                        danger
                    />
                </SettingRow>

                {form.autoTrade && (
                    <div className="rounded-[16px] border border-amber-200 bg-amber-50 p-4">
                        <p className="text-[9px] font-black uppercase tracking-[0.14em] text-amber-700">
                            Live execution enabled
                        </p>

                        <p className="mt-2 text-sm leading-6 text-amber-900">
                            The agent may automatically submit trades when consensus, edge, confidence, and risk checks permit execution.
                        </p>
                    </div>
                )}

                <div className="border-t border-black/5 pt-5">
                    <p className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Last scheduled cycle
                    </p>

                    <p className="mt-2 text-sm font-bold text-slate-700">
                        {form.lastScheduledRunAt
                            ? formatDate(
                                form.lastScheduledRunAt,
                            )
                            : "Not run yet"}
                    </p>
                </div>
            </div>
        </section>
    );
}

function SettingRow({
    title,
    description,
    warning = false,
    children,
}: {
    title: string;
    description: string;
    warning?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div className="flex items-center justify-between gap-5 rounded-[16px] border border-black/10 bg-white p-4">
            <div>
                <p
                    className={`text-sm font-black ${warning
                        ? "text-amber-800"
                        : "text-slate-950"
                        }`}
                >
                    {title}
                </p>

                <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">
                    {description}
                </p>
            </div>

            {children}
        </div>
    );
}

function Field({
    label,
    help,
    children,
}: {
    label: string;
    help: string;
    children: React.ReactNode;
}) {
    return (
        <label className="rounded-[16px] border border-black/10 bg-white p-4">
            <span className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-500">
                {label}
            </span>

            <span className="mt-1 block text-xs leading-5 text-slate-400">
                {help}
            </span>

            <span className="mt-3 block">
                {children}
            </span>
        </label>
    );
}

function Toggle({
    checked,
    disabled,
    danger = false,
    onChange,
}: {
    checked: boolean;
    disabled?: boolean;
    danger?: boolean;
    onChange: (
        checked: boolean,
    ) => void;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() =>
                onChange(!checked)
            }
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked
                ? danger
                    ? "bg-red-500"
                    : "bg-violet-500"
                : "bg-slate-200"
                } ${disabled
                    ? "cursor-not-allowed opacity-50"
                    : ""
                }`}
        >
            <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${checked
                    ? "left-6"
                    : "left-1"
                    }`}
            />
        </button>
    );
}

function StatusBadge({
    enabled,
}: {
    enabled: boolean;
}) {
    return (
        <span
            className={`rounded-full border px-4 py-2 text-[8px] font-black uppercase tracking-[0.14em] ${enabled
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-slate-50 text-slate-500"
                }`}
        >
            {enabled
                ? "Autonomous"
                : "Manual"}
        </span>
    );
}

function formatDate(
    value: string,
): string {
    const date =
        new Date(value);

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