/**
 * Mock data for testing wallet functionality
 */

import { WalletData } from '../../src/types/wallet';
import { WalletSignatureArgs, AuthChallenge } from '../../src/types/auth';

export const mockWalletAddresses = {
  valid: 'addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzz2zl9c2dhpxy5v9kv4z6snyh6f8g3npz69rtr5cj6vhkrrgqt7vp0t',
  valid2: 'addr1q9adu5dh8t0m84xyr50xj8v4h4zd3qx7k8r4s0l9j8g2c7z8s5x9k4v6h3f8j2n9p1q3r5t7w0z2y4x6v8n0p2r4s6',
  invalid: 'invalid-address',
  empty: ''
} as const;

export const mockWalletTypes = ['nami', 'eternl', 'lace', 'vespr', 'nufi', 'typhon', 'gerowallet'] as const;

export const mockUTXOs = [
  {
    tx_hash: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
    output_index: 0,
    amount: [
      { unit: 'lovelace', quantity: '2500000' },
      { unit: 'asset1234567890abcdef', quantity: '100' }
    ],
    block: 'block_hash_here',
    data_hash: null
  },
  {
    tx_hash: 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3',
    output_index: 1,
    amount: [
      { unit: 'lovelace', quantity: '1500000' }
    ],
    block: 'block_hash_here_2',
    data_hash: null
  }
];

export const mockAssets = [
  {
    unit: 'asset1234567890abcdef',
    quantity: '100'
  },
  {
    unit: 'asset9876543210fedcba',
    quantity: '50'
  }
];

export const mockWalletData: WalletData = {
  address: mockWalletAddresses.valid,
  balance: {
    lovelace: '4000000',
    assets: mockAssets
  },
  utxos: mockUTXOs,
  lastSynced: new Date('2024-08-07T10:00:00Z'),
  syncedBlockHeight: 12345
};

export const mockAuthChallenge: AuthChallenge = {
  walletAddress: mockWalletAddresses.valid,
  nonce: 'challenge-nonce-123',
  challenge: `Please sign this message to authenticate with wallet ${mockWalletAddresses.valid}. Nonce: challenge-nonce-123`,
  expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes from now
};

export const mockSignatureArgs: WalletSignatureArgs = {
  address: mockWalletAddresses.valid,
  signature: 'a4ed2f42b4f98c1f84f5b3c8d9e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7',
  key: 'e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7',
  nonce: 'challenge-nonce-123'
};

export const mockJWTToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ3YWxsZXRBZGRyZXNzIjoiYWRkcjFxeDJmeHYydW15aHR0a3h5eHA4eDBkbHBkdDNrNmN3bmc1cHhqM2poc3lkenoyemw5YzJkaHB4eTV2OWt2NHo2c255aDZmOGczbnB6NjlydHI1Y2o2dmhrcnJncXQ3dnAwdCIsIndhbGxldFR5cGUiOiJuYW1pIiwiaWF0IjoxNzIzMDMyMDAwLCJleHAiOjE3MjMwMzU2MDB9.test-signature';

// Blockfrost API mock responses
export const mockBlockfrostResponses = {
  accountInfo: {
    stake_address: 'stake1test123',
    active: true,
    active_epoch: 374,
    controlled_amount: '4000000',
    rewards_sum: '0',
    withdrawals_sum: '0',
    reserves_sum: '0',
    treasury_sum: '0',
    withdrawable_amount: '0',
    pool_id: null
  },
  
  accountUtxos: mockUTXOs,
  
  accountAssets: mockAssets,
  
  latestBlock: {
    hash: 'latest_block_hash',
    epoch: 374,
    slot: 78901234,
    height: 12345,
    time: 1723032000,
    tx_count: 150,
    size: 50000,
    block_vrf: 'vrf_key_hash',
    previous_block: 'previous_block_hash',
    next_block: null,
    confirmations: 0
  },

  addressInfo: {
    address: mockWalletAddresses.valid,
    amount: [
      { unit: 'lovelace', quantity: '4000000' },
      { unit: 'asset1234567890abcdef', quantity: '100' },
      { unit: 'asset9876543210fedcba', quantity: '50' }
    ],
    stake_address: 'stake1test123',
    type: 'shelley',
    script: false
  }
};

// CIP-30 Wallet API mock
export const mockCIP30Wallet = {
  name: 'MockWallet',
  icon: 'data:image/svg+xml;base64,test-icon',
  version: '1.0.0',
  
  isEnabled: jest.fn().mockResolvedValue(true),
  
  enable: jest.fn().mockResolvedValue({
    getNetworkId: jest.fn().mockResolvedValue(0), // 0 for testnet, 1 for mainnet
    getUtxos: jest.fn().mockResolvedValue([]),
    getBalance: jest.fn().mockResolvedValue('0x3d0900'), // 4000000 in hex
    getUsedAddresses: jest.fn().mockResolvedValue([mockWalletAddresses.valid]),
    getUnusedAddresses: jest.fn().mockResolvedValue([]),
    getChangeAddress: jest.fn().mockResolvedValue(mockWalletAddresses.valid),
    getRewardAddresses: jest.fn().mockResolvedValue(['stake1test123']),
    signTx: jest.fn().mockResolvedValue('signed_tx_cbor_hex'),
    signData: jest.fn().mockResolvedValue({
      signature: mockSignatureArgs.signature,
      key: mockSignatureArgs.key
    }),
    submitTx: jest.fn().mockResolvedValue('tx_hash_result')
  })
};

// Mock error responses
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

// Test environment configuration
export const testConfig = {
  baseURL: 'http://localhost:3000',
  apiTimeout: 10000,
  walletConnectionTimeout: 5000,
  syncTimeout: 15000
};