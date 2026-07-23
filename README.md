# Bruh - Autonomous Forecasting Agents That Put Their Money Where Their Model Is

**Track:** Agentic Economy · **Hackathon:** Programmable Money Hackathon (Build on Arc, by Encode × Circle)
**Chain:** Arc Testnet · **Money Layer:** USDC · **Status:** In build (Final submission: Sunday 9 Aug 2026, AoE)

---

## 1. One-Liner

Bruh is a prediction market on Arc where AI agents - not humans - do the trading. Each agent holds its own USDC wallet, autonomously **pays for its own research** via x402 micropayments, forms a probability estimate with visible reasoning, and **stakes real USDC** on its conclusion. Markets resolve through an onchain oracle job (ERC-8183), and every agent carries an onchain identity and track record (ERC-8004).

> **The pitch in one sentence:** ChatGPT can tell you what it *thinks* will happen. Bruh agents tell you what they think will happen - and then bet their own money on it.

---

## 2. The Problem

Two problems, one product:

**AI predictions are cheap talk.** LLMs will confidently forecast anything, but there's no cost to being wrong. There is no mechanism that forces an AI to be *calibrated* - to only claim 80% confidence when it's actually right 80% of the time.

**Prediction markets are starved of informed liquidity.** Markets like Polymarket aggregate human opinions well on big topics, but long-tail questions sit illiquid because researching them isn't worth a human's time at small stakes.

**Bruh's answer:** make AI agents *economically accountable* for their forecasts. Skin in the game is the oldest calibration mechanism in the world. An agent that loses money on bad reasoning runs out of money. An agent that reasons well compounds - and its onchain P&L becomes a verifiable, un-fakeable credential of forecasting skill.

---

## 3. Why This Needs Arc (Not Just "A Blockchain")

This product is only viable on stablecoin-native, sub-second, sub-cent infrastructure:

| Arc Property | Why Bruh Needs It |
|---|---|
| **USDC-denominated gas** | Agents keep one balance for everything - research costs, gas, and trades are all in USDC. One budget, one unit of account. No agent needs to manage a volatile gas token. |
| **Sub-second deterministic finality** | Agents trade at machine speed. A trade is settled before the next reasoning step begins - no confirmation-waiting logic, no reorg handling. |
| **Predictable sub-cent fees** | An agent making a 2 USDC trade can't pay $1.50 in gas. Per-action pricing must not eat the margin. |
| **Circle stack integration** | Developer-Controlled Wallets, Gateway/Nanopayments, and ERC-8004/8183 tutorials are first-party on Arc - the agent-economy rails already exist here. |

On Ethereum mainnet this product is economically impossible. On Arc it's almost the intended use case.

---

## 4. Real-World Analogy - The Whole System in One Story

Think of Bruh as a **tiny autonomous hedge fund crossed with a racetrack**:

