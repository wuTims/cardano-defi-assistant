
# Portfolio Data Construction from Blockfrost

Generated: 2025-08-13T06:29:28.373Z
Wallet: addr1q88e4cenkacs32sk9w9dwdncnxyfxxsttfua2lutd7qklwryjz36as5paaj2xk5qet6u93clltzdddcnfm2sf3jtjwsqajl5ln
Transactions Analyzed: 48

## 1. Data Flow: Blockfrost → Portfolio

### Raw Data from Blockfrost
- Transaction hashes for address
- Full transaction details (inputs/outputs)
- Token metadata
- Current UTXOs

### Transformation Pipeline

```
Blockfrost API
    ↓
Raw Transaction (inputs/outputs)
    ↓
Asset Flow Calculator (wallet perspective)
    ↓
Transaction Categorizer (action + protocol)
    ↓
Portfolio Aggregator
    ↓
P&L Calculator
```

## 2. Current Holdings Calculation

Current Balance = Sum of all historical net changes

Example from your wallet:

- ADA: 5874686953
- a04ce7a525...: 801316174348
- d15c36d6de...: 138073913437
- 279c909f34...: 0
- 6d06570ddd...: 0


## 3. Cost Basis Tracking for P&L

### Acquisition Events (Cost Basis Created)
- receive: Direct transfer in
- swap (asset received): Market value at swap time
- provide_liquidity: LP tokens received
- supply: qTokens received (Liqwid)
- claim_rewards: Rewards at claim time

### Disposal Events (P&L Realized)
- send: Direct transfer out
- swap (asset sent): Compare to cost basis
- remove_liquidity: LP tokens burned
- withdraw: qTokens burned

## 4. Protocol Position Tracking

### Detected Protocol Interactions

- **Minswap**: 24 transactions


## 5. Transaction Batching

Complex DeFi operations often span multiple transactions:


### Batch Example: Minswap
Block: 12159112
- 166e3e37d4... : claim_rewards
- d0d0a61937... : unknown

### Batch Example: Minswap
Block: 12159078
- 0c1f0da4b7... : claim_rewards
- 6c2f7600ab... : complex_swap


## 6. Database Schema for Portfolio

```sql
-- Current holdings (calculated from flows)
CREATE TABLE portfolio_holdings (
  wallet_address TEXT,
  token_unit TEXT,
  quantity DECIMAL,
  avg_cost_basis DECIMAL,
  current_value DECIMAL,
  unrealized_pnl DECIMAL,
  last_updated TIMESTAMP
);

-- Cost basis lots (FIFO/LIFO support)
CREATE TABLE cost_basis_lots (
  id UUID PRIMARY KEY,
  wallet_address TEXT,
  token_unit TEXT,
  quantity DECIMAL,
  cost_per_unit DECIMAL,
  acquisition_date TIMESTAMP,
  acquisition_tx_hash TEXT,
  disposal_date TIMESTAMP,
  disposal_tx_hash TEXT,
  realized_pnl DECIMAL
);

-- Protocol positions
CREATE TABLE protocol_positions (
  wallet_address TEXT,
  protocol TEXT,
  position_type TEXT, -- 'supplied', 'borrowed', 'lp', 'staked'
  base_asset TEXT,
  base_quantity DECIMAL,
  receipt_token TEXT, -- qADA, LP token, etc
  receipt_quantity DECIMAL,
  opened_at TIMESTAMP,
  closed_at TIMESTAMP,
  status TEXT -- 'active', 'closed'
);
```

## 7. Key Metrics Calculation

### Total Value Locked (TVL)
- Sum of all active protocol positions
- Valued at current market prices

### Profit & Loss
- Realized P&L: From closed positions
- Unrealized P&L: Current value - cost basis

### APY Calculation
- Track rewards over time
- Compare to initial investment

---
Full analysis saved to: portfolio-data-construction.md
