# @bruh/agent-sdk

Build autonomous AI forecasting agents for the Bruh prediction ecosystem.

The Bruh Agent SDK enables developers to create portable, typed, and deterministic
forecasting agents that can research prediction markets, estimate probabilities,
evaluate risk, and generate execution plans compatible with the Bruh runtime.

> Define your own reasoning. Bruh handles orchestration, execution, scheduling,
> wallet management, and settlement.

---

## Features

- 🤖 Build custom forecasting agents
- 🧠 Custom reasoning pipelines
- 📊 Research + probability estimation
- 🛡 Built-in risk evaluation
- 💰 Kelly position sizing
- 📝 Agent manifest validation
- 🔌 Pluggable providers
- 📚 Agent memory lifecycle
- ⚡ Fully typed TypeScript SDK

---

## Installation

```bash
npm install @bruh/agent-sdk
```

---

## Quick Start

```ts
import { defineAgent } from "@bruh/agent-sdk";

export default defineAgent({
    manifest: {
        id: "my-agent",

        name: "My Agent",

        version: "0.1.0",

        description: "Example forecasting agent.",

        source: "custom",

        difficulty: "developer",

        author: {
            name: "John Doe",
        },

        categories: [
            "macro",
        ],

        capabilities: [
            "research",
            "prediction",
        ],

        permissions: {
            canResearch: true,
            canTrade: false,
            canPurchaseResearch: false,
            canAccessHistoricalData: false,
            canAccessOnchainData: false,
            canUseExternalApis: false,
            maximumTradeUsdc: 0,
        },
    },

    systemPrompt:
        "You are a macro forecasting expert.",

    defaults: {
        edgeThreshold: 0.05,

        kellyFraction: 0.15,

        maxPositionUsdc: 10,

        researchBudgetUsdc: 0.02,

        maxResearchSources: 10,

        minimumConfidence: 0.60,
    },

    async research(context) {
        return {
            profileId: "my-agent",

            marketId: context.market.id,

            collectedAt:
                new Date().toISOString(),

            summary:
                "Research summary.",

            evidence: [],

            costUsdc: 0,
        };
    },

    async estimate(context) {
        return {
            probability: 0.62,

            confidence: 0.71,

            reasoning:
                "Example reasoning.",

            keyFactors: [],

            risks: [],

            recommendedAction:
                "BUY_YES",
        };
    },
});
```

---

# Architecture

```
                +--------------------+
                |   Custom Agent     |
                +--------------------+
                           |
                     defineAgent()
                           |
                           ▼
                +--------------------+
                | Agent Manifest     |
                +--------------------+
                           |
                           ▼
              Manifest Validation Layer
                           |
                           ▼
                 Bruh Runtime Engine
                           |
       +-------------------+-------------------+
       |                   |                   |
   Research          Risk Engine        Position Sizing
       |                   |                   |
       +-------------------+-------------------+
                           |
                           ▼
                  Execution Plan Builder
                           |
                           ▼
                Bruh Backend / Scheduler
                           |
                           ▼
                  Prediction Markets
```

---

# SDK Philosophy

The SDK only defines **how an agent thinks**.

It does **not**:

- execute blockchain transactions
- manage wallets
- schedule executions
- discover markets
- store runs
- maintain infrastructure

Those responsibilities belong to the Bruh backend.

---

# Agent Lifecycle

```
Market
    │
    ▼
Research()
    │
    ▼
Estimate()
    │
    ▼
Risk Evaluation
    │
    ▼
Kelly Position Sizing
    │
    ▼
Execution Plan
    │
    ▼
Bruh Runtime
```

---

# Manifest

Every agent contains a manifest.

```ts
manifest: {
    id
    name
    version
    description
    author
    permissions
    capabilities
}
```

The manifest identifies the agent and declares its permissions and runtime capabilities.

---

# Permissions

| Permission | Description |
|------------|-------------|
| canResearch | May perform research |
| canTrade | May execute trades |
| canPurchaseResearch | May purchase external research |
| canAccessHistoricalData | Historical datasets |
| canAccessOnchainData | On-chain analytics |
| canUseExternalApis | External API access |
| maximumTradeUsdc | Maximum trade size |

---

# Hooks

Every custom agent implements two primary hooks.

## research()

Collects evidence.

Returns

- summary
- evidence
- research cost

---

## estimate()

Produces

- probability
- confidence
- reasoning
- risks
- key factors
- recommended action

---

# Runtime

The runtime is intentionally separated from the public SDK.

```
@bruh/agent-sdk
```

contains only the developer-facing API.

```
@bruhmarket/agent-sdk/runtime
```

contains Bruh runtime utilities used by the backend.

---

# Built-in Profiles

The SDK ships with reference implementations.

- Newshound
- Actuary
- Whale Hunter

Use them as examples when building custom agents.

---

# Provider System

Bruh supports pluggable providers.

Examples include

- Anthropic
- Tavily
- Supabase
- Dune
- x402

Developers can replace providers with their own implementations.

---

# Memory

The SDK includes an optional memory layer.

Supported memories include

- Trade memories
- Reflection memories
- Resolution memories
- Performance summaries

Memory providers are replaceable.

---

# Risk Engine

Before execution every estimate passes through

- confidence validation
- edge validation
- research budget validation
- execution permission validation

Only approved decisions become execution plans.

---

# Position Sizing

Bruh uses Kelly-based sizing.

Inputs include

- estimated probability
- market probability
- bankroll
- Kelly fraction

Output

- recommended USDC allocation

---

# Execution Plans

The SDK never executes trades.

It produces execution plans consumed by the Bruh backend.

```
Research
    ↓
Estimate
    ↓
Risk
    ↓
Execution Plan
```

---

# Examples

See

```
examples/custom-agent.ts
```

---

# API

## SDK

- defineAgent()
- validateAgentManifest()
- normalizeAgentManifest()

## Runtime

- runAgentRuntime()
- executeAgent()

---

# Compatibility

Current SDK Version

```
0.1.x
```

Requires

- Node.js 20+
- TypeScript 5+

---

# Roadmap

- Agent Registry
- Agent Marketplace
- CLI scaffolding
- Agent signing
- Version compatibility
- Remote agent execution
- Hosted research providers

---

# License

MIT