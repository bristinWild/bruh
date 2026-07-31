"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Home } from "lucide-react";

export default function DashboardHeader({
  agentCount,
  tradeCount,
}: {
  agentCount: number;
  tradeCount: number;
}) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"
    >
      <div>
        <div className="flex items-center gap-3">

          <Link
            href="/"
            className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[0.16em] text-slate-400 transition-colors hover:text-violet-600"
          >
            <Home className="h-3 w-3" />
            Home
          </Link>

          <span className="h-3 w-px bg-black/10" />

          <p className="text-[8px] font-black uppercase tracking-[0.2em] text-violet-600">
            Agent control center
          </p>




        </div>
        <h1
          className="mt-5 text-[46px] font-black uppercase leading-[0.92] tracking-[-0.055em] text-slate-950 sm:text-[58px]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Your agent{" "}
          <span className="bg-gradient-to-r from-violet-600 to-blue-500 bg-clip-text text-transparent">
            portfolio.
          </span>
        </h1>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-2 rounded-[20px] border border-black/10 bg-[#fffdf8]/80 p-3">
          <Metric label="Agents" value={String(agentCount)} />
          <Metric label="Trades" value={String(tradeCount)} />
          <Metric label="Network" value="ARC" />
        </div>
      </div>
    </motion.header>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[84px] rounded-[13px] px-3 py-2">
      <p className="text-[7px] font-black uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 font-mono text-[14px] font-black text-slate-900">{value}</p>
    </div>
  );
}
