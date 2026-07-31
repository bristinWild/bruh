"use client";

import type { Trade } from "./dashboard.types";

export default function TransactionsPanel({ trades }: { trades: Trade[] }) {
  const executed = trades.filter((trade) => trade.action !== "PASS");

  return (
    <div className="overflow-x-auto rounded-[24px] border border-black/10 bg-[#fffdf8]/80 backdrop-blur-md">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-black/10 bg-violet-50/40 text-left">
            {["Time", "Action", "Amount", "Edge", "Market"].map((heading) => (
              <th
                key={heading}
                className="p-4 text-[10px] font-semibold uppercase tracking-widest text-muted"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {executed.length === 0 ? (
            <tr>
              <td colSpan={5} className="p-8 text-center text-muted">
                No executed trades yet.
              </td>
            </tr>
          ) : (
            executed.map((trade) => (
              <tr
                key={trade.id}
                className="border-b border-black/5 transition-colors last:border-0 hover:bg-violet-50/35"
              >
                <td className="p-4 font-mono text-xs text-muted">
                  {new Date(trade.timestamp).toLocaleString()}
                </td>
                <td className="p-4">{trade.action}</td>
                <td className="p-4 font-mono text-xs text-ink">
                  {((trade.usdc_amount || 0) / 1e6).toFixed(2)} USDC
                </td>
                <td className="p-4 font-mono text-xs text-muted">
                  {((trade.edge || 0) * 100).toFixed(1)} pts
                </td>
                <td className="p-4 font-mono text-xs text-muted">
                  {trade.market_address
                    ? `${trade.market_address.slice(0, 8)}...`
                    : "—"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
