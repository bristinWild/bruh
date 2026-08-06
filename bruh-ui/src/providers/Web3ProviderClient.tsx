"use client";

import {
    useMemo,
    useState,
    type ReactNode,
} from "react";

import {
    RainbowKitProvider,
    connectorsForWallets,
    lightTheme,
} from "@rainbow-me/rainbowkit";

import {
    okxWallet,
} from "@rainbow-me/rainbowkit/wallets";

import {
    createConfig,
    http,
    WagmiProvider,
} from "wagmi";

import {
    QueryClient,
    QueryClientProvider,
} from "@tanstack/react-query";

import "@rainbow-me/rainbowkit/styles.css";

const arcTestnet = {
    id: 5042002,
    name: "Arc Testnet",

    nativeCurrency: {
        name: "USDC",
        symbol: "USDC",
        decimals: 6,
    },

    rpcUrls: {
        default: {
            http: [
                "https://rpc.testnet.arc.network",
            ],
        },
    },

    blockExplorers: {
        default: {
            name: "ArcScan",
            url: "https://testnet.arcscan.app",
        },
    },

    testnet: true,
} as const;


const walletConnectProjectId =
    process.env
        .NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
    "fc4faa437744b2d6061f2f92db239b22";

const connectors =
    connectorsForWallets(
        [
            {
                groupName:
                    "Recommended",

                wallets: [
                    okxWallet,
                ],
            },
        ],
        {
            appName:
                "Bruh",

            projectId:
                walletConnectProjectId,
        },
    );

const config =
    createConfig({
        chains: [
            arcTestnet,
        ],

        connectors,

        transports: {
            [arcTestnet.id]:
                http(
                    "https://rpc.testnet.arc.network",
                ),
        },

        ssr:
            false,

        multiInjectedProviderDiscovery:
            false,
    });


export function Web3ProviderClient({
    children,
}: {
    children: ReactNode;
}) {
    const [queryClient] =
        useState(
            () =>
                new QueryClient(),
        );

    const customTheme =
        useMemo(() => {
            const theme =
                lightTheme({
                    accentColor:
                        "#38BDF8",

                    accentColorForeground:
                        "white",

                    borderRadius:
                        "large",

                    fontStack:
                        "system",

                    overlayBlur:
                        "small",
                });

            theme.colors.modalBackground =
                "#ffffff";

            theme.colors.modalBorder =
                "#d7d9dc";

            theme.colors.profileForeground =
                "#f7f8fa";

            theme.colors.closeButton =
                "#6b6e73";

            theme.colors.connectButtonBackground =
                "#38BDF8";

            theme.radii.modal =
                "20px";

            theme.radii.menuButton =
                "16px";

            theme.fonts.body =
                "var(--font-sans)";

            return theme;
        }, []);

    return (
        <WagmiProvider
            config={config}
        >
            <QueryClientProvider
                client={queryClient}
            >
                <RainbowKitProvider
                    theme={
                        customTheme
                    }
                >
                    {children}
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
}