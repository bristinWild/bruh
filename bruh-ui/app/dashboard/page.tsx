"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AgentAvatar } from "@/app/AgentAvatar";
import ReasoningFeed from "@/components/dashboard/ReasoningFeed";
import AgentProfileCard from "@/components/dashboard/AgentProfileCard";
import CreateAgentPanel from "@/components/dashboard/CreateAgentPanel";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import PnlPanel from "@/components/dashboard/PnlPanel";
import TransactionsPanel from "@/components/dashboard/TransactionsPanel";
import WalletModal from "@/components/dashboard/WalletModal";
import {
  RUNNING_MESSAGES,
  STRATEGIES,
  TABS,
} from "@/components/dashboard/dashboard.constants";
import type {
  AgentState,
  AgentWallet,
  DashboardTab,
  Trade,
} from "@/components/dashboard/dashboard.types";
import {
  createAgentWallet,
  getMyWallets,
  runAgent,
} from "@/src/lib/api";
import { getAgentTheme } from "@/src/lib/agentTheme";

const DEFAULT_MARKET_ADDRESS =
  "0x0797b5f23ded30f1a6d7cd15c54efa7781267aa0";

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

  useEffect(() => {
    const savedToken = localStorage.getItem("bruh_token");
    if (savedToken) setToken(savedToken);
    else setLoading(false);
  }, []);

  useEffect(() => {
    if (agentState !== "running") {
      setRunningMessageIndex(0);
      return;
    }

    const interval = window.setInterval(() => {
      setRunningMessageIndex(
        (current) => (current + 1) % RUNNING_MESSAGES.length,
      );
    }, 1800);

    return () => window.clearInterval(interval);
  }, [agentState]);

  const loadWallets = useCallback(async (jwt: string) => {
    try {
      const response = await getMyWallets(jwt);

      const nextWallets: AgentWallet[] = Array.isArray(response)
        ? response
        : [];

      setWallets(nextWallets);

      if (nextWallets.length > 0) {
        setSelected((current) => {
          const retained = current
            ? nextWallets.find((wallet) => wallet.id === current.id)
            : null;

          return retained || nextWallets[0];
        });
      } else {
        setSelected(null);
      }

      // Temporary until Phase 10 connects agent runs.
      setTrades([]);
    } catch (error) {
      console.error("Failed to load agent wallets:", error);

      setWallets([]);
      setSelected(null);
      setTrades([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) void loadWallets(token);
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
    if (!token || !selected) return;

    setAgentState("running");

    try {
      await updateStatus("active");

      const result = await runAgent(
        token,
        selected.id,
        DEFAULT_MARKET_ADDRESS,
        false,
      );

      console.log("Agent runtime result:", result);

      setAgentState("done");
    } catch (error) {
      console.error("Failed to run agent:", error);

      setAgentState("idle");
    } finally {
      await updateStatus("paused");
    }
  }

  async function handleStop() {
    await updateStatus("paused");
    setAgentState("idle");
  }

  async function selectWallet(wallet: AgentWallet) {
    setSelected(wallet);
    setAgentState("idle");
    setActiveTab("agent");

    // Temporary until runs are integrated in Phase 10.
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

                  <ReasoningFeed
                    trades={trades}
                    agentName={selected.agent_name || "Unnamed agent"}
                    agentSeed={selected.agent_name || selected.id}
                    capability={
                      STRATEGIES.find(
                        (strategy) => strategy.id === selected.strategy,
                      )?.name
                    }
                    capabilityAccent={
                      STRATEGIES.find(
                        (strategy) => strategy.id === selected.strategy,
                      )?.accent
                    }
                    isRunning={agentState === "running"}
                  />
                </div>
              )}

              {activeTab === "pnl" && <PnlPanel trades={trades} />}
              {activeTab === "transactions" && (
                <TransactionsPanel trades={trades} />
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
