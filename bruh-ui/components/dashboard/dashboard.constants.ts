export const STRATEGIES = [
  {
    id: "newshound",
    name: "Newshound",
    tag: "News momentum",
    accent: "#8B5CF6",
    secondary: "#6366F1",
    initial: "N",
    description:
      "Aggressive. Weights recent news heavily and trades quickly on clear signals.",
  },
  {
    id: "actuary",
    name: "Actuary",
    tag: "Base rates",
    accent: "#3B82F6",
    secondary: "#06B6D4",
    initial: "A",
    description:
      "Conservative. Anchors on historical priors and waits for meaningful mispricing.",
  },
  {
    id: "both",
    name: "Both capabilities",
    tag: "Ensemble",
    accent: "#7C3AED",
    secondary: "#2563EB",
    initial: "B",
    description:
      "Runs both reasoning styles. Disagreement is signal; agreement is conviction.",
  },
] as const;

export const RUNNING_MESSAGES = [
  "Reading market news…",
  "Comparing historical outcomes…",
  "Estimating probability…",
  "Calculating edge…",
  "Preparing trade decision…",
];

export const TABS = [
  { id: "agent", label: "Agent" },
  { id: "pnl", label: "PnL" },
  { id: "transactions", label: "History" },
] as const;

export const ARC_TESTNET_CHAIN_ID = 5_042_002;
export const ARC_TESTNET_USDC = "0x3600000000000000000000000000000000000000" as const;

export const ERC20_TRANSFER_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;
