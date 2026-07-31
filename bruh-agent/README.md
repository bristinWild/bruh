# BRUH Agent Runtime

The **Bruh Agent Runtime** is the execution engine behind every autonomous agent running on Bruh.

It provides a standardized lifecycle for prediction market agents while abstracting away infrastructure such as wallets, research payments, execution, and reputation.

Rather than implementing blockchain logic, wallet management, or payment flows, developers only define **how an agent thinks**.

---

# Philosophy

Bruh separates **infrastructure** from **intelligence**.

Circle Agent Stack provides the financial primitives.

Bruh provides the prediction market runtime.

Developers provide the agent's reasoning.

```
                 Circle Agent Stack

         Wallets
             │
     Programmable Money
             │
       Agent Marketplace
             │
          x402 Payments
             │
─────────────┼────────────────────────

             ▼

      BRUH Agent Runtime

      Research
      Reasoning
      Risk
      Position Sizing
      Trading
      Reputation

─────────────┼────────────────────────

             ▼

         Custom Agent
```

The result is a platform where developers focus only on intelligence while Bruh manages execution.

---

# Runtime Lifecycle

Every agent follows the exact same lifecycle.

```
Initialize

↓

Receive Context

↓

Research

↓

Reason

↓

Risk Evaluation

↓

Position Sizing

↓

Trade Decision

↓

Execution

↓

Performance Tracking

↓

Reputation Update
```

Every built-in profile and every custom SDK agent uses this pipeline.

---

# Project Structure

```
src/

├── core/
│
│   runtime.ts
│       Main runtime orchestrator.
│       Executes the complete lifecycle of an agent.
│
│   decision.ts
│       Converts research into a prediction.
│
│   risk.ts
│       Risk limits, confidence thresholds,
│       exposure rules and execution validation.
│
│   sizing.ts
│       Determines position size based on
│       probability, confidence and bankroll.
│
│   types.ts
│       Shared runtime interfaces.
│
│
├── profiles/
│
│   newshound.ts
│       News-driven prediction profile.
│
│   actuary.ts
│       Historical probability profile.
│
│   whale-hunter.ts
│       Smart-money / onchain intelligence profile.
│
│   registry.ts
│       Registers every available built-in profile.
│
│
├── providers/
│
│   research-provider.ts
│       Shared provider interface.
│
│   news-provider.ts
│       News and RSS research.
│
│   historical-provider.ts
│       Historical statistics and datasets.
│
│   onchain-provider.ts
│       Wallet activity and blockchain analytics.
│
│   llm-provider.ts
│       LLM abstraction.
│
│
├── sdk/
│
│   define-agent.ts
│       Entry point for custom agents.
│
│   manifest.ts
│       Agent metadata schema.
│
│   index.ts
│       SDK exports.
│
└── index.ts
```

---

# Built-in Profiles

Bruh includes production-ready profiles for non-technical users.

## 📰 Newshound

Specialization

Breaking news intelligence.

Research

- News APIs
- RSS
- Press releases
- Twitter/X

Decision Style

- Fast
- Aggressive
- Momentum driven

Recommended For

- Crypto
- AI
- Technology
- Politics

---

## 📊 Actuary

Specialization

Historical probability estimation.

Research

- Historical data
- Previous outcomes
- Statistics

Decision Style

- Conservative
- Evidence-first

Recommended For

- Elections
- Macro
- Weather
- Finance

---

## 🐋 Whale Hunter

Specialization

Onchain capital flow analysis.

Research

- Smart money wallets
- Exchange inflows
- Exchange outflows
- Bridge activity
- Staking

Decision Style

- Capital flow
- Trend confirmation
- Smart-money tracking

Recommended For

- Crypto
- Layer 1
- DeFi
- ETFs

---

# Profile Registry

All built-in profiles are registered inside

```
profiles/registry.ts
```

The runtime loads profiles through the registry rather than importing them directly.

```
Runtime

↓

Registry

↓

Profile

↓

Execution
```

Adding a new built-in profile requires only two steps.

1.

Create

```
profiles/my-profile.ts
```

2.

Register it inside

```
profiles/registry.ts
```

No other runtime changes are required.

---

# Providers

Providers are responsible for gathering external intelligence.

Profiles never communicate directly with APIs.

Instead they request information through providers.

Example

```
News API

↓

News Provider

↓

Runtime

↓

Agent
```

This allows providers to be swapped without modifying agent logic.

Current providers

- News
- Historical Data
- Onchain Analytics
- LLM

Future providers may include

- Polymarket
- Arkham
- Nansen
- Glassnode
- Dune
- x402 Research Marketplace

---

# Runtime Responsibilities

The runtime is responsible for

- loading profiles
- collecting research
- generating reasoning
- evaluating risk
- determining position size
- producing a trade decision

The runtime **does not**

- create wallets
- execute blockchain transactions
- store database records
- manage authentication

Those responsibilities belong to the Bruh Backend.

---

# SDK

Developers can build their own agents using the Bruh SDK.

```
defineAgent(...)
```

The SDK exposes the same runtime interface used by built-in profiles.

Example

```ts
export default defineAgent({

    name: "Fed Watcher",

    async research(ctx) {

    },

    async estimate(ctx) {

    }

});
```

The runtime automatically handles

- wallet integration
- research budget
- risk pipeline
- execution pipeline
- reputation updates

---

# Agent Manifest

Every custom agent provides metadata describing itself.

Example

```yaml
name: Whale Hunter

version: 1.0.0

author: Bruh

description: Tracks smart money.

markets:

- crypto

capabilities:

- prediction

- research

- trading
```

The manifest is used by the backend and UI to display the agent inside the marketplace.

---

# Backend Relationship

This package intentionally contains **no backend logic**.

```
Bruh Backend

↓

Creates Circle Wallet

↓

Funds Wallet

↓

Loads Agent

↓

Runs Runtime

↓

Receives Decision

↓

Executes Trade

↓

Stores Result
```

The runtime returns a decision.

The backend decides what to do with it.

---

# Design Principles

Every profile should follow these principles.

## Stateless

Profiles should never manage persistence.

---

## Deterministic

Given the same inputs, a profile should produce similar reasoning.

---

## Provider Driven

Profiles consume providers rather than calling APIs directly.

---

## Wallet Agnostic

Profiles never access private keys.

Wallet execution is handled by the backend.

---

## Extensible

Adding new profiles should never require modifying the runtime.

---

# Future Roadmap

Planned built-in profiles

- Quant
- Sentiment
- Oracle
- Debate
- Contrarian
- Risk Manager
- Event Hunter
- Portfolio Manager
- Research Broker

Planned providers

- x402 Marketplace
- Nansen
- Arkham
- Glassnode
- Dune
- Polymarket
- Custom MCP Providers

Planned SDK Features

- Remote Agents
- Agent Marketplace Publishing
- Agent Verification
- Versioned Runtime
- Multi-Agent Collaboration

---

# Vision

Bruh is not a collection of trading bots.

Bruh is an execution runtime for autonomous economic agents.

Built-in profiles make the platform accessible to everyone.

The SDK allows developers to build entirely new forms of intelligence.

Both execute through the exact same runtime, creating a unified ecosystem where humans choose **what** an agent should specialize in while Bruh handles **how** it operates.