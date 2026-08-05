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
  getMyAgentInstallations,
  getMyWallets,
  runAgent,
  runInstalledAgent,
  updateAgentAutonomy,
  type InstalledAgent,
  type InstalledAgentRunResult,
  getInstalledAgentRuns,
  getApiErrorMessage,
} from "@/src/lib/api";
import ConsensusOverview from "@/components/dashboard/ConsensusOverview";
import ProfileReasoningGrid from "@/components/dashboard/ProfileReasoningGrid";
import ExecutionPlanCard from "@/components/dashboard/ExecutionPlanCard";
import AgentTimeline from "@/components/dashboard/AgentTimeline";
import RunHistoryPanel from "@/components/dashboard/RunHistoryPanel";
import AutonomyPanel from "@/components/dashboard/AutonomyPanel";

import {
  getOpenRunnableMarkets,
  type RunnableMarket,
} from "@/src/lib/runnableMarkets";

interface Props {
  state:
  | "idle"
  | "running"
  | "done";
  stage:
  | "idle"
  | "research"
  | "forecast"
  | "execution"
  | "done";
}


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

  const openMarkets =
    getOpenRunnableMarkets();

  const [
    selectedMarket,
    setSelectedMarket,
  ] =
    useState<RunnableMarket | null>(
      openMarkets[0] ?? null,
    );

  const [
    installedAgents,
    setInstalledAgents,
  ] = useState<InstalledAgent[]>([]);

  const [
    selectedInstallation,
    setSelectedInstallation,
  ] = useState<InstalledAgent | null>(null);

  const [
    installedRunResult,
    setInstalledRunResult,
  ] = useState<InstalledAgentRunResult | null>(null);
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

  const [
    runStage,
    setRunStage,
  ] = useState<
    | "idle"
    | "research"
    | "forecast"
    | "execution"
    | "done"
  >("idle");

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

    const currentToken = token;
    const selectedWalletId =
      selected.id;

    let cancelled = false;

    async function fetchRuns() {
      try {
        const nextRuns =
          await getAgentRuns(
            currentToken,
            selectedWalletId,
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

    const currentToken = token;
    const selectedWalletId =
      selected.id;

    let cancelled = false;

    async function loadAutonomy() {
      setAutonomyLoading(true);
      setAutonomyError(null);

      try {
        const config =
          await getAgentAutonomy(
            currentToken,
            selectedWalletId,
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

  useEffect(() => {
    if (
      !token ||
      !selectedInstallation
    ) {
      return;
    }

    const currentToken =
      token;

    const installationId =
      selectedInstallation
        .installation.id;

    let cancelled =
      false;

    async function loadInstalledRuns() {
      try {
        const nextRuns =
          await getInstalledAgentRuns(
            currentToken,
            installationId,
            30,
          );

        if (cancelled) {
          return;
        }

        setRuns(nextRuns);

        setLatestRun(
          nextRuns[0] ??
          null,
        );
      } catch (error) {
        if (!cancelled) {
          console.error(
            "Failed to load installed-agent runs:",
            error,
          );

          setRuns([]);
          setLatestRun(null);
        }
      }
    }

    void loadInstalledRuns();

    return () => {
      cancelled = true;
    };
  }, [
    token,
    selectedInstallation
      ?.installation.id,
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

  const loadAgents = useCallback(
    async (jwt: string) => {
      try {
        const [
          walletResponse,
          installationResponse,
        ] = await Promise.all([
          getMyWallets(jwt),
          getMyAgentInstallations(jwt),
        ]);

        const nextWallets: AgentWallet[] =
          Array.isArray(walletResponse)
            ? walletResponse
            : [];

        const nextInstallations: InstalledAgent[] =
          Array.isArray(installationResponse)
            ? installationResponse
            : [];

        setWallets(nextWallets);
        setInstalledAgents(
          nextInstallations.filter(
            (item) =>
              item.installation.enabled,
          ),
        );

        setSelected((current) => {
          if (current) {
            const retained =
              nextWallets.find(
                (wallet) =>
                  wallet.id === current.id,
              );

            if (retained) {
              return retained;
            }
          }

          return nextWallets[0] ?? null;
        });
      } catch (error) {
        console.error(
          "Failed to load dashboard agents:",
          error,
        );

        setWallets([]);
        setInstalledAgents([]);
        setSelected(null);
        setSelectedInstallation(null);
      } finally {
        setLoading(false);
      }
    },
    [],
  );


  useEffect(() => {
    if (token) {
      void loadAgents(token);
    }
  }, [token, loadAgents]);

  async function handleCreateAgent() {
    if (!token || !selectedStrategy || !agentName.trim()) return;

    setCreating(true);
    try {
      const wallet = (await createAgentWallet(
        token,
        selectedStrategy,
        agentName.trim(),
      )) as AgentWallet;

      await loadAgents(token);
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
    if (
      !token ||
      !selectedMarket ||
      (!selected &&
        !selectedInstallation)
    ) {
      return;
    }
    setRunStage("research");
    setAgentState("running");
    setRunError(null);
    setLatestConsensus(null);
    setInstalledRunResult(null);

    try {
      if (selectedInstallation) {
        const installationId =
          selectedInstallation
            .installation.id;

        const result =
          await runInstalledAgent(
            token,
            installationId,
            {
              market:
                selectedMarket,
            },
          );

        setRunStage("forecast");

        setInstalledRunResult(
          result,
        );

        setRunStage("execution");

        const nextRuns =
          await getInstalledAgentRuns(
            token,
            installationId,
            30,
          );
        setRunStage("done");
        setRuns(nextRuns);

        setLatestRun(
          nextRuns[0] ??
          null,
        );

        setAgentState("done");
        return;
      }

      if (!selected) {
        return;
      }

      await updateStatus(
        "active",
      );

      const response =
        await runAgent(
          token,
          selected.id,
          selectedMarket.address,
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

      setRunError(getApiErrorMessage(error));

      setAgentState("idle");
    } finally {
      if (selected) {
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
  }

  async function handleStop() {
    if (selected) {
      await updateStatus("paused");
    }

    setAgentState("idle");
  }

  function selectWallet(
    wallet: AgentWallet,
  ) {
    setSelected(wallet);
    setSelectedInstallation(null);

    setAgentState("idle");
    setActiveTab("agent");

    setLatestConsensus(null);
    setInstalledRunResult(null);
    setRunError(null);

    setRuns([]);
    setLatestRun(null);
    setTrades([]);
  }

  function selectInstalledAgent(
    item: InstalledAgent,
  ) {
    setSelected(null);
    setSelectedInstallation(item);

    setAgentState("idle");
    setActiveTab("agent");

    setLatestConsensus(null);
    setInstalledRunResult(null);
    setRunError(null);

    setRuns([]);
    setLatestRun(null);
    setTrades([]);
    setAutonomyConfig(null);
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

        {(wallets.length > 0 ||
          installedAgents.length > 0) && (
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

              {installedAgents.length > 0 && (
                <>
                  <span className="mx-2 h-7 w-px bg-black/10" />

                  {installedAgents.map((item) => {
                    const active =
                      selectedInstallation
                        ?.installation.id ===
                      item.installation.id;

                    return (
                      <button
                        key={item.installation.id}
                        type="button"
                        onClick={() =>
                          selectInstalledAgent(item)
                        }
                        className={`flex items-center gap-2 rounded-full border px-3 py-2 text-[9px] font-black uppercase tracking-[0.12em] transition ${active
                          ? "border-violet-500 bg-violet-500 text-white"
                          : "border-violet-200 bg-violet-50 text-violet-700"
                          }`}
                      >
                        <AgentAvatar
                          seed={
                            item.listing.name ||
                            item.installation.id
                          }
                          size={20}
                        />

                        {item.listing.name}

                        <span className="rounded-full bg-black/10 px-2 py-0.5 text-[7px]">
                          Installed
                        </span>
                      </button>
                    );
                  })}
                </>
              )}

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
          {!selected &&
            !selectedInstallation &&
            wallets.length === 0 && (
              <CreateAgentPanel
                agentName={agentName}
                selectedStrategy={selectedStrategy}
                creating={creating}
                onNameChange={setAgentName}
                onStrategyChange={setSelectedStrategy}
                onCreate={() => void handleCreateAgent()}
              />
            )}

          {(selected ||
            selectedInstallation) && (
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
                            seed={
                              selected
                                ? selected.agent_name || selected.id
                                : selectedInstallation?.listing.name ||
                                selectedInstallation?.installation.id ||
                                "installed-agent"
                            }
                            size={68}
                          />

                          <p className="mt-5 text-xs text-cyan-300">
                            {RUNNING_MESSAGES[runningMessageIndex]}
                          </p>
                        </div>
                      ) : selected ? (
                        <AgentProfileCard
                          agent={selected}
                          onOpenWallet={() =>
                            setWalletModalOpen(true)
                          }
                        />
                      ) : selectedInstallation ? (
                        <div className="flex aspect-square flex-col rounded-2xl border border-black/10 bg-[#fffdf8] p-6">
                          <div className="flex items-center gap-4">
                            <AgentAvatar
                              seed={
                                selectedInstallation.listing.name ||
                                selectedInstallation.installation.id
                              }
                              size={56}
                            />

                            <div>
                              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-violet-600">
                                Installed agent
                              </p>

                              <h2 className="mt-1 text-xl font-black text-slate-950">
                                {selectedInstallation.listing.name}
                              </h2>

                              <p className="mt-1 text-xs text-slate-500">
                                v{selectedInstallation.version.version}
                              </p>
                            </div>
                          </div>

                          <p className="mt-6 text-sm leading-6 text-slate-600">
                            {selectedInstallation.listing.short_description}
                          </p>

                          <div className="mt-5 flex flex-wrap gap-2">
                            {selectedInstallation.listing.categories
                              .slice(0, 3)
                              .map((category) => (
                                <span
                                  key={category}
                                  className="rounded-full bg-violet-50 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.1em] text-violet-600"
                                >
                                  {category}
                                </span>
                              ))}
                          </div>

                          <div className="mt-auto flex items-center justify-between border-t border-black/5 pt-5 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                            <span>
                              {selectedInstallation.installation.enabled
                                ? "Enabled"
                                : "Disabled"}
                            </span>

                            <span>
                              {selectedInstallation.installation.pinned_version
                                ? `Pinned ${selectedInstallation.installation.pinned_version}`
                                : "Latest"}
                            </span>
                          </div>
                        </div>
                      ) : null}


                      <div className="rounded-[18px] border border-black/10 bg-[#fffdf8] p-4">
                        <label
                          htmlFor="agent-market"
                          className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-400"
                        >
                          Forecast market
                        </label>

                        {openMarkets.length > 0 ? (
                          <select
                            id="agent-market"
                            value={
                              selectedMarket?.id ?? ""
                            }
                            onChange={(event) => {
                              const nextMarket =
                                openMarkets.find(
                                  (market) =>
                                    market.id ===
                                    event.target.value,
                                ) ?? null;

                              setSelectedMarket(
                                nextMarket,
                              );

                              setLatestConsensus(null);
                              setInstalledRunResult(null);
                              setRunError(null);
                            }}
                            disabled={
                              agentState === "running"
                            }
                            className="mt-3 w-full rounded-[13px] border border-black/10 bg-white px-3 py-3 text-xs font-semibold text-slate-700 outline-none focus:border-violet-400 disabled:opacity-60"
                          >
                            {openMarkets.map(
                              (market) => (
                                <option
                                  key={market.id}
                                  value={market.id}
                                >
                                  {market.question}
                                </option>
                              ),
                            )}
                          </select>
                        ) : (
                          <p className="mt-3 text-xs text-amber-700">
                            No open markets are currently
                            available.
                          </p>
                        )}

                        {selectedMarket && (
                          <div className="mt-3 flex items-center justify-between text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">
                            <span>
                              YES{" "}
                              {(
                                selectedMarket.yesPrice *
                                100
                              ).toFixed(1)}
                              %
                            </span>

                            <span>
                              NO{" "}
                              {(
                                selectedMarket.noPrice *
                                100
                              ).toFixed(1)}
                              %
                            </span>
                          </div>
                        )}
                      </div>


                      <button
                        type="button"
                        onClick={
                          agentState === "running"
                            ? () => void handleStop()
                            : () => void handleRun()
                        }
                        disabled={
                          !selectedMarket
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
                          ? "Running..."
                          : agentState === "done"
                            ? "Run Again →"
                            : "Run agent →"}
                      </button>
                    </div>

                    <div className="flex min-w-0 flex-col gap-5">

                      <ConsensusOverview
                        consensus={
                          selected
                            ? latestConsensus
                            : null
                        }
                        latestRun={
                          latestRun
                        }
                        error={
                          runError
                        }
                      />

                      {selected ? (
                        <ProfileReasoningGrid
                          runs={runs}
                          consensus={
                            latestConsensus
                          }
                        />
                      ) : selectedInstallation &&
                        latestRun ? (
                        <div className="rounded-[22px] border border-black/10 bg-[#fffdf8] p-6">
                          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-violet-600">
                            Research summary
                          </p>

                          <h2 className="mt-2 text-xl font-black text-slate-950">
                            {
                              selectedInstallation
                                .listing.name
                            }
                          </h2>

                          <p className="mt-5 text-sm leading-6 text-slate-600">
                            {latestRun.research
                              ?.summary ??
                              latestRun.decision
                                ?.reasoning ??
                              "No research summary was recorded."}
                          </p>

                          {Array.isArray(
                            latestRun.decision
                              ?.keyFactors,
                          ) &&
                            latestRun.decision
                              .keyFactors.length >
                            0 && (
                              <div className="mt-5 flex flex-wrap gap-2">
                                {latestRun.decision.keyFactors.map(
                                  (factor: string) => (
                                    <span
                                      key={factor}
                                      className="rounded-full bg-violet-50 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.1em] text-violet-600"
                                    >
                                      {factor}
                                    </span>
                                  ),
                                )}
                              </div>
                            )}
                        </div>
                      ) : null}

                      {selected ? (
                        <ExecutionPlanCard
                          plan={
                            latestConsensus?.executionPlan ??
                            latestRun?.execution_plan ??
                            null
                          }
                        />
                      ) : (
                        <ExecutionPlanCard
                          plan={
                            installedRunResult?.executionPlan ??
                            null
                          }
                        />
                      )}
                      <AgentTimeline
                        runs={runs}
                        consensus={latestConsensus}
                        isRunning={agentState === "running"}
                        runStage={runStage}
                      />
                      {selected && (
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
                      )}

                    </div>
                  </div>
                )}

                {activeTab === "pnl" &&
                  selected && (
                    <PnlPanel
                      trades={trades}
                    />
                  )}

                {activeTab === "pnl" &&
                  selectedInstallation && (
                    <div className="rounded-[24px] border border-black/10 bg-[#fffdf8] p-8">
                      <h2 className="text-xl font-black text-slate-950">
                        No executed trades
                      </h2>

                      <p className="mt-3 text-sm leading-6 text-slate-500">
                        This installed agent is currently running in dry-run mode.
                      </p>
                    </div>
                  )}
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

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[16px] border border-black/10 bg-white p-4">
      <p className="text-[8px] font-black uppercase tracking-[0.13em] text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-lg font-black text-slate-950">
        {value}
      </p>
    </div>
  );
}


