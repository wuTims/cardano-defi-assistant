## Correct Implementation Approach

### 1) Update Existing Files (No New Files)

* Modify `src/context/AuthContext.tsx` directly
* Remove any “-clean” or “enhanced” file variants
* Follow incremental improvement principle from `CLAUDE.md`

### 2) Replace Union Strings with Proper Enums

**❌ Wrong (current)**

```ts
type WalletConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';
```

**✅ Correct (`CLAUDE.md` compliant)**

```ts
enum WalletConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error'
}
```

### 3) Clean Context Value Structure

**❌ Wrong — unnecessary wrapper**

```ts
const authState = useMemo(() => ({ isAuthenticated, user, token, ... }), [many deps]);
```

**✅ Correct — direct state with computed values only**

```ts
const contextValue = useMemo(() => ({
  // Direct state access
  isAuthenticated,
  user,
  token,
  connectionState,
  error,

  // Computed values (actual benefit from memoization)
  isTokenExpired: token ? new Date(token.expiresAt) <= new Date() : false,
  shouldRefreshToken: token ? isTokenNearExpiry(token, 5 * 60 * 1000) : false,

  // Stable action references
  connectWallet,
  disconnect,
  refreshToken,
  clearError
}), [isAuthenticated, user, token, connectionState, error, connectWallet, disconnect, refreshToken, clearError]);
```

### 4) Modern React Patterns (Properly Applied)

* Use `useMemo` only for **computed values**, not for simple state grouping
* Use `useCallback` for **action functions** to prevent unnecessary re-renders
* Use `useEffect` only for **true side effects** (localStorage, API calls)
* Keep **clean dependency arrays** with meaningful deps

### 5) Integration Strategy

* Replace server-action imports with **fetch-based** API calls
* Maintain **backward compatibility** for existing components

### 6) TypeScript Cleanup

* Add proper **enums** to `src/types/auth.ts`
* Remove old **server action** type imports
* Update context type definitions to match new structure
* Ensure **strict type safety** throughout

