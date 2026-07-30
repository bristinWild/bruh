import MarketDetail from "@/components/markets/MarketDetail";

type MarketPageProps = {
    params: Promise<{
        id: string;
    }>;
};

export default async function MarketPage({
    params,
}: MarketPageProps) {
    const { id } = await params;

    return <MarketDetail marketId={id} />;
}