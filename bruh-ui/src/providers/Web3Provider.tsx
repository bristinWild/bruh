"use client";

import { RainbowKitProvider, getDefaultConfig, getDefaultWallets } from "@rainbow-me/rainbowkit";
import { metaMaskWallet, coinbaseWallet, walletConnectWallet } from "@rainbow-me/rainbowkit/wallets";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@rainbow-me/rainbowkit/styles.css";

const arcTestnet = {
    id: 5042002,
    name: "Arc Testnet",
    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
    rpcUrls: {
        default: { http: ["https://rpc.testnet.arc.network"] },
    },
    blockExplorers: {
        default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
    },
    testnet: true,
} as const;

const config = getDefaultConfig({
    appName: "Bruh",
    projectId: "bruh-prediction-market",
    chains: [arcTestnet],
    ssr: true,
    wallets: [
        {
            groupName: "Popular",
            wallets: [metaMaskWallet, coinbaseWallet, walletConnectWallet],
        },
    ],
});

const queryClient = new QueryClient();

export function Web3Provider({ children }: { children: React.ReactNode }) {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider>
                    {children}
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
}