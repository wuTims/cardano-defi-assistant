# Liqwid qToken Detection Issue

## Problem Discovered
Our TransactionCategorizerService was failing to detect Liqwid protocol interactions because qTokens use a different token naming convention than expected.

## Root Cause
1. **qTokens have EMPTY asset names** - The asset name field (hex after policy ID) is empty
2. **Cannot be decoded to ASCII** - There's no "qADA" or "qIUSD" string to decode
3. **Must be identified by Policy ID** - Each qToken has a unique policy ID

## Known qToken Policy IDs
```typescript
const LIQWID_QTOKEN_POLICIES = {
  'a04ce7a52545e5e33c2867e148898d9e667a69602285f6a1298f9d68': 'qADA',
  // Need to identify qIUSD, qMIN, qDJED, etc.
};
```

## Example Transaction
Transaction: `0ded8ac279d9bf95c65d9b099adbc07ab076e3050c2a1c2a810197c7a968be34`
- User sent: 1002 ADA
- User received: 47.4 billion qADA units
- Action: LEND/SUPPLY (providing ADA as collateral)

## Solution Required
1. Update `TransactionCategorizerService` to check policy IDs
2. Update `TokenRegistryService` to recognize qTokens by policy
3. Maintain a registry of known Liqwid policy IDs
4. Don't rely on ASCII decoding for protocol detection

## Impact
- All Liqwid transactions were being categorized as generic transfers
- Unable to track lending, borrowing, and collateral management
- Missing critical DeFi protocol interactions

## Lessons Learned
- Cardano tokens don't always have human-readable names
- Policy IDs are the reliable identifier
- Protocol-specific tokens may use empty asset names
- Need to research protocol token standards before implementation