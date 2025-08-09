/**
 * Mock data for Playwright tests (without Jest dependencies)
 */

export const mockWalletAddresses = {
  valid: 'addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzz2zl9c2dhpxy5v9kv4z6snyh6f8g3npz69rtr5cj6vhkrrgqt7vp0t',
  valid2: 'addr1q9adu5dh8t0m84xyr50xj8v4h4zd3qx7k8r4s0l9j8g2c7z8s5x9k4v6h3f8j2n9p1q3r5t7w0z2y4x6v8n0p2r4s6',
  invalid: 'invalid-address',
  empty: ''
} as const;

export const mockJWTToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ3YWxsZXRBZGRyZXNzIjoiYWRkcjFxeDJmeHYydW15aHR0a3h5eHA4eDBkbHBkdDNrNmN3bmc1cHhqM2poc3lkenoyemw5YzJkaHB4eTV2OWt2NHo2c255aDZmOGczbnB6NjlydHI1Y2o2dmhrcnJncXQ3dnAwdCIsIndhbGxldFR5cGUiOiJuYW1pIiwiaWF0IjoxNzIzMDMyMDAwLCJleHAiOjE3MjMwMzU2MDB9.test-signature';

export const testConfig = {
  baseURL: 'http://localhost:3000',
  apiTimeout: 10000,
  walletConnectionTimeout: 5000,
  syncTimeout: 15000
};

// CIP-30 Wallet API mock for Playwright
export const mockCIP30Wallet = {
  name: 'MockWallet',
  icon: 'data:image/svg+xml;base64,test-icon',
  version: '1.0.0',
  
  // Mock functions that return promises (Playwright-compatible)
  isEnabled: () => Promise.resolve(true),
  
  enable: () => Promise.resolve({
    getNetworkId: () => Promise.resolve(0), // 0 for testnet, 1 for mainnet
    getUtxos: () => Promise.resolve([]),
    getBalance: () => Promise.resolve('0x3d0900'), // 4000000 in hex
    getUsedAddresses: () => Promise.resolve([mockWalletAddresses.valid]),
    getUnusedAddresses: () => Promise.resolve([]),
    getChangeAddress: () => Promise.resolve(mockWalletAddresses.valid),
    getRewardAddresses: () => Promise.resolve(['stake1test123']),
    signTx: () => Promise.resolve('signed_tx_cbor_hex'),
    signData: () => Promise.resolve({
      signature: 'a4ed2f42b4f98c1f84f5b3c8d9e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7',
      key: 'e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7'
    }),
    submitTx: () => Promise.resolve('tx_hash_result')
  })
};

// Mock error responses for Playwright tests
// Mock wallet data for tests
export const mockWalletData = {
  address: mockWalletAddresses.valid,
  walletType: 'nami' as const,
  balance: {
    ada: '4.000000',
    lovelace: '4000000'
  },
  assets: [
    {
      policyId: 'policy123',
      assetName: 'TestToken',
      quantity: '1000'
    },
    {
      policyId: 'policy456', 
      assetName: 'AnotherToken',
      quantity: '500'
    }
  ],
  utxos: [
    {
      txHash: 'tx123',
      outputIndex: 0,
      amount: [{ unit: 'lovelace', quantity: '2000000' }]
    },
    {
      txHash: 'tx456',
      outputIndex: 1,
      amount: [{ unit: 'lovelace', quantity: '2000000' }]
    }
  ],
  syncedBlockHeight: 12345678,
  lastSynced: new Date('2024-01-15T10:30:00Z'),
  stakingInfo: {
    stakeAddress: 'stake1test123',
    rewards: '0',
    isActive: true
  }
};

export const mockErrorResponses = {
  walletNotFound: {
    success: false,
    error: 'Wallet not found'
  },
  
  invalidSignature: {
    success: false,
    error: 'Invalid wallet signature'
  },
  
  challengeExpired: {
    success: false,
    error: 'Authentication challenge has expired'
  },
  
  networkError: {
    success: false,
    error: 'Network request failed'
  },
  
  blockfrostError: {
    success: false,
    error: 'Blockfrost API error'
  }
};