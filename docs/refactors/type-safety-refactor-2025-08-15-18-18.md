# Type Safety Refactor Plan
**Document**: type-safety-refactor-2025-08-15-18-18.md  
**Created**: August 15, 2025 @ 18:18  
**Author**: Claude (Anthropic)  
**Purpose**: Comprehensive type safety refactoring to eliminate redundancies and ensure compile-time safety

---

## Executive Summary

This document outlines a complete type safety refactoring for the Cardano DeFi Assistant project. The refactor addresses scattered database types, missing type annotations, redundant DTOs, and ensures type safety across all database operations without over-engineering.

### Key Principles
- **Safety First**: Every database operation must have known return types
- **Single Source of Truth**: All database types in one location
- **No Unnecessary Abstraction**: Skip DTOs when they mirror database types
- **Practical Over Perfect**: Add types only where they add safety or clarity

---

## Current State Analysis

### Problems Identified

1. **Scattered Database Types**
   - `DatabaseTransaction` in wallet-transaction-repository.ts
   - `DatabaseToken` in token-repository.ts
   - `DatabaseAssetFlow` in wallet-transaction-repository.ts
   - `DatabaseSyncJob` in supabase-queue-service.ts

2. **Missing Type Annotations**
   - RPC calls return `any` or incorrect types
   - Complex joins lack proper typing
   - Query builders missing explicit return types

3. **Redundancies**
   - `UTXO` type duplicated (CardanoUTXO vs UTXO)
   - DTOs that exactly mirror database types
   - Logger interface redefined locally

4. **Type Safety Gaps**
   - Line 127 in wallet-transaction-repository: `result.inserted_count` on untyped result
   - Line 197 in wallet-transaction-repository: `data?.block_height` with type 'never'
   - Multiple `as any` casts throughout codebase

### Files Requiring Changes
- `src/repositories/wallet-transaction-repository.ts`
- `src/repositories/token-repository.ts`
- `src/services/transaction-api.ts`
- `src/services/queue/supabase-queue-service.ts`
- `src/services/interfaces/blockchain-fetcher.ts`
- `src/lib/supabase/server.ts`
- `src/app/api/transactions/route.ts`
- `src/app/api/wallet/sync/route.ts`

---

## Implementation Plan

### STEP 1: Create Centralized Database Types
**File to Create**: `src/types/database.ts`

```typescript
/**
 * Database Types
 * 
 * Central location for all database table structures, RPC return types,
 * and complex query result types. These types match the exact structure
 * of data returned from Supabase.
 */

// ============================================
// TABLE TYPES
// ============================================

/**
 * wallet_transactions table structure
 * Moved from: src/repositories/wallet-transaction-repository.ts
 */
export type DatabaseTransaction = {
  id: string;
  user_id: string;
  wallet_address: string;
  tx_hash: string;
  block_height: number;
  tx_timestamp: string;    // ISO string from database
  tx_action: string;        // Using tx_ prefix per migration 20250115
  tx_protocol?: string;     
  description: string;
  net_ada_change: string;   // BIGINT stored as string
  fees: string;             // BIGINT stored as string
  created_at?: string;
  updated_at?: string;
}

/**
 * asset_flows table structure
 * Moved from: src/repositories/wallet-transaction-repository.ts
 */
export type DatabaseAssetFlow = {
  id?: string;
  transaction_id: string;
  token_unit: string;
  net_change: string;       // BIGINT as string
  in_flow: string;          // BIGINT as string
  out_flow: string;         // BIGINT as string
}

/**
 * tokens table structure
 * Moved from: src/repositories/token-repository.ts
 */
export type DatabaseToken = {
  unit: string;
  policy_id: string;
  asset_name: string;
  name?: string;
  ticker?: string;
  decimals: number;
  category: string;         // Maps to TokenCategory enum
  logo?: string;
  metadata?: any;           // JSONB
}

/**
 * sync_jobs table structure
 * Moved from: src/services/queue/supabase-queue-service.ts
 */
export type DatabaseSyncJob = {
  id: string;
  type: string;
  data: any;                // JSONB
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
  retry_count: number;
  max_retries: number;
  metadata?: any;           // JSONB
}

/**
 * users table structure (app_users)
 */
export type DatabaseUser = {
  id: string;
  wallet_address: string;
  wallet_type: string;
  created_at: string;
  updated_at: string;
}

/**
 * wallets table structure
 */
export type DatabaseWallet = {
  id: string;
  user_id: string;
  address: string;
  synced_block_height: number;
  last_sync_at: string;
  sync_status: 'idle' | 'syncing' | 'completed' | 'failed';
  created_at?: string;
  updated_at?: string;
}

// ============================================
// RPC FUNCTION RETURN TYPES
// ============================================

/**
 * Return type for bulk_insert_transactions RPC
 * From: supabase/migrations/20250815000002_update_rpc_to_use_tx_prefix.sql
 */
export type BulkInsertResult = {
  inserted_count: number;
  skipped_count: number;
}

/**
 * Return type for get_transactions_paginated RPC
 * From: supabase/migrations/20250113000001_fix_schema_and_add_queue.sql
 */
export type TransactionPaginatedRow = {
  transaction_id: string;
  wallet_address: string;
  tx_hash: string;
  block_height: number;
  tx_timestamp: string;
  tx_action: string;
  tx_protocol?: string;
  description: string;
  net_ada_change: string;
  fees: string;
  asset_flows: any;         // JSONB with asset flow data
}

// ============================================
// COMPLEX QUERY TYPES
// ============================================

/**
 * Transaction with joined asset flows and tokens
 * Used in findByTxHash queries
 */
export type DatabaseTransactionWithFlows = DatabaseTransaction & {
  asset_flows: (DatabaseAssetFlow & {
    tokens: DatabaseToken;
  })[];
}

/**
 * Partial types for specific column selections
 */
export type TransactionBlockHeight = Pick<DatabaseTransaction, 'block_height'>;
export type TokenUnit = Pick<DatabaseToken, 'unit'>;

// ============================================
// SUPABASE RESPONSE TYPES
// ============================================

/**
 * Generic Supabase response wrapper
 */
export type SupabaseResponse<T> = {
  data: T | null;
  error: PostgrestError | null;
}
```