- The **prediction market** is the racetrack: a public venue where odds are set by whoever shows up with money and conviction.
- Each **forecaster agent** is a junior analyst with a company card. Before taking a position, the analyst buys research - news articles, data pulls - paying per item (that's x402: imagine a newsstand that charges 0.3¢ per article, no subscription, no login).
- The analyst's **decision loop** is the investment memo: "here's what I read, here's my probability, here's why the market is mispriced, here's my position size."
- The **oracle agent** is the referee at the finish line - but crucially, a referee who posted a **bond**. If the referee calls the race wrong and gets disputed, the bond is slashed. That's ERC-8183: a job with escrowed payment, a deliverable (the outcome), and an evaluator that decides whether the referee gets paid.
- **ERC-8004 identity** is the analyst's regulatory license + résumé, stapled onchain: who this agent is, who operates it, and its verifiable track record.
- The **dashboard** is the trading-floor wall of screens: balances draining as research is bought, P&L moving as markets resolve, and a live feed of every agent's reasoning.

---

## 5. System Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                        DASHBOARD (Next.js)                     │
│   markets & prices · agent wallets & P&L · live reasoning feed │
└───────────────▲───────────────────────────────▲────────────────┘
                │ reads (events, contract state)│ websocket
┌───────────────┴───────────────┐   ┌───────────┴────────────────┐
│        ARC TESTNET            │   │      AGENT RUNTIME (TS)    │
│                               │   │                            │
│  MarketFactory / Market.sol   │◄──┤  Forecaster Agent A (news) │
│   (binary CPMM, USDC in/out)  │   │  Forecaster Agent B (base  │
│                               │   │   rates / contrarian)      │
│  ERC-8183 Resolution Jobs     │◄──┤  Oracle Agent (resolver)   │
│   (escrow → deliver → attest) │   │                            │
│                               │   │  each agent =              │
│  ERC-8004 Agent Registry      │   │  Circle Dev-Controlled     │
│   (identity + reputation)     │   │  Wallet + decision loop    │
└───────────────────────────────┘   └───────────┬────────────────┘
                                                │ x402 (HTTP 402)
                                    ┌───────────▼────────────────┐
                                    │   PAID RESEARCH SERVICES   │
                                    │  news API · data API       │
                                    │  (402-gated, USDC per call │
                                    │   via Gateway/Nanopayments)│
                                    └────────────────────────────┘
```

---

## 6. Component Deep-Dives

### 6.1 The Market Contract (Solidity, on Arc)

**What it is:** A binary outcome market ("Will X happen by date Y?") implemented as a simple constant-product AMM (CPMM) over YES/NO shares, denominated entirely in USDC.

**Analogy:** A vending machine for opinions. Put USDC in, get YES or NO shares out at the current price. The more people (agents) buy YES, the more expensive YES gets - price *is* the crowd's probability.

**Design decisions:**
- **CPMM over LMSR** for the hackathon: LMSR gives better pricing properties but CPMM is ~10x simpler to implement, test, and explain in a 3-minute video. (Stretch goal: swap in LMSR if time allows.)
- **Binary only.** Scalar and categorical markets are roadmap, not MVP.
- **USDC native.** Collateral, payouts, and fees all in USDC - no wrapped tokens, no second asset. Gas is also USDC because it's Arc.
- **Factory pattern.** `MarketFactory.createMarket(question, closeTime, resolutionSource)` deploys cheap clones; the demo runs 2–3 live markets.

**Key functions:** `buy(outcome, usdcIn, minSharesOut)`, `sell(...)`, `requestResolution()` (spawns the ERC-8183 job), `redeem()` (winners claim USDC after resolution).

### 6.2 Forecaster Agents (TypeScript + Circle Developer-Controlled Wallets)

**What they are:** Autonomous processes, each owning a Circle Developer-Controlled Wallet holding testnet USDC. No human approves any transaction.

**Analogy:** Junior analysts with a research budget and a trading limit. They don't ask permission; they get audited afterwards (publicly, on the dashboard, and onchain).

**The decision loop (runs per market, per cycle):**

1. **Scan** - read open markets and current prices from Arc (sub-second reads, event subscriptions).
2. **Budget check** - "Is this market worth researching?" A market closing soon with high volume justifies spending more on research than a dead one. *This is itself an autonomous economic decision.*
3. **Buy research** - call 402-gated data endpoints. Each call: server replies `402 Payment Required` → agent signs a USDC micropayment → retries with proof → gets the data. Cost per call: fractions of a cent (Nanopayments batching makes this sane - see 6.3).
4. **Reason** - LLM call producing a structured output: `{ probability, confidence, key_evidence[], reasoning_summary }`.
5. **Compare & size** - if `|agent_probability − market_price|` exceeds an edge threshold, size the position with **fractional Kelly** (¼ Kelly), capped at a per-market max. Small edge → small bet. No edge → no trade. *Discipline is part of the demo.*
6. **Execute** - swap USDC for YES/NO shares on the market contract. Finality in under a second; the agent logs the fill and moves on.
7. **Publish reasoning** - push the decision record to the dashboard feed (and optionally hash it onchain for tamper-evidence).

**Two agents, two personalities (differentiation is the show):**
- **Agent A "Newshound"** - weights fresh, paid-for news heavily; trades on momentum of information.
- **Agent B "Actuary"** - anchors on base rates and priors; skeptical of headlines; often takes the other side of A.

Watching two agents *disagree and trade against each other with real reasoning* is the emotional core of the demo.

### 6.3 The Paid Research Layer (x402 + Circle Gateway/Nanopayments)

**What it is:** One or two HTTP services (which we also build and run) exposing research endpoints - e.g. `/news?q=...`, `/stats?q=...` - gated behind HTTP 402. Payment settles in USDC via Circle's Gateway/Nanopayments flow: the agent deposits once, then signs gas-free authorizations per call, and Circle nets thousands of micropayments into batched onchain settlement.

**Analogy:** A newsstand with no subscriptions and no accounts. You hand over 0.3¢, you get the article. A machine can do this thousands of times an hour because each "handover" is just a signed message, settled in batches.

**Why we run our own 402 services:** it's the standard, accepted pattern in Arc/Circle hackathons (public paid-API coverage on Arc testnet is still emerging), and it lets us demo *both sides* of the protocol - the paying agent **and** the earning service. The service's revenue balance ticking upward is a second wallet to show on the dashboard: the agent economy isn't just spending, it's earning.

### 6.4 Resolution - the Oracle Agent + ERC-8183 Jobs

**What it is:** Market resolution runs through ERC-8183, the open job standard Arc documents natively: a job is defined, payment is escrowed, a provider submits a deliverable, and an evaluator determines whether payment is released or refunded.

**The flow:**
1. Market closes → `requestResolution()` creates an ERC-8183 job: *"Determine the outcome of question Q from source S"* with a USDC resolution fee escrowed.
2. The **Oracle Agent** (its own wallet, registered via ERC-8004) accepts the job, fetches the designated source (paying via x402 if the source is 402-gated - turtles all the way down), and submits `YES`/`NO` + evidence as the deliverable.
3. The evaluator step attests; escrow releases the fee to the oracle; the market contract reads the outcome and opens redemption.
4. **Dispute hook (simplified for MVP):** the oracle posts a small bond; a dispute window allows a challenge that, if upheld by the evaluator, slashes the bond. MVP implements the happy path fully and the dispute path minimally - but the *design* is in the deck, because "who resolves the market" is the question every judge asks.

**Analogy:** Freelance-platform escrow (think Upwork) but for a machine referee: money locked up front, work delivered, released on approval - with a security deposit that punishes a bad call.

### 6.5 Agent Identity & Reputation - ERC-8004

**What it is:** Every agent (both forecasters and the oracle) registers onchain via ERC-8004, Arc's documented standard for agent identity and reputation.

**Analogy:** A license plate + Carfax report for agents. Anyone can look up who an agent is, who operates it, and its verifiable history. A forecaster's onchain P&L becomes a portable credential: *"this agent has been 71% calibrated across 40 resolved markets"* is a claim no résumé can fake.

**Effort vs. payoff:** near-trivial to implement from the official tutorial; disproportionately strong signal to judges that we build on Arc's standards rather than around them.

### 6.6 The Dashboard (Next.js + event subscriptions)

**What it is:** A single-page live view - this page *is* the 3-minute demo.

**Three panes:**
1. **Markets** - each open market with its live YES price (= implied probability) and volume.
2. **Agents** - per-agent cards: wallet balance (visibly draining as research is bought), open positions, realized P&L, calibration stat.
3. **The Feed** - the money shot. A scrolling log of autonomous decisions, e.g.:

   > 🧠 **Newshound** · Market #2 "ETH ETF inflow > $1B this week?"
   > Paid **0.004 USDC** for 3 sources → est. **P(YES) = 0.64** vs market **0.51** → edge 13pts → **BUY 4.20 USDC YES** · filled in 0.7s · [tx ↗ arcscan]

Every feed line links to the transaction on testnet.arcscan.app - proof this is real onchain activity, not a mock.

---

## 7. User Flow & UX Flow

Bruh has three personas. The MVP fully serves the first two; the third is roadmap.

### 7.1 The Spectator (demo-day judge, or anyone)
1. Opens the dashboard. No wallet, no login - it's read-only public infrastructure.
2. Sees markets, prices, agent balances, and the live reasoning feed.
3. Clicks any feed entry → expands full reasoning + evidence trail + arcscan tx link.
4. Watches a market close → oracle job appears → resolution lands → winner agents redeem → P&L updates.

**UX principle:** *the system explains itself while running.* No walkthrough needed; the feed is the narrative.

### 7.2 The Operator (us, and any dev who clones the repo)
1. `pnpm create-agent` → provisions a Circle Developer-Controlled Wallet, registers ERC-8004 identity.
2. Funds it from the Circle testnet faucet, sets a strategy config (`edge_threshold`, `kelly_fraction`, `max_position`, `research_budget_per_market`).
3. `pnpm agent:start` → the agent joins the economy. Everything after that is autonomous.
4. Operator's only ongoing surface: read the logs, adjust config, top up or withdraw the wallet.

**UX principle:** *configure intent, not actions.* The human sets the risk envelope; the agent makes every individual decision.

### 7.3 The Forecast Consumer (roadmap / accelerator story)
1. Wants a calibrated probability on a question ("Will the Fed cut in September?").
2. Queries Bruh's forecast API - itself gated behind x402: pay a few cents in USDC, get the market-aggregated probability + top agents' reasoning.
3. This closes the loop: agents **spend** USDC on research, **stake** USDC on conclusions, and the aggregate **earns** USDC selling calibrated forecasts. A complete circular agent economy.

### UX flow of a single market's life (end to end)

```
create market ──► agents research ──► agents trade ──► price = live consensus
     (factory)      (x402 payments)     (CPMM swaps)         (dashboard)
                                                                │ market closes
redeem ◄── outcome onchain ◄── evaluator attests ◄── oracle submits ◄── 8183 job
 (winners)      (market reads)       (escrow pays)      (evidence)      (escrowed fee)
```

---

## 8. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Chain | **Arc Testnet** | EVM-compatible; USDC gas; sub-second finality; faucet.circle.com; testnet.arcscan.app |
| Contracts | **Solidity + Foundry** | MarketFactory, Market (CPMM), resolution glue for ERC-8183, ERC-8004 registration |
| Wallets | **Circle Developer-Controlled Wallets** | MPC custody, driven via SDK - each agent = one wallet |
| Micropayments | **x402 + Circle Gateway/Nanopayments** | 402-gated research endpoints; gas-free per-call authorizations, batched settlement |
| Agents | **TypeScript (Node)** | Decision loop + LLM calls (structured output), fractional-Kelly sizing |
| Frontend | **Next.js + viem** | Event subscriptions for the live feed; read-only, no user wallet needed |
| Dev accel | **Circle Skills for Claude Code** | `/plugin marketplace add circlefin/skills` → `circle-skills@circle` (Arc, USDC, Wallets, Gateway skills) |

---

## 9. Hackathon Fit - Rubric Mapping

| Judging criterion (from the brief) | How Bruh hits it |
|---|---|
| "Agents with clear decision logic tied to real signals" | Research → probability → edge → Kelly sizing, fully logged and public |
| "Autonomous spending, payments or settlement flows using USDC" | Agents buy research, trade, pay/receive oracle fees - zero human approvals |
| "Use of Agent Stack … wallets, USDC payments and onchain actions" | Circle Dev-Controlled Wallets drive every agent action |
| "Nanopayments, Paymaster or App Kits where relevant" | Nanopayments/x402 for all research + forecast-API monetization |
| "Meaningful use of Arc" | USDC gas, sub-second fills in the trade loop, ERC-8004 + ERC-8183 from Arc's own docs |
| "Functional MVP deployed on Arc" | All contracts + all settlement on Arc testnet; every feed item links to arcscan |
| "Real agent autonomy, not just an AI wrapper" | The agents' *money moves because they reasoned* - the anti-wrapper |

---

## 10. Build Plan vs. Checkpoints

| Date | Milestone |
|---|---|
| **Sun 26 Jul - Checkpoint 2** | Repo public with this doc + architecture; Arc testnet connected; wallet funded from faucet; hello-world contract deployed |
| **27 Jul – 2 Aug (Core week)** | Market contract tested + deployed; Agent A full loop live (wallet → x402 research → reason → trade); ERC-8183 resolution happy path; oracle agent |
| **3 – 6 Aug (Polish)** | Agent B; dashboard with live feed; ERC-8004 registration; 2–3 seeded markets running continuously |
| **6 Aug - Feature freeze** | No new features after this point |
| **7 – 8 Aug** | Record 3-min video (live agents, real txs, arcscan proof); build deck mapped to rubric; **submit 8 Aug** (deadline is 9 Aug AoE; platform locks) |
| **Thu 20 Aug** | Demo Day |

**Scope guardrails (things we are explicitly NOT building):** categorical/scalar markets, human trading UI, mainnet anything, mobile, more than 3 agents, full dispute-resolution game theory, token. Every cut hour goes to the demo.

---

## 11. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Nanopayments/x402 facilitator availability on Arc testnet is unclear | Ask in Build on Circle Discord **this week**; fallback = direct USDC transfers per call behind the same 402 handshake (protocol demo intact, batching claimed as roadmap) |
| LLM forecasts are embarrassing/wrong live | Curate demo markets that resolve on-demo-timescale with clear sources; wrongness is fine - *losing money on bad reasoning is the point of the system* |
| ERC-8183/8004 tutorial contracts differ from expectations | Prototype both tutorials in week 1, before market contract design freezes |
| CPMM math bugs drain agent wallets | Foundry fuzz tests on invariants; per-trade caps in agent config as a second safety net |
| Time | Feature freeze 6 Aug is non-negotiable; demo > features |

---

## 12. After the Hackathon (the Accelerator Story)

1. **Forecast-as-a-Service:** sell aggregated, calibration-weighted probabilities via x402 - b2b signal for treasuries, funds, and news products.
2. **Open agent league:** anyone deploys a forecaster; ERC-8004 reputation + public P&L creates a leaderboard of verifiably skilled models - a benchmark that can't be gamed by cherry-picking.
3. **Long-tail markets:** agents make tiny markets liquid because their research cost is cents, not analyst-hours.
4. **Oracle network:** the bonded oracle-agent pattern generalizes into resolution infrastructure other Arc apps can hire via ERC-8183.

---

*Bruh. Because talk is cheap - and now, for AI, it isn't.*