# Wallet Sync Service - Testing Documentation

## Overview

This directory contains comprehensive test suites for the Wallet Sync Service, implementing a multi-layered testing strategy following the test pyramid approach.

## Test Structure

```
tests/
├── e2e/                    # End-to-End tests (Playwright)
│   ├── landing.spec.ts     # Landing page flow tests
│   ├── wallet-connect.spec.ts # Wallet connection tests
│   ├── dashboard.spec.ts   # Dashboard functionality tests
│   └── error-scenarios.spec.ts # Error handling tests
├── unit/                   # Unit tests (Jest + React Testing Library)
│   ├── components/         # React component tests
│   └── lib/               # Library and utility tests
└── fixtures/              # Shared test data and mocks
    └── mockWalletData.ts  # Mock wallet and API data
```

## Testing Layers

### 1. Unit Tests (Jest + React Testing Library)

**Purpose**: Test individual components, services, and utilities in isolation.

**Coverage**:
- React components (`AuthContext`, `WalletConnectButton`, Dashboard components)
- Service modules (`authService`, `walletSyncService`)
- Configuration management (`config`)
- Error handling system (`errorHandler`)
- Utility functions

**Run Commands**:
```bash
npm test                    # Run all unit tests
npm run test:watch         # Watch mode for development
npm run test:coverage      # Generate coverage report
```

### 2. End-to-End Tests (Playwright)

**Purpose**: Test complete user workflows in a real browser environment.

**Coverage**:
- Landing page navigation and UI
- Wallet connection flow with CIP-30 mocking
- Dashboard functionality and data display
- Error scenarios and edge cases
- Cross-browser compatibility

**Run Commands**:
```bash
npm run test:e2e           # Run E2E tests headless
npm run test:e2e:ui        # Run with Playwright UI
npm run test:e2e:debug     # Debug mode with browser
```

## Test Configuration

### Jest Configuration

Located in `jest.config.js`:
- **Environment**: jsdom for React component testing
- **Coverage**: 80% threshold for branches, functions, lines, statements
- **Module mapping**: Supports Next.js `@/` import alias
- **Timeout**: 10 seconds for async operations

### Playwright Configuration

Located in `playwright.config.ts`:
- **Browsers**: Chromium, Firefox, WebKit
- **Mobile**: iPhone 12, Pixel 5 viewports
- **Base URL**: `http://localhost:3000`
- **Retries**: 2 attempts on CI, 0 locally
- **Artifacts**: Screenshots and videos on failure

## Mock Data and Fixtures

### Wallet Mock Data (`tests/fixtures/mockWalletData.ts`)

Provides realistic test data including:
- Valid Cardano wallet addresses
- UTXO structures
- Asset information
- Authentication tokens
- Blockfrost API responses
- CIP-30 wallet API mock

### CIP-30 Wallet Mocking

E2E tests include comprehensive CIP-30 wallet API mocking:
```typescript
window.cardano = {
  nami: {
    enable: () => Promise.resolve({
      getUsedAddresses: () => Promise.resolve(['addr1...']),
      signData: () => Promise.resolve({ signature: '...', key: '...' })
    })
  }
}
```

## Testing Best Practices

### Unit Tests

1. **Arrange-Act-Assert Pattern**: All tests follow AAA structure
2. **Isolation**: Mock external dependencies
3. **Descriptive Names**: Test names clearly describe the behavior
4. **Edge Cases**: Test both happy path and error scenarios
5. **Clean State**: Reset mocks between tests

### E2E Tests

1. **User-Centric**: Test from user perspective
2. **Realistic Data**: Use production-like test data
3. **Error Handling**: Test network failures and edge cases
4. **Cross-Browser**: Verify compatibility across browsers
5. **Mobile-First**: Include mobile viewport testing

## Test Data Management

### Authentication Flow Testing

