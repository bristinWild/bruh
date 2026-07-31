"use client";

import { motion } from "framer-motion";
import { AgentAvatar } from "@/app/AgentAvatar";
import { STRATEGIES } from "./dashboard.constants";

interface CreateAgentPanelProps {
  agentName: string;
  selectedStrategy: string | null;
  creating: boolean;
  onNameChange: (name: string) => void;
  onStrategyChange: (strategy: string) => void;
  onCreate: () => void;
}

export default function CreateAgentPanel({
  agentName,
  selectedStrategy,
  creating,
  onNameChange,
  onStrategyChange,
  onCreate,
}: CreateAgentPanelProps) {
  return (
    <motion.section
      key="create-agent"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="relative overflow-hidden rounded-[30px] border border-violet-200/70 bg-[#fffdf8]/90 p-5 shadow-[0_35px_90px_-60px_rgba(79,70,229,0.55)] backdrop-blur-xl sm:p-7"
    >
      <div className="mb-7 border-b border-black/10 pb-6">
        <p className="text-[8px] font-black uppercase tracking-[0.18em] text-violet-600">
          New agent
        </p>
        <h2
          className="mt-4 text-[34px] font-black uppercase tracking-[-0.045em] text-slate-950"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Build your{" "}
          <span className="bg-gradient-to-r from-violet-600 to-blue-500 bg-clip-text text-transparent">
            agent.
          </span>
        </h2>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
        <section className="rounded-[24px] border border-black/10 bg-white/55 p-5">
          <div className="flex items-start gap-4">
            <div className="overflow-hidden rounded-[18px] border-4 border-white shadow-lg">
              <AgentAvatar seed={agentName || "preview"} size={64} />
            </div>
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.18em] text-slate-400">
                Agent identity
              </p>
              <h3 className="mt-2 text-[18px] font-black text-slate-900">
                {agentName.trim() || "Unnamed agent"}
              </h3>
            </div>
          </div>

          <label className="mb-2 mt-6 block text-[8px] font-black uppercase tracking-[0.17em] text-slate-400">
            Agent name
          </label>
          <input
            value={agentName}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Scout, Oracle, Ledger..."
            maxLength={24}
            className="h-14 w-full rounded-[15px] border border-black/10 bg-white/80 px-4 text-[13px] font-bold text-slate-900 outline-none focus:border-violet-300"
          />
        </section>

        <section className="rounded-[24px] border border-black/10 bg-white/55 p-5">
          <p className="text-[8px] font-black uppercase tracking-[0.18em] text-slate-400">
            Reasoning capability
          </p>
          <div className="mt-5 grid gap-3">
            {STRATEGIES.map((strategy) => {
              const active = selectedStrategy === strategy.id;
              return (
                <button
                  key={strategy.id}
                  type="button"
                  onClick={() => onStrategyChange(strategy.id)}
                  className="rounded-[18px] border p-4 text-left transition hover:-translate-y-0.5"
                  style={{
                    borderColor: active
                      ? `${strategy.accent}65`
                      : "rgba(15,23,42,0.1)",
                    background: active
                      ? `linear-gradient(135deg, ${strategy.accent}12, ${strategy.secondary}07)`
                      : "rgba(255,255,255,0.65)",
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] font-mono text-[12px] font-black"
                      style={{
                        color: strategy.accent,
                        background: `${strategy.accent}12`,
                      }}
                    >
                      {strategy.initial}
                    </div>
                    <div>
                      <p className="text-[13px] font-black text-slate-900">
                        {strategy.name}
                      </p>
                      <p className="mt-2 text-[10px] font-medium leading-[1.55] text-slate-500">
                        {strategy.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={onCreate}
          disabled={!selectedStrategy || !agentName.trim() || creating}
          className="min-w-[210px] rounded-[14px] bg-gradient-to-r from-violet-500 to-blue-500 px-6 py-4 text-[10px] font-black uppercase tracking-[0.14em] text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          {creating ? "Creating agent..." : "Create agent →"}
        </button>
      </div>
    </motion.section>
  );
}
