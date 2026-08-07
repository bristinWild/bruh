"use client";

import { WalletCards } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function MarketWalletButtonn({
    usdcBalance,
    usdcBalanceLoading,
}: {
    usdcBalance: number;
    usdcBalanceLoading: boolean;
}) {
    return (
        <ConnectButton.Custom>
            {({
                account,
                chain,
                mounted,
                openAccountModal,
                openChainModal,
                openConnectModal,
            }) => {
                const connected =
                    mounted &&
                    Boolean(account) &&
                    Boolean(chain);

                if (!mounted) {
                    return (
                        <div className="h-11 w-40 animate-pulse rounded-[14px] bg-slate-200" />
                    );
                }

                if (!connected) {
                    return (
                        <button
                            type="button"
                            onClick={openConnectModal}
                            className="flex items-center gap-2 rounded-[14px] bg-slate-950 px-5 py-3 text-[9px] font-black uppercase tracking-[0.12em] text-white shadow-lg shadow-slate-950/10 transition-all hover:-translate-y-0.5 hover:bg-violet-600"
                        >
                            <WalletCards className="h-4 w-4" />
                            Connect Wallet
                        </button>
                    );
                }

                if (chain?.unsupported) {
                    return (
                        <button
                            type="button"
                            onClick={openChainModal}
                            className="flex items-center gap-2 rounded-[14px] bg-amber-500 px-5 py-3 text-[9px] font-black uppercase tracking-[0.12em] text-white"
                        >
                            Switch to Arc Testnet
                        </button>
                    );
                }

                return (
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={openChainModal}
                            className="hidden rounded-[13px] border border-black/10 bg-[#fffdf8] px-4 py-3 text-[9px] font-black text-slate-600 shadow-sm sm:block"
                        >
                            {chain?.name ?? "Unknown Network"}
                        </button>

                        <button
                            type="button"
                            onClick={openAccountModal}
                            className="flex items-center gap-3 rounded-[14px] border border-black/10 bg-[#fffdf8] px-4 py-2.5 shadow-sm transition-all hover:border-violet-300 hover:shadow-md"
                        >
                            <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-500">
                                <WalletCards className="h-4 w-4 text-white" />

                                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                            </span>

                            <span className="text-left">
                                <span className="block font-mono text-[10px] font-black text-slate-800">
                                    {account?.displayName}
                                </span>

                                <span className="mt-0.5 block font-mono text-[8px] font-semibold text-slate-400">
                                    {usdcBalanceLoading
                                        ? "Loading..."
                                        : `${usdcBalance.toFixed(2)} USDC`}
                                </span>
                            </span>
                        </button>
                    </div>
                );
            }}
        </ConnectButton.Custom>
    );
}