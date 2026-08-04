"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

const Web3ProviderClient = dynamic(
    () =>
        import(
            "./Web3ProviderClient"
        ).then(
            (module) =>
                module.Web3ProviderClient,
        ),
    {
        ssr: false,
        loading: () => null,
    },
);

export function Web3Provider({
    children,
}: {
    children: ReactNode;
}) {
    return (
        <Web3ProviderClient>
            {children}
        </Web3ProviderClient>
    );
}