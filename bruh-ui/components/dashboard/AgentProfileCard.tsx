"use client";

import { Wallet } from "lucide-react";
import { AgentAvatar } from "@/app/AgentAvatar";
import { AgentCover } from "@/components/AgentCover";
import { STRATEGIES } from "./dashboard.constants";
import type { AgentWallet } from "./dashboard.types";

export default function AgentProfileCard({
  agent,
  onOpenWallet,
}: {
  agent: AgentWallet;
  onOpenWallet: () => void;
}) {
  return (
    <div
      className="flex aspect-square flex-col overflow-hidden rounded-2xl border bg-surface"
      style={{
        borderColor: "rgba(139,92,246,0.25)",
        boxShadow:
          "0 20px 50px -28px rgba(79,70,229,0.45), 0 0 0 1px rgba(255,255,255,0.7) inset",
      }}
    >
      <div className="h-20 shrink-0 overflow-hidden">
        <AgentCover seed={agent.agent_name || agent.id} />
      </div>

      <div className="relative -mt-6 flex min-h-0 flex-1 flex-col gap-2 px-5 pb-4">
        <div className="flex items-end justify-between gap-3">
          <div className="relative overflow-hidden rounded-xl border-4 border-surface shadow-lg">
            <AgentAvatar seed={agent.agent_name || agent.id} size={42} />
          </div>

          <button
            type="button"
            onClick={onOpenWallet}
            className="mb-1 flex h-9 items-center gap-2 rounded-[11px] border border-violet-200 bg-white/95 px-3 text-[8px] font-black uppercase tracking-[0.11em] text-violet-700 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md"
          >
            <Wallet className="h-3.5 w-3.5" />
            Load wallet
          </button>
        </div>

        <div>
          <p
            className="text-base font-bold text-ink"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {agent.agent_name}
          </p>

          <p className="mt-0.5 flex items-center gap-1.5 text-[10px] capitalize text-muted">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background:
                  STRATEGIES.find((strategy) => strategy.id === agent.strategy)?.accent ||
                  "#8B5CF6",
              }}
            />
            {agent.strategy} · Autonomous Reasoning Agent
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Agent ID", value: agent.agent_id || "—" },
            {
              label: "Edge threshold",
              value: `${((agent.edge_threshold || 0) * 100).toFixed(0)}%`,
            },
            {
              label: "Kelly",
              value: `${((agent.kelly_fraction || 0) * 100).toFixed(0)}%`,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="overflow-hidden rounded-lg px-2 py-1.5"
              style={{
                background:
                  "linear-gradient(135deg, rgba(139,92,246,0.06), rgba(59,130,246,0.03))",
                border: "1px solid rgba(139,92,246,0.18)",
              }}
            >
              <p className="mb-0.5 text-[8px] uppercase tracking-wider text-muted">
                {stat.label}
              </p>
              <p className="truncate font-mono text-[11px] font-bold text-ink">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        <div
          className="rounded-lg px-3 py-2"
          style={{
            background: "var(--color-bg)",
            border: "1px solid var(--color-line)",
          }}
        >
          <div className="mb-1 flex items-center justify-between">
            <p className="text-[8px] uppercase tracking-widest text-muted">
              Circle wallet
            </p>
            <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
          </div>

          <p
            className="truncate font-mono text-[9px] text-ink"
            title={agent.circle_wallet_address}
          >
            {agent.circle_wallet_address}
          </p>

          <a
            href={`https://testnet.arcscan.app/address/${agent.circle_wallet_address}`}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-[9px] font-medium text-violet-600 hover:opacity-70"
          >
            View on ArcScan ↗
          </a>
        </div>
      </div>
    </div>
  );
}
