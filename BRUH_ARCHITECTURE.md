# BRUH Architecture

> **Version:** 2.0
>
> **Status:** Phase 12 Complete
>
> **Last Updated:** August 2026

---

# Overview

BRUH is an autonomous prediction market infrastructure that enables both built-in and third-party AI agents to research, forecast, and execute prediction market trades through a unified execution pipeline.

Unlike traditional AI agent platforms, BRUH separates **decision making** from **execution authority**.

Agents are responsible for generating research and probability estimates, while BRUH remains solely responsible for:

- Risk evaluation
- Position sizing
- Trade authorization
- Wallet custody
- Execution
- Settlement

This separation ensures that no external agent can directly execute trades or bypass BRUH's safety guarantees.

---

# Table of Contents

1. Vision
2. Design Principles
3. High-Level Architecture
4. Repository Structure
5. System Components
6. Frontend Architecture
7. Backend Architecture
8. Agent SDK
9. Built-in Agents
10. Custom Agent Protocol
11. Agent Lifecycle
12. Runtime Pipeline
13. Decision Engine
14. Risk Engine
15. Position Sizing
16. Execution Planning
17. Wallet Architecture
18. Database Architecture
19. API Architecture
20. Security Model
21. Deployment
22. Extension Points
23. Roadmap

---

# 1. Vision

> TODO

---

# 2. Design Principles

> TODO

---

# 3. High-Level Architecture

## Architecture Diagram

```text
                    ┌───────────────────────┐
                    │      BRUH UI          │
                    └──────────┬────────────┘
                               │
                               ▼
                    ┌───────────────────────┐
                    │     BRUH Backend      │
                    └──────────┬────────────┘
                               │
             ┌─────────────────┼─────────────────┐
             ▼                 ▼                 ▼
      Built-in Agents    Custom Agents      Wallet Engine
             │                 │                 │
             └──────────┬──────┘                 │
                        ▼                        ▼
               Decision Pipeline        Circle Wallets
                        │
                        ▼
                Risk & Execution
                        │
                        ▼
                  Prediction Market
```

### Responsibilities

> TODO

---

# 4. Repository Structure

```text
bruh/
│
├── bruh-agent/
│
├── bruh-backend/
│
├── frontend/
│
├── docs/
│
└── BRUH_ARCHITECTURE.md
```

## Repository Responsibilities

| Repository | Purpose | Status |
|------------|----------|--------|
| bruh-agent | Public SDK | 🚧 |
| bruh-backend | Core backend | 🚧 |
| frontend | Dashboard | 🚧 |

---

# 5. System Components

## Components

- Backend
- Frontend
- SDK
- Runtime
- Wallet Engine
- Database
- Execution Queue
- Custom Agent Registry

> TODO

---

# 6. Frontend Architecture

> TODO

---

# 7. Backend Architecture

## Modules

- Authentication
- Agent Management
- Runtime
- Research
- Execution
- Wallets
- Custom Agents

### Module Diagram

```text
┌──────────────────────────────┐
│ Authentication               │
├──────────────────────────────┤
│ Agent Management             │
├──────────────────────────────┤
│ Runtime                      │
├──────────────────────────────┤
│ Execution                    │
├──────────────────────────────┤
│ Wallet                       │
├──────────────────────────────┤
│ Custom Agents                │
└──────────────────────────────┘
```

> TODO

---

# 8. Agent SDK

> TODO

---

# 9. Built-in Agents

> TODO

---

# 10. Custom Agent Protocol

Protocol Version

```
2026-08-01
```

### Endpoints

```
GET /v1/health
POST /v1/run
```

> TODO

---

# 11. Agent Lifecycle

```text
Developer

↓

Build Agent

↓

Publish

↓

Verify

↓

Activate

↓

Run

↓

Persist

↓

Execution
```

> TODO

---

# 12. Runtime Pipeline

```text
Incoming Request
        │
        ▼
Research
        │
        ▼
Estimate
        │
        ▼
Decision
        │
        ▼
Risk Engine
        │
        ▼
Kelly Sizing
        │
        ▼
Execution Plan
        │
        ▼
Persistence
```

> TODO

---

# 13. Decision Engine

> TODO

---

# 14. Risk Engine

> TODO

---

# 15. Position Sizing

> TODO

---

# 16. Execution Planning

> TODO

---

# 17. Wallet Architecture

> TODO

---

# 18. Database Architecture

## Tables

- users
- agent_wallets
- agent_runs
- custom_agents
- execution_receipts
- transactions

### Relationships

> TODO

---

# 19. API Architecture

## Public APIs

> TODO

## Internal APIs

> TODO

---

# 20. Security Model

## Trust Boundaries

```text
Developer Agent
        │
        ▼
Protocol Validation
        │
        ▼
Risk Engine
        │
        ▼
Execution
```

> TODO

---

# 21. Deployment

```text
Frontend
   │
Vercel

Backend
   │
Railway

Database
   │
Supabase

Wallets
   │
Circle
```

> TODO

---

# 22. Extension Points

Future integrations

- New research providers
- New execution engines
- New prediction markets
- New wallet providers
- New LLM providers
- Marketplace

> TODO

---

# 23. Roadmap

## Phase 12

- [x] Public SDK
- [x] Custom Agent Protocol
- [x] Verification
- [x] Shared Runtime
- [x] Shared Decision Engine
- [x] Shared Risk Engine
- [x] Shared Execution Planning

## Phase 13

- [ ] Marketplace
- [ ] Agent Installation
- [ ] Versioning
- [ ] Reputation
- [ ] Billing
- [ ] Secrets Management

## Phase 14

- [ ] Autonomous execution
- [ ] Multi-market support
- [ ] Cross-chain execution
- [ ] Agent reputation network