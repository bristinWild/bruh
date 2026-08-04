export interface RunnableMarket {
    id: string;
    address: `0x${string}`;
    question: string;
    yesPrice: number;
    noPrice: number;
    open: boolean;
    resolved: boolean;
    network: string;
    category: string;
}

export const RUNNABLE_MARKETS:
    RunnableMarket[] = [
        {
            id:
                "fed-september-2026",

            address:
                "0xcae8072e80e78ab243d42f74819b037dde623b7b",

            question:
                "Will the Fed announce a rate cut in September 2026?",

            yesPrice:
                0.4791735856582144,

            noPrice:
                0.5208264143417856,

            open:
                true,

            resolved:
                false,

            network:
                "eip155:5042002",

            category:
                "Economy",
        },
    ];

export function getOpenRunnableMarkets():
    RunnableMarket[] {
    return RUNNABLE_MARKETS.filter(
        (market) =>
            market.open &&
            !market.resolved,
    );
}