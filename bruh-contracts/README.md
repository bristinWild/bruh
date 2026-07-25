# Bruh Protocol  - Smart Contracts

Binary prediction markets on Arc Testnet. USDC-native. Agent-resolved.

## Architecture

```
MarketFactory
└── Market (one per question)
    ├── CPMM AMM (YES/NO reserves)
    ├── Collateral pool (USDC)
    ├── LP shares
    └── Oracle resolution
```

### Market.sol
Binary CPMM prediction market. Invariant: `reserveYes × reserveNo = k`.

| Function | Description |
|---|---|
| `buy(isYes, usdcIn, minOut)` | Swap USDC for YES/NO shares |
| `sell(isYes, sharesIn, minOut)` | Swap shares back for USDC |
| `addLiquidity(usdcIn)` | Add equal liquidity to both sides |
| `removeLiquidity(lpIn)` | Burn LP shares for USDC |
| `requestResolution()` | Anyone calls after closeTime |
| `resolve(outcome)` | Oracle submits YES/NO/INVALID |
| `redeem()` | Winners claim USDC |
| `withdrawFees()` | Send accrued fees to treasury |

### MarketFactory.sol
Deploys markets, manages oracle rotation and emergency pause.

## Setup

```bash
# Install dependencies
forge install

# Copy env
cp .env.example .env
# Fill in .env values

# Build
forge build

# Test (10,000 fuzz runs)
forge test -vv

# Coverage
forge coverage

# Gas snapshot
forge snapshot
```

## Deploy to Arc Testnet

```bash
# Get testnet USDC from faucet.circle.com
# Fund deployer wallet from Arc faucet

forge script script/Deploy.s.sol \
  --rpc-url $ARC_RPC_URL \
  --broadcast \
  -vvvv
```

## Resolve a Market (Oracle Agent)

```bash
MARKET_ADDRESS=0x... OUTCOME=1 \
forge script script/ResolveScript.s.sol \
  --rpc-url $ARC_RPC_URL \
  --broadcast
```

## Security

- ReentrancyGuard on all state-changing external functions
- Pausable emergency halt (factory owner only)
- Two-step ownership transfer (Ownable2Step)
- Slippage protection on every trade
- Custom errors (no string reverts)
- Oracle rotation via factory only
- Integer math only (no floating point)
- Fuzz tested with 10,000 runs per test

## Fee Model

1% swap fee (configurable up to 5%):
- 50% → treasury (withdrawable via `withdrawFees()`)
- 50% → LP pool (increases collateral, benefits LPs)
