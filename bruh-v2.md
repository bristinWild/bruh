# BRUH V2

> Autonomous AI agents for prediction markets powered by Circle Wallets, ARC Network and ensemble reasoning.

BRUH is an autonomous prediction market infrastructure where independent AI agents continuously discover markets, perform research, generate probabilistic forecasts, reach consensus, and optionally execute trades using programmable wallets.

Unlike traditional trading bots, BRUH separates **research**, **reasoning**, **consensus**, and **execution** into independent systems, allowing every decision to be transparent, auditable and configurable.

---

# Core Principles

- Autonomous by default
- Multiple independent AI profiles
- Consensus before execution
- Risk-first architecture
- Human approval optional
- Fully auditable runtime
- Wallet-native execution
- Modular architecture

---

# Current Features

## Agent Management

- Create multiple agents
- Circle programmable wallets
- Individual risk configuration
- Kelly sizing
- Edge thresholds
- Independent identities

---

## Runtime Engine

Every execution follows the same deterministic pipeline.

```
Market
   │
   ▼
Research
   │
   ▼
Independent Profiles
   │
   ▼
Consensus
   │
   ▼
Risk Engine
   │
   ▼
Execution Plan
   │
   ▼
Wallet Execution
   │
   ▼
Timeline
```

---

## AI Profiles

### Newshound

Designed for information momentum.

Focuses on

- news
- sentiment
- narratives
- market reactions

---

### Actuary

Designed for statistical reasoning.

Focuses on

- base rates
- historical probabilities
- expected value
- uncertainty

---

### Ensemble

Runs multiple profiles simultaneously.

Instead of trusting a single AI model, BRUH compares multiple independent opinions before producing a final execution plan.

---

# Project Structure

```
frontend/
    Next.js dashboard

backend/
    NestJS runtime

contracts/
    Prediction market smart contracts

database/
    Supabase schema

shared/
    Shared types
```

---

# High Level Architecture

```
                    User

                     │

                     ▼

             Next.js Dashboard

                     │

          REST API / JWT Auth

                     │

                     ▼

               NestJS Backend

      ┌──────────┴──────────┐

      ▼                     ▼

 Runtime Engine       Autonomy Scheduler

      │                     │

      ▼                     ▼

 Consensus Engine   Market Discovery

      │

      ▼

 Execution Engine

      │

      ▼

 Circle Wallet

      │

      ▼

 ARC Prediction Market
```

---

# Runtime Lifecycle

Every run follows this pipeline.

```
Load Wallet

↓

Load Market

↓

Research

↓

Run Profiles

↓

Consensus

↓

Risk Validation

↓

Execution Plan

↓

Trade (optional)

↓

Persist

↓

Timeline
```

---

# Consensus Engine

Each profile independently generates

- probability
- confidence
- edge
- risks
- reasoning

The Ensemble engine combines them into one final decision.

Possible outcomes

- BUY YES
- BUY NO
- PASS

Consensus produces

- combined probability
- confidence
- execution decision
- execution plan

---

# Execution Plans

Every runtime generates a complete execution plan.

Example

```
Decision

PASS

Probability

46%

Confidence

31%

Edge

-1.6%

Risk

Blocked

Wallet

0x....

Market

0x....
```

Execution plans are immutable and fully auditable.

---

# Runtime Timeline

Every important action becomes a timeline event.

Example

```
Research Started

↓

Research Completed

↓

Newshound Recommendation

↓

Actuary Recommendation

↓

Consensus Generated

↓

Execution Skipped

↓

Completed
```

This provides complete observability of every autonomous decision.

---

# Autonomous Scheduling

BRUH continuously scans prediction markets.

Scheduler

```
Every N Minutes

↓

Discover Markets

↓

Ignore Processed Markets

↓

Research

↓

Consensus

↓

Execute (optional)

↓

Store Results

↓

Sleep
```

Every agent owns its own autonomous configuration.

Example

```
Autonomous Mode

Enabled

Schedule

1 minute

Auto Research

true

Auto Trade

false

Markets Per Scan

10
```

---

# Database

Main entities

```
Users

↓

Agents

↓

Runs

↓

Execution Plans

↓

Timeline

↓

Market Scans
```

Each table has a single responsibility.

---

# Circle Wallet Integration

Every agent owns a dedicated programmable wallet.

Wallets are responsible for

- custody
- signing
- execution
- settlement

The AI runtime never directly owns assets.

---

# Security

Authentication

- JWT

Ownership

- Wallet ownership verification

Trading Protection

- Kelly sizing
- Position limits
- Edge thresholds
- Risk validation
- Optional human approval

---

# Technology Stack

Frontend

- Next.js
- React
- Tailwind CSS
- Framer Motion

Backend

- NestJS
- TypeScript
- Supabase
- Viem

Infrastructure

- Circle Wallets
- ARC Network
- OpenAI
- Supabase

---

# Current Progress

## Completed

- Agent runtime
- Multi-profile execution
- Consensus engine
- Execution plans
- Runtime timeline
- Autonomous scheduler
- Market discovery
- Circle wallet integration
- Dashboard
- Risk engine

---

## In Progress

- Live news adapters
- Research providers
- Trade execution
- Portfolio management
- Notifications

---

## Planned

- Redis
- BullMQ
- WebSockets
- Streaming runtime
- Multi-chain execution
- Portfolio optimizer
- Reputation system
- Agent marketplace

---

# Long-Term Vision

BRUH aims to become the autonomous operating system for prediction market agents.

Instead of manually placing trades, users deploy autonomous agents that continuously

- discover markets
- research information
- reason independently
- reach consensus
- manage risk
- execute capital
- explain every decision

Every decision is transparent.

Every action is reproducible.

Every execution is auditable.

---