"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AgentAvatar } from "@/app/AgentAvatar";
import AgentProfileCard from "@/components/dashboard/AgentProfileCard";
import CreateAgentPanel from "@/components/dashboard/CreateAgentPanel";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import PnlPanel from "@/components/dashboard/PnlPanel";
import WalletModal from "@/components/dashboard/WalletModal";
import {
  RUNNING_MESSAGES,
  STRATEGIES,
  TABS,
} from "@/components/dashboard/dashboard.constants";
import type {
  AgentAutonomyConfig,
  AgentRun,
  AgentState,
  AgentWallet,
  ConsensusResult,
  DashboardTab,
  Trade,
  UpdateAgentAutonomyConfig,
} from "@/components/dashboard/dashboard.types";
import { getAgentTheme } from "@/src/lib/agentTheme";
import {
  createAgentWallet,
  getAgentAutonomy,
  getAgentRuns,
  getMyWallets,
  runAgent,
  updateAgentAutonomy,
} from "@/src/lib/api";
import ConsensusOverview from "@/components/dashboard/ConsensusOverview";
import ProfileReasoningGrid from "@/components/dashboard/ProfileReasoningGrid";
import ExecutionPlanCard from "@/components/dashboard/ExecutionPlanCard";
import AgentTimeline from "@/components/dashboard/AgentTimeline";
import RunHistoryPanel from "@/components/dashboard/RunHistoryPanel";
import AutonomyPanel from "@/components/dashboard/AutonomyPanel";


const DEFAULT_MARKET_ADDRESS =
  "0xcae8072e80e78ab243d42f74819b037dde623b7b";

