"use client";

import type { Trade } from "./dashboard.types";

export default function PnlPanel({ trades }: { trades: Trade[] }) {
  const executed = trades.filter((trade) => trade.action !== "PASS");
  const averageEdge =
    executed.length > 0
      ? (executed.reduce((sum, trade) => sum + Math.abs(trade.edge || 0), 0) /
          executed.length) *
        100
      : 0;
  const deployed =
    trades.reduce((sum, trade) => sum + (trade.usdc_amount || 0), 0) / 1e6;

  return (
    <div className="rounded-[26px] border border-black/10 bg-[#fffdf8]/75 p-6 backdrop-blur-md sm:p-8">
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Metric label="Trades executed" value={String(executed.length)} />
        <Metric label="Avg edge" value={`${averageEdge.toFixed(1)}%`} />
        <Metric label="USDC deployed" value={deployed.toFixed(2)} />
      </div>
      <p className="text-center text-sm text-muted">
        Realised P&amp;L tracking requires market resolution.
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-black/10 bg-white/60 p-5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
        {label}
      </p>
      <p className="mt-1 font-mono text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}
