# Wallet Sync Service - Claude Guidelines

## Critical Testing Guidelines - NEVER Rules

### 1. NEVER Create Advanced/Enhanced/Optimized Classes
- **NEVER** create new classes with prefixes like "Advanced", "Enhanced", "Optimized", or "Comprehensive"
- **ALWAYS** improve CURRENT classes incrementally instead
- Focus on simple, focused helpers that serve immediate needs
- Example of violation: `AdvancedErrorTester`, `EnhancedApiMockHelper`
- Correct approach: `ErrorScenarioHelper` with simple, current features

### 2. NEVER Implement Tests for Unplanned Features
- **NEVER** implement tests for features we have not planned yet
- **ONLY** implement new tests when there is a new feature we want to develop and test
- Avoid creating test infrastructure for hypothetical or advanced scenarios
- Example of violation: accessibility tests, pre-authenticated dashboard tests, network simulation tests
- Correct approach: Test only current features like wallet connection, basic auth flow

### 3. NEVER Use String Unions Instead of Enums
- **NEVER** use string unions like `type: 'wallet-not-found' | 'invalid-signature' | ...`
- **ALWAYS** create proper TypeScript enums for type safety
- Example of violation: `createErrorResponse(type: 'wallet-not-found' | 'invalid-signature')`
- Correct approach: `createErrorResponse(type: ErrorType)` with `enum ErrorType`

### 4. NEVER Put Documentation Outside docs/ Folder
- **NEVER** create documentation files (*.md) outside the docs/ folder structure
- **ALWAYS** organize documentation in proper docs/ subfolder hierarchy
- Move any misplaced documentation to appropriate docs/ location
- Example structure: `docs/testing/implementation/`, `docs/testing/patterns/`

### 5. NEVER Use Unverified Assumptions
- **NEVER** use unverified assumptions in implementing logic
- If a conditional check or verification isn't accurate, prompt for a verification check

## Testing Architecture Principles

### Error Scenario Pattern (Approved)
The modular error scenario pattern is valuable for efficient plug-and-play testing:
```typescript
// Good: Simple, modular error scenarios
export class ErrorScenarioHelper {
  static readonly SCENARIOS: Record<string, ErrorScenario> = {
    networkOffline: { /* setup, verify, cleanup */ },
    serverError: { /* setup, verify, cleanup */ },
    authTokenExpired: { /* setup, verify, cleanup */ }
  };
  
  static async applyScenario(page: Page, scenarioId: string): Promise<void> {
    // Apply predefined scenario for consistent testing
  }
}
```

### Current Technology Stack
- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS
- **Wallet Integration**: MeshJS for Cardano CIP-30 compliance
- **Database**: Supabase with Row Level Security
- **Authentication**: JWT with wallet signature verification
- **Testing**: Playwright with TypeScript

### File Structure Guidelines
```
tests/
├── fixtures/
│   ├── types/index.ts          # Enums (ErrorType, WalletType, etc.)
│   ├── helpers/
│   │   └── error-scenario-helper.ts  # Simple scenario helper
│   └── test-data/
│       └── wallet-data-factory.ts    # Uses proper enums
├── e2e/
│   └── error-scenarios.spec.ts      # Current feature tests only
└── README.md                        # Basic test overview only
```

## Code Quality Standards

### TypeScript Best Practices
- Use strict typing with proper enums
- Avoid `any` type usage
- Leverage type inference appropriately
- Create interfaces for complex data structures

### Error Handling
- Use centralized error handling patterns
- Implement proper error scenario testing
- Focus on current application error states
- Avoid over-engineering error scenarios

## Memory from Previous Issues
- **August 7, 2025**: Violated NEVER rules by creating advanced testing infrastructure
- **Root cause**: Created AdvancedErrorTester, advanced pattern tests, string unions
- **Lesson**: Always stick to simple, incremental improvements of current features
- **Prevention**: Review these guidelines before implementing any testing infrastructure

## Development Commands
```bash
npm test              # Run test suite
npm run build        # Build application
npx tsc --noEmit      # TypeScript checking
npm run lint         # Code linting
```