### STEP 2: Update wallet-transaction-repository.ts

**Line-by-line changes:**

1. **Lines 13-17**: Add import
```typescript
import type { 
  DatabaseTransaction, 
  DatabaseAssetFlow, 
  BulkInsertResult,
  TransactionPaginatedRow,
  DatabaseTransactionWithFlows,
  TransactionBlockHeight
} from '@/types/database';
```

2. **Lines 19-43**: Delete local type definitions (moved to database.ts)

3. **Line 121**: Add type annotation
```typescript
const result = await this.executeReadOperation<BulkInsertResult>(
```

4. **Line 132**: Add type annotation
```typescript
const data = await this.executeReadOperation<TransactionPaginatedRow[]>(
```

5. **Line 166**: Add type annotation
```typescript
const data = await this.executeReadOperation<DatabaseTransactionWithFlows>(
```

6. **Line 186**: Update to use imported type
```typescript
const data = await this.executeReadOperation<TransactionBlockHeight>(
```

7. **Line 221**: Update parameter type
```typescript
private mapToWalletTransaction(row: TransactionPaginatedRow | DatabaseTransactionWithFlows): WalletTransaction {
```

### STEP 3: Update token-repository.ts

**Line-by-line changes:**

1. **Lines 13-16**: Update imports
```typescript
import type { DatabaseToken } from '@/types/database';
```

2. **Lines 18-29**: Delete local type definition

3. **Line 37**: Add type annotation
```typescript
const data = await this.executeReadOperation<DatabaseToken>(
```

4. **Line 46**: Remove unnecessary cast
```typescript
return data ? this.mapToTokenInfo(data) : null;  // Remove 'as DatabaseToken'
```

5. **Line 98**: Add type annotation
```typescript
const data = await this.executeReadOperation<DatabaseToken[]>(
```

6. **Line 110**: Add type annotation
```typescript
const data = await this.executeReadOperation<DatabaseToken[]>(
```

### STEP 4: Update transaction-api.ts

**Line-by-line changes:**

1. **Lines 1-4**: Update imports
```typescript
import type { 
  TransactionPaginatedRow,
  DatabaseAssetFlow,
  DatabaseToken 
} from '@/types/database';
```

2. **Lines 9-51**: Delete all DTO interfaces (TransactionDTO, AssetFlowDTO, TokenDTO)

3. **Line 79**: Update function signature
```typescript
function mapDTOToWalletTransaction(dto: TransactionPaginatedRow): WalletTransaction {
```

4. Update all references from DTO types to Database types throughout file

### STEP 5: Fix UTXO Redundancy

**File: src/services/interfaces/blockchain-fetcher.ts**

