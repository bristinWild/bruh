"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  KeyRound,
  LoaderCircle,
  QrCode,
  Wallet,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { parseUnits } from "viem";
import {
  useAccount,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import {
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_USDC,
  ERC20_TRANSFER_ABI,
} from "./dashboard.constants";
import type { AgentWallet } from "./dashboard.types";

type WalletView = "options" | "connected-wallet" | "qr" | "keys";

interface WalletModalProps {
  open: boolean;
  agent: AgentWallet | null;
  onClose: () => void;
}

export default function WalletModal({
  open,
  agent,
  onClose,
}: WalletModalProps) {
  const [view, setView] = useState<WalletView>("options");
  const [amount, setAmount] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const { address, chainId, isConnected } = useAccount();
  const { switchChainAsync, isPending: switchingNetwork } = useSwitchChain();
  const {
    writeContractAsync,
    data: transactionHash,
    isPending: walletPromptPending,
  } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash: transactionHash,
  });

  useEffect(() => {
    if (!open) {
      setView("options");
      setAmount("");
      setError("");
      setCopied(false);
    }
  }, [open]);

  async function copyAddress() {
    if (!agent?.circle_wallet_address) return;
    await navigator.clipboard.writeText(agent.circle_wallet_address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  async function loadFromConnectedWallet() {
    if (!agent || !isConnected || !amount) return;

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter a valid USDC amount.");
      return;
    }

    setError("");

    try {
      if (chainId !== ARC_TESTNET_CHAIN_ID) {
        await switchChainAsync({ chainId: ARC_TESTNET_CHAIN_ID });
      }

      await writeContractAsync({
        address: ARC_TESTNET_USDC,
        abi: ERC20_TRANSFER_ABI,
        functionName: "transfer",
        args: [
          agent.circle_wallet_address,
          parseUnits(amount, 6),
        ],
      });
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "The transfer could not be submitted.";
      setError(message);
    }
  }

  const busy = walletPromptPending || switchingNetwork || confirming;

  return (
    <AnimatePresence>
      {open && agent && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={onClose}
        >
          <motion.section
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            onMouseDown={(event) => event.stopPropagation()}
            className="w-full max-w-[440px] overflow-hidden rounded-[26px] border border-violet-200/70 bg-[#fffdf8] shadow-[0_35px_100px_-30px_rgba(76,29,149,0.5)]"
          >
            <header className="flex items-center justify-between border-b border-black/10 px-6 py-5">
              <div>
                <p className="text-[8px] font-black uppercase tracking-[0.18em] text-violet-600">
                  Agent wallet
                </p>
                <h2 className="mt-1 text-xl font-black tracking-[-0.03em] text-slate-950">
                  Load {agent.agent_name || "agent"}
                </h2>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close wallet modal"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="p-6">
              {view !== "options" && (
                <button
                  type="button"
                  onClick={() => {
                    setView("options");
                    setError("");
                  }}
                  className="mb-5 flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500 hover:text-violet-600"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </button>
              )}

              {view === "options" && (
                <div className="space-y-3">
                  <WalletOption
                    icon={<Wallet className="h-5 w-5" />}
                    title="Load from user wallet"
                    description="Transfer USDC from the wallet connected to Bruh."
                    onClick={() => setView("connected-wallet")}
                  />

                  <WalletOption
                    icon={<QrCode className="h-5 w-5" />}
                    title="Scan QR"
                    description="Scan the agent wallet address from another wallet."
                    onClick={() => setView("qr")}
                  />

                  <WalletOption
                    icon={<KeyRound className="h-5 w-5" />}
                    title="Export keys"
                    description="Developer-controlled wallet keys are not exportable."
                    onClick={() => setView("keys")}
                  />
                </div>
              )}

              {view === "connected-wallet" && (
                <div>
                  <div className="rounded-[18px] border border-violet-200 bg-violet-50/60 p-4">
                    <p className="text-[8px] font-black uppercase tracking-[0.16em] text-violet-600">
                      Connected wallet
                    </p>
                    <p className="mt-2 truncate font-mono text-[11px] text-slate-700">
                      {address || "No wallet connected"}
                    </p>
                  </div>

                  <label className="mt-5 block text-[8px] font-black uppercase tracking-[0.16em] text-slate-400">
                    Amount
                  </label>

                  <div className="mt-2 flex items-center rounded-[15px] border border-black/10 bg-white px-4">
                    <input
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      inputMode="decimal"
                      placeholder="0.00"
                      className="h-14 min-w-0 flex-1 bg-transparent font-mono text-lg font-bold text-slate-900 outline-none"
                    />
                    <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                      USDC
                    </span>
                  </div>

                  {error && (
                    <p className="mt-3 break-words text-[10px] font-medium leading-relaxed text-red-600">
                      {error}
                    </p>
                  )}

                  {isSuccess && (
                    <div className="mt-3 rounded-[13px] border border-emerald-200 bg-emerald-50 p-3 text-[10px] font-bold text-emerald-700">
                      Transfer confirmed.
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={!isConnected || !amount || busy}
                    onClick={loadFromConnectedWallet}
                    className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-gradient-to-r from-violet-500 to-blue-500 text-[10px] font-black uppercase tracking-[0.13em] text-white shadow-lg shadow-violet-200 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
                    {confirming
                      ? "Confirming transfer"
                      : walletPromptPending
                        ? "Confirm in wallet"
                        : "Load agent wallet"}
                  </button>

                  <p className="mt-3 text-center text-[9px] font-medium leading-relaxed text-slate-400">
                    The connected wallet signs the transfer. Bruh never receives its private key.
                  </p>
                </div>
              )}

              {view === "qr" && (
                <div>
                  <div className="mx-auto w-fit rounded-[22px] border border-violet-100 bg-white p-4 shadow-sm">
                    <QRCodeSVG
                      value={agent.circle_wallet_address}
                      size={190}
                      level="H"
                      includeMargin
                    />
                  </div>

                  <div className="mt-5 rounded-[15px] border border-black/10 bg-slate-50 p-4">
                    <p className="text-[8px] font-black uppercase tracking-[0.15em] text-slate-400">
                      Arc Testnet address
                    </p>
                    <p className="mt-2 break-all font-mono text-[10px] leading-relaxed text-slate-700">
                      {agent.circle_wallet_address}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={copyAddress}
                    className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-[13px] border border-violet-200 bg-violet-50 text-[10px] font-black uppercase tracking-[0.12em] text-violet-700"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copied" : "Copy address"}
                  </button>
                </div>
              )}

              {view === "keys" && (
                <div className="rounded-[20px] border border-amber-200 bg-amber-50/70 p-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-amber-100 text-amber-700">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-[16px] font-black text-slate-900">
                    Keys cannot be exported
                  </h3>
                  <p className="mt-2 text-[11px] font-medium leading-[1.65] text-slate-600">
                    This is a Circle developer-controlled wallet. Signing is handled through
                    Circle’s wallet infrastructure, so Bruh does not expose a raw private key.
                  </p>

                  <button
                    type="button"
                    onClick={copyAddress}
                    className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-[13px] bg-slate-900 text-[10px] font-black uppercase tracking-[0.12em] text-white"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Address copied" : "Copy public address"}
                  </button>
                </div>
              )}
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function WalletOption({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-4 rounded-[17px] border border-black/10 bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-[0_14px_34px_-24px_rgba(124,58,237,0.55)]"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-violet-50 text-violet-600">
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-black text-slate-900">{title}</p>
        <p className="mt-1 text-[10px] font-medium leading-relaxed text-slate-500">
          {description}
        </p>
      </div>

      <ArrowRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-violet-500" />
    </button>
  );
}
