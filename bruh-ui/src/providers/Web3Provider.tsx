"use client";

import { RainbowKitProvider, getDefaultConfig, lightTheme } from "@rainbow-me/rainbowkit";
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
    projectId: "fc4faa437744b2d6061f2f92db239b22",
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

    const customTheme = lightTheme({
        accentColor: "#38BDF8",
        accentColorForeground: "white",
        borderRadius: "large",
        fontStack: "system",
        overlayBlur: "small",
    });

    customTheme.colors.modalBackground = "#ffffff";
    customTheme.colors.modalBorder = "#d7d9dc";
    customTheme.colors.profileForeground = "#f7f8fa";
    customTheme.colors.closeButton = "#6b6e73";
    customTheme.colors.connectButtonBackground = "#38BDF8";
    customTheme.radii.modal = "20px";
    customTheme.radii.menuButton = "16px";
    customTheme.fonts.body = "var(--font-sans)";
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider theme={customTheme}>
                    {children}
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
}