export default function Dashboard() {
  const [token, setToken] = useState<string | null>(null);
  const [wallets, setWallets] = useState<AgentWallet[]>([]);
  const [selected, setSelected] = useState<AgentWallet | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const [agentName, setAgentName] = useState("");
  const [agentState, setAgentState] = useState<AgentState>("idle");
  const [activeTab, setActiveTab] = useState<DashboardTab>("agent");
  const [runningMessageIndex, setRunningMessageIndex] = useState(0);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [latestRun, setLatestRun] = useState<AgentRun | null>(null);
  const [
    latestConsensus,
    setLatestConsensus,
  ] =
    useState<ConsensusResult | null>(
      null,
    );
  const [runError, setRunError] =
    useState<string | null>(null);

  const [
    autonomyConfig,
    setAutonomyConfig,
  ] =
    useState<AgentAutonomyConfig | null>(
      null,
    );

  const [
    autonomyLoading,
    setAutonomyLoading,
  ] =
    useState(false);

  const [
    autonomySaving,
    setAutonomySaving,
  ] =
    useState(false);

  const [
    autonomyError,
    setAutonomyError,
  ] =
    useState<string | null>(null);



  useEffect(() => {
    const savedToken =
      localStorage.getItem(
        "bruh_token",
      );

    if (savedToken) {
      setToken(savedToken);
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (agentState !== "running") {
      setRunningMessageIndex(0);
      return;
    }

    const interval = window.setInterval(() => {
      setRunningMessageIndex(
        (current) =>
          (current + 1) %
          RUNNING_MESSAGES.length,
      );
    }, 1800);

    return () =>
      window.clearInterval(interval);
  }, [agentState]);

  useEffect(() => {
    if (!token || !selected) {
      setRuns([]);
      setLatestRun(null);
      return;
    }

    let cancelled = false;

    async function fetchRuns() {
      try {
        const nextRuns =
          await getAgentRuns(
            token,
            selected.id,
            30,
          );

        if (cancelled) {
          return;
        }

        const latestEnsemble =
          nextRuns.find(
            (run) =>
              run.profile_id ===
              "ensemble",
          );

        setLatestRun(
          latestEnsemble ??
          nextRuns[0] ??
          null,
        );

        if (latestEnsemble) {
          const memberRunIds =
            Array.isArray(
              latestEnsemble.metadata
                ?.memberRunIds,
            )
              ? (latestEnsemble.metadata
                ?.memberRunIds as string[])
              : [];

          setRuns(
            memberRunIds.length > 0
              ? nextRuns.filter(
                (run) =>
                  memberRunIds.includes(
                    run.id,
                  ) ||
                  run.id ===
                  latestEnsemble.id,
              )
              : [latestEnsemble],
          );
        } else {
          setRuns(
            nextRuns.slice(0, 1),
          );
        }
      } catch (error) {
        if (!cancelled) {
          console.error(
            "Failed to load runs:",
            error,
          );

          setRuns([]);
          setLatestRun(null);
        }
      }
    }

    void fetchRuns();

    return () => {
      cancelled = true;
    };
  }, [
    token,
    selected?.id,
  ]);

  useEffect(() => {
    if (!token || !selected) {
      setAutonomyConfig(null);
      return;
    }

    let cancelled = false;

    async function loadAutonomy() {
      setAutonomyLoading(true);
      setAutonomyError(null);

      try {
        const config =
          await getAgentAutonomy(
            token!,
            selected!.id,
          );

        if (!cancelled) {
          setAutonomyConfig(
            config,
          );
        }
      } catch (error) {
        if (!cancelled) {
          setAutonomyError(
            error instanceof Error
              ? error.message
              : "Failed to load autonomy settings.",
          );
        }
      } finally {
        if (!cancelled) {
          setAutonomyLoading(
            false,
          );
        }
      }
    }

    void loadAutonomy();

    return () => {
      cancelled = true;
    };
  }, [
    token,
    selected?.id,
  ]);


  const loadRuns = useCallback(
    async (
      jwt: string,
      walletId: string,
    ) => {
      try {
        const nextRuns =
          await getAgentRuns(
            jwt,
            walletId,
            30,
          );

        const latestEnsemble =
          nextRuns.find(
            (run) =>
              run.profile_id ===
              "ensemble",
          );

        setLatestRun(
          latestEnsemble ??
          nextRuns[0] ??
          null,
        );

        if (latestEnsemble) {
          const memberRunIds =
            Array.isArray(
              latestEnsemble.metadata
                ?.memberRunIds,
            )
              ? (
                latestEnsemble.metadata
                  .memberRunIds as string[]
              )
              : [];

          const currentRuns =
            memberRunIds.length > 0
              ? nextRuns.filter(
                (run) =>
                  memberRunIds.includes(
                    run.id,
                  ) ||
                  run.id ===
                  latestEnsemble.id,
              )
              : [latestEnsemble];

          setRuns(currentRuns);
        } else {
          setRuns(
            nextRuns.slice(0, 1),
          );
        }
      } catch (error) {
        console.error(
          "Failed to load runs:",
          error,
        );

        setRuns([]);
        setLatestRun(null);
      }
    },
    [],
  );

  const loadWallets = useCallback(
    async (jwt: string) => {
      try {
        const response =
          await getMyWallets(jwt);

        const nextWallets:
          AgentWallet[] =
          Array.isArray(response)
            ? response
            : [];

        setWallets(nextWallets);

        setSelected((current) => {
          if (
            nextWallets.length === 0
          ) {
            return null;
          }

          const retained = current
            ? nextWallets.find(
              (wallet) =>
                wallet.id ===
                current.id,
            )
            : undefined;

          return (
            retained ??
            nextWallets[0]
          );
        });
      } catch (error) {
        console.error(
          "Failed to load wallets:",
          error,
        );

        setWallets([]);
        setSelected(null);
      } finally {
        setLoading(false);
      }
    },
    [],
  );


  useEffect(() => {
    if (token) {
      void loadWallets(token);
    }
  }, [token, loadWallets]);

  async function handleCreateAgent() {
    if (!token || !selectedStrategy || !agentName.trim()) return;

    setCreating(true);
    try {
      const wallet = (await createAgentWallet(
        token,
        selectedStrategy,
        agentName.trim(),
      )) as AgentWallet;

      await loadWallets(token);
      setSelected(wallet);
      setAgentName("");
      setSelectedStrategy(null);
      setAgentState("idle");
    } finally {
      setCreating(false);
    }
  }


  async function handleAutonomySave(
    patch: UpdateAgentAutonomyConfig,
  ) {
    if (!token || !selected) {
      return;
    }

    setAutonomySaving(true);
    setAutonomyError(null);

    try {
      await updateAgentAutonomy(
        token,
        selected.id,
        patch,
      );

      const refreshed =
        await getAgentAutonomy(
          token,
          selected.id,
        );

      setAutonomyConfig(
        refreshed,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update autonomy settings.";

      setAutonomyError(
        message,
      );

      throw error;
    } finally {
      setAutonomySaving(false);
    }
  }

  async function updateStatus(status: "active" | "paused") {
    if (!token || !selected) return;

    await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/wallets/${selected.id}/status`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      },
    );
  }

  async function handleRun() {
    if (!token || !selected) {
      return;
    }

    setAgentState("running");
    setRunError(null);
    setLatestConsensus(null);

    try {
      await updateStatus(
        "active",
      );

      const response =
        await runAgent(
          token,
          selected.id,
          DEFAULT_MARKET_ADDRESS,
          false,
        );

      setLatestConsensus(
        response.consensus ??
        null,
      );

      await loadRuns(
        token,
        selected.id,
      );

      setAgentState("done");
    } catch (error) {
      console.error(
        "Failed to run agent:",
        error,
      );

      setRunError(
        error instanceof Error
          ? error.message
          : "Agent run failed.",
      );

      setAgentState("idle");
    } finally {
      try {
        await updateStatus(
          "paused",
        );
      } catch (error) {
        console.error(
          "Failed to pause agent:",
          error,
        );
      }
    }
  }

  async function handleStop() {
    await updateStatus("paused");
    setAgentState("idle");
  }
  function selectWallet(
    wallet: AgentWallet,
  ) {
    setSelected(wallet);
    setAgentState("idle");
    setActiveTab("agent");
    setLatestConsensus(null);
    setRunError(null);
    setRuns([]);
    setLatestRun(null);
    setTrades([]);
  }

  if (!loading && !token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f6f2] px-6">
        <div className="w-full max-w-md rounded-[28px] border border-violet-200 bg-[#fffdf8] p-8 text-center">
          <h1 className="text-3xl font-black uppercase text-slate-950">
            Wallet required
          </h1>
          <a
            href="/get-started"
            className="mt-7 inline-flex w-full items-center justify-center rounded-[14px] bg-gradient-to-r from-violet-500 to-blue-500 px-6 py-4 text-[10px] font-black uppercase tracking-[0.14em] text-white"
          >
            Connect wallet →
          </a>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f6f2]">
        Loading dashboard…
      </main>
    );
  }

  const executedTrades = trades.filter((trade) => trade.action !== "PASS");
  const selectedTheme = selected
    ? getAgentTheme(selected.agent_name || selected.id)
    : null;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f7f6f2] px-6 pb-24 pt-12">
      <div className="relative z-10 mx-auto max-w-7xl">
        <DashboardHeader
          agentCount={wallets.length}
          tradeCount={executedTrades.length}
        />

        {wallets.length > 0 && (
          <div className="mb-7 flex flex-wrap items-center gap-2 rounded-[20px] border border-black/10 bg-[#fffdf8]/70 p-3">
            {wallets.map((wallet) => (
              <button
                key={wallet.id}
                type="button"
                onClick={() => void selectWallet(wallet)}
                className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-2 text-[9px] font-black uppercase tracking-[0.12em]"
              >
                <AgentAvatar seed={wallet.agent_name || wallet.id} size={20} />
                {wallet.agent_name || wallet.strategy}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setSelected(null)}
              className="rounded-full border border-dashed border-violet-300 px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.12em] text-violet-600"
            >
              + New agent
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {(!selected || wallets.length === 0) && (
            <CreateAgentPanel
              agentName={agentName}
              selectedStrategy={selectedStrategy}
              creating={creating}
              onNameChange={setAgentName}
              onStrategyChange={setSelectedStrategy}
              onCreate={() => void handleCreateAgent()}
            />
          )}

          {selected && wallets.length > 0 && (
            <motion.div
              key="agent-shell"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="mb-7 flex items-center gap-1 rounded-[16px] border border-black/10 bg-[#fffdf8]/70 p-1.5">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className="rounded-[11px] px-5 py-3 text-[9px] font-black uppercase tracking-[0.14em]"
                    style={{
                      color: activeTab === tab.id ? "#fff" : "#64748B",
                      background:
                        activeTab === tab.id
                          ? "linear-gradient(135deg, #8B5CF6, #3B82F6)"
                          : "transparent",
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === "agent" && (
                <div className="grid items-start gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
                  <div className="flex flex-col gap-4">
                    {agentState === "running" ? (
                      <div className="flex aspect-square flex-col items-center justify-center rounded-2xl bg-slate-950 p-6 text-center text-white">
                        <AgentAvatar
                          seed={selected.agent_name || selected.id}
                          size={68}
                        />
                        <p className="mt-5 text-xs text-cyan-300">
                          {RUNNING_MESSAGES[runningMessageIndex]}
                        </p>
                      </div>
                    ) : (
                      <AgentProfileCard
                        agent={selected}
                        onOpenWallet={() => setWalletModalOpen(true)}
                      />
                    )}

                    <button
                      type="button"
                      onClick={
                        agentState === "running"
                          ? () => void handleStop()
                          : () => void handleRun()
                      }
                      className="w-full rounded-2xl py-4 text-sm font-semibold text-white"
                      style={{
                        background:
                          agentState === "running"
                            ? "linear-gradient(135deg, #EF4444, #DC2626)"
                            : `linear-gradient(135deg, ${selectedTheme?.primary || "#8B5CF6"
                            }, ${selectedTheme?.secondary || "#3B82F6"})`,
                      }}
                    >
                      {agentState === "running"
                        ? "Stop agent"
                        : agentState === "done"
                          ? "Run agent again →"
                          : "Run agent →"}
                    </button>
                  </div>

                  <div className="flex min-w-0 flex-col gap-5">
                    <ConsensusOverview
                      consensus={
                        latestConsensus
                      }
                      latestRun={
                        latestRun
                      }
                      error={
                        runError
                      }
                    />

                    <ProfileReasoningGrid
                      runs={
                        runs
                      }
                      consensus={
                        latestConsensus
                      }
                    />

                    <ExecutionPlanCard
                      plan={
                        latestConsensus
                          ?.executionPlan ??
                        latestRun
                          ?.execution_plan ??
                        null
                      }
                    />

                    <AgentTimeline
                      runs={
                        runs
                      }
                      consensus={
                        latestConsensus
                      }
                      isRunning={
                        agentState ===
                        "running"
                      }
                    />
                    <AutonomyPanel
                      config={
                        autonomyConfig
                      }
                      loading={
                        autonomyLoading
                      }
                      saving={
                        autonomySaving
                      }
                      error={
                        autonomyError
                      }
                      onSave={
                        handleAutonomySave
                      }
                    />

                  </div>
                </div>
              )}

              {activeTab === "pnl" && <PnlPanel trades={trades} />}
              {activeTab ===
                "transactions" && (
                  <RunHistoryPanel
                    runs={runs}
                  />
                )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <WalletModal
        open={walletModalOpen}
        agent={selected}
        onClose={() => setWalletModalOpen(false)}
      />
    </main>
  );
}