```typescript
// Generate challenge
const challengeResponse = authService.generateChallenge(walletAddress);

// Mock wallet signature
const signatureArgs = {
  address: walletAddress,
  signature: 'mock-signature-hex',
  key: 'mock-public-key',
  nonce: challengeResponse.data.nonce
};

// Verify and generate token
const authResult = await authService.verifySignatureAndGenerateToken(
  signatureArgs, 
  'nami'
);
```

### Wallet Data Testing

```typescript
// Mock wallet data structure
const mockWalletData = {
  address: 'addr1...',
  balance: { lovelace: '4000000', assets: [] },
  utxos: [...],
  lastSynced: new Date(),
  syncedBlockHeight: 12345
};
```

## Coverage Requirements

- **Minimum Coverage**: 80% across all metrics
- **Critical Paths**: 95%+ for authentication and sync flows
- **Error Handling**: 100% for error scenarios
- **Component Integration**: Full user interaction flows

## CI/CD Integration

### Test Commands for CI

```bash
npm run test:ci            # Full test suite with coverage
npm run test:coverage      # Unit tests with coverage report
npm run test:e2e           # E2E tests for deployment validation
```

### Environment Setup

Required environment variables for testing:
- `JWT_SECRET`: Test JWT secret (min 32 chars)
- `NEXT_PUBLIC_SUPABASE_URL`: Test Supabase instance
- `SUPABASE_SERVICE_ROLE_KEY`: Test service key
- `BLOCKFROST_KEY`: Test Blockfrost API key

## Debugging Tests

### Unit Test Debugging

```bash
# Debug specific test file
npm test -- --testPathPattern=AuthContext.test.tsx

# Run single test
npm test -- --testNamePattern="should connect wallet"

# Debug with Node inspector
node --inspect-brk node_modules/.bin/jest --runInBand
```

### E2E Test Debugging

```bash
# Run with browser visible
npm run test:e2e:debug

# Run specific test file
npx playwright test landing.spec.ts

# Generate test report
npx playwright show-report
```

## Test Maintenance

### Regular Tasks

1. **Update Mock Data**: Keep test fixtures current with API changes
2. **Browser Updates**: Update Playwright browsers monthly
3. **Coverage Review**: Monitor coverage reports and improve low areas
4. **Performance**: Optimize slow tests and reduce flakiness

### Adding New Tests

1. **Unit Tests**: Place in corresponding directory under `tests/unit/`
2. **E2E Tests**: Add to `tests/e2e/` with descriptive filenames
3. **Fixtures**: Update `mockWalletData.ts` for new test scenarios
4. **Documentation**: Update this README for new test patterns

## Troubleshooting

### Common Issues

1. **TypeScript Errors**: Ensure `@testing-library/jest-dom` types are imported
2. **Mock Issues**: Check mock implementations match actual interfaces
3. **Async Tests**: Use proper `await` and `waitFor` patterns
4. **Environment Variables**: Verify test environment configuration

### Performance Tips

1. **Parallel Execution**: Jest runs tests in parallel by default
2. **Test Isolation**: Avoid shared state between tests
3. **Mock Optimization**: Use lightweight mocks for external services
4. **Selective Testing**: Use watch mode during development

## Security Testing

### Authentication Testing

- Token validation and expiration
- Signature verification
- Challenge-response flow
- Session management

### Input Validation Testing

- Wallet address format validation
- Signature format validation  
- API input sanitization
- Error message security (no sensitive data leaks)

## Reporting and Metrics

### Coverage Reports

- **HTML Report**: `coverage/lcov-report/index.html`
- **LCOV Format**: For CI integration
- **Console Summary**: Quick feedback during development

### E2E Test Reports

- **HTML Report**: Generated by Playwright
- **Screenshots**: Captured on test failures
- **Videos**: Recorded for failed tests
- **Traces**: Full execution traces for debugging

This testing setup ensures comprehensive coverage, reliable CI/CD integration, and maintainable test code that grows with the application.