1. **Lines 13-28**: Replace UTXO definition with import
```typescript
import type { CardanoUTXO } from '@/types/wallet';

// Use CardanoUTXO instead of defining new UTXO type
export type { CardanoUTXO as UTXO };  // For backward compatibility
```

### STEP 6: Update supabase-queue-service.ts

**Line-by-line changes:**

1. **Line 10**: Add import
```typescript
import type { DatabaseSyncJob } from '@/types/database';
```

2. **Line 17**: Delete local DatabaseSyncJob interface

3. **Line 93**: Add type annotation
```typescript
const { data, error } = await this.supabase
  .rpc<DatabaseSyncJob>('get_next_sync_job');
```

4. **Line 117**: Add type annotation
```typescript
const { data, error } = await this.supabase
  .rpc<void>('complete_sync_job', {
```

5. **Line 285**: Add type annotation
```typescript
await this.supabase.rpc<void>('cleanup_old_sync_jobs');
```

6. Update mapToQueueJob signature:
```typescript
private mapToQueueJob(dbJob: DatabaseSyncJob): QueueJob<WalletSyncJobData> {
```

### STEP 7: Minor Fixes

**File: src/services/transaction-categorizer-service.ts**
- Line 20: Delete Logger interface, use Console type or omit

**File: src/lib/supabase/server.ts**
- Line 172: Add type annotation
```typescript
.rpc<string>('upsert_app_user', {
```

---

## Testing Strategy

### After Each Step
```bash
# Run TypeScript compilation check
npx tsc --noEmit 2>&1 | head -20

# Count remaining errors
npx tsc --noEmit 2>&1 | wc -l
```

### Integration Tests After Completion
```bash
# Test repository operations
npx tsx local-testing/verify-balance-calculation.ts
npx tsx local-testing/verify-transactions-display.ts

# Test sync worker
npx tsx local-testing/test-sync-worker.ts

# Test API endpoints
npx tsx local-testing/test-transactions-api.ts

# Full build
npm run build
```

---

## Guidelines and Warnings

### DO:
✅ Keep database types exactly as they come from database  
✅ Use `Pick<Type, 'field'>` for partial selections  
✅ Add type annotations only where TypeScript can't infer  
✅ Test after each file change  
✅ Commit after each successful step  

### DON'T:
❌ Create DTOs that mirror database types  
❌ Use `any` unless absolutely necessary  
❌ Add types for the sake of types  
❌ Change business logic during refactor  
❌ Skip testing between steps  

### Watch Out For:
⚠️ Circular dependencies when moving types  
⚠️ JSONB fields that might need better typing  
⚠️ BigInt fields stored as strings in database  
⚠️ Ensure imports are updated in test files  
⚠️ Some local-testing scripts may need import updates  

---

## Expected Outcomes

### Before Refactor:
- 12 TypeScript errors
- Scattered type definitions
- Missing IntelliSense for database operations
- Redundant DTO types
- Unsafe `any` casts

### After Refactor:
- 0 TypeScript errors
- Single source of truth for database types
- Full IntelliSense support
- No redundant types
- Type-safe database operations

---

## Rollback Plan

If issues arise:
1. Git stash current changes: `git stash`
2. Revert to last known good state
3. Apply changes file by file
4. Test incrementally

---

## Notes for Next Agent

This refactor focuses on **practical type safety** without over-engineering. The goal is to catch errors at compile time and improve developer experience through better IntelliSense.

Key decisions made:
1. **No separate DTOs** - Database types are used directly since they match API needs
2. **Centralized database types** - All in `src/types/database.ts` for maintainability
3. **Minimal new types** - Reuse existing types wherever possible
4. **Type annotations only where needed** - Let TypeScript infer when it can

The refactor should be done in order, testing after each step. Each step builds on the previous one, so skipping steps may cause issues.

---

## Appendix: File Locations

### Core Files to Modify:
- `src/types/database.ts` (CREATE NEW)
- `src/repositories/wallet-transaction-repository.ts`
- `src/repositories/token-repository.ts`
- `src/services/transaction-api.ts`
- `src/services/queue/supabase-queue-service.ts`
- `src/services/interfaces/blockchain-fetcher.ts`
- `src/services/transaction-categorizer-service.ts`
- `src/lib/supabase/server.ts`

### Files That May Need Import Updates:
- `src/app/api/transactions/route.ts`
- `src/app/api/wallet/sync/route.ts`
- `src/workers/sync-worker.ts`
- Various files in `local-testing/`

---

**End of Document**