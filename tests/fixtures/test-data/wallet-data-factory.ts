/**
 * Centralized test data factory for generating consistent wallet test data
 */

import { ErrorType, WalletType } from '../types';

// Simple faker replacement for test data generation
const faker = {
  seed: (seed: number) => {
    // Simple seeding implementation for consistent test data
    Math.random = (() => {
      let x = Math.sin(seed++) * 10000;
      return () => x - Math.floor(x);
    })();
  },
  string: {
    uuid: () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    }),
    hexadecimal: ({ length, prefix = '' }: { length: number; prefix?: string }) => {
      const chars = '0123456789abcdef';
      let result = prefix;
      for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
      }
      return result;
    },
    alphanumeric: (length: number) => {
      const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let result = '';
      for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
      }
      return result;
    }
  },
  number: {
    int: ({ min, max }: { min: number; max: number }) => 
      Math.floor(Math.random() * (max - min + 1)) + min,
    float: ({ min, max, fractionDigits }: { min: number; max: number; fractionDigits: number }) => 
      parseFloat((Math.random() * (max - min) + min).toFixed(fractionDigits))
  },
  helpers: {
    arrayElement: <T>(array: T[]): T => 
      array[Math.floor(Math.random() * array.length)]
  },
  datatype: {
    boolean: ({ probability = 0.5 }: { probability?: number } = {}) => 
      Math.random() < probability
  },
  date: {
    recent: ({ days = 1 }: { days?: number } = {}) => 
      new Date(Date.now() - Math.random() * days * 24 * 60 * 60 * 1000)
  },
  commerce: {
    productName: () => {
      const adjectives = ['Awesome', 'Cool', 'Amazing', 'Super', 'Great'];
      const nouns = ['Token', 'Asset', 'Coin', 'NFT', 'Item'];
      return `${faker.helpers.arrayElement(adjectives)} ${faker.helpers.arrayElement(nouns)}`;
    }
  },
  lorem: {
    sentence: () => {
      const words = ['Lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit'];
      const length = Math.floor(Math.random() * 8) + 5;
      let sentence = '';
      for (let i = 0; i < length; i++) {
        sentence += faker.helpers.arrayElement(words) + ' ';
      }
      return sentence.trim() + '.';
    }
  },
  image: {
    url: () => `https://picsum.photos/200/200?random=${Math.floor(Math.random() * 1000)}`
  }
};

export interface TestWalletData {
  address: string;
  walletType: WalletType;
  balance: {
    ada: string;
    lovelace: string;
  };
  assets: TestAsset[];
  utxos: TestUtxo[];
  syncedBlockHeight: number;
  lastSynced: Date;
  stakingInfo: {
    stakeAddress: string;
    rewards: string;
    isActive: boolean;
  };
}

export interface TestAsset {
  policyId: string;
  assetName: string;
  quantity: string;
  metadata?: {
    name?: string;
    description?: string;
    image?: string;
  };
}

export interface TestUtxo {
  txHash: string;
  outputIndex: number;
  amount: Array<{
    unit: string;
    quantity: string;
  }>;
}

// WalletType is now imported from types/index.ts
// Re-export for backward compatibility
export { WalletType } from '../types';

export class WalletDataFactory {
  private static instance: WalletDataFactory;
  private seededAddresses: Map<string, string> = new Map();
  
  public static getInstance(): WalletDataFactory {
    if (!WalletDataFactory.instance) {
      WalletDataFactory.instance = new WalletDataFactory();
    }
    return WalletDataFactory.instance;
  }
  
  /**
   * Generate a valid Cardano address for testing
   */
  generateCardanoAddress(testnet = true): string {
    const prefix = testnet ? 'addr_test' : 'addr';
    const bech32Chars = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
    const randomSuffix = Array.from({ length: 98 }, () => 
      bech32Chars[Math.floor(Math.random() * bech32Chars.length)]
    ).join('');
    
    return `${prefix}1${randomSuffix}`;
  }
  
  /**
   * Generate a seeded address that remains consistent across test runs
   */
  getSeededAddress(seed: string, testnet = true): string {
    if (this.seededAddresses.has(seed)) {
      return this.seededAddresses.get(seed)!;
    }
    
    // Use seeded faker for consistent generation
    faker.seed(this.hashSeed(seed));
    const address = this.generateCardanoAddress(testnet);
    this.seededAddresses.set(seed, address);
    
    return address;
  }
  
  /**
   * Create comprehensive wallet test data
   */
  createWalletData(options: Partial<{
    address: string;
    walletType: WalletType;
    balanceAda: number;
    assetCount: number;
    utxoCount: number;
    hasStaking: boolean;
    seed: string;
  }> = {}): TestWalletData {
    const seed = options.seed || faker.string.uuid();
    faker.seed(this.hashSeed(seed));
    
    const balanceAda = options.balanceAda || faker.number.float({ min: 1, max: 1000, fractionDigits: 6 });
    const balanceLovelace = Math.floor(balanceAda * 1_000_000).toString();
    
    return {
      address: options.address || this.getSeededAddress(seed),
      walletType: options.walletType || faker.helpers.arrayElement([WalletType.NAMI, WalletType.ETERNL, WalletType.LACE, WalletType.VESPR]),
      balance: {
        ada: balanceAda.toFixed(6),
        lovelace: balanceLovelace
      },
      assets: this.generateAssets(options.assetCount || faker.number.int({ min: 0, max: 5 })),
      utxos: this.generateUtxos(options.utxoCount || faker.number.int({ min: 1, max: 10 }), parseInt(balanceLovelace)),
      syncedBlockHeight: faker.number.int({ min: 8000000, max: 9000000 }),
      lastSynced: faker.date.recent({ days: 1 }),
      stakingInfo: {
        stakeAddress: this.generateStakeAddress(),
        rewards: faker.number.int({ min: 0, max: 100000 }).toString(),
        isActive: options.hasStaking ?? faker.datatype.boolean({ probability: 0.7 })
      }
    };
  }
  
  /**
   * Generate test assets (native tokens/NFTs)
   */
  generateAssets(count: number): TestAsset[] {
    return Array.from({ length: count }, () => ({
      policyId: faker.string.hexadecimal({ length: 56, prefix: '' }),
      assetName: faker.string.hexadecimal({ length: 8, prefix: '' }),
      quantity: faker.number.int({ min: 1, max: 1000000 }).toString(),
      metadata: faker.datatype.boolean({ probability: 0.6 }) ? {
        name: faker.commerce.productName(),
        description: faker.lorem.sentence(),
        image: faker.image.url()
      } : undefined
    }));
  }
  
  /**
   * Generate UTXOs that sum to the specified balance
   */
  generateUtxos(count: number, totalLovelace: number): TestUtxo[] {
    const utxos: TestUtxo[] = [];
    let remainingBalance = totalLovelace;
    
    for (let i = 0; i < count; i++) {
      const isLast = i === count - 1;
      const amount = isLast ? remainingBalance : faker.number.int({ 
        min: Math.floor(totalLovelace * 0.1), 
        max: Math.floor(remainingBalance * 0.8) 
      });
      
      utxos.push({
        txHash: faker.string.hexadecimal({ length: 64, prefix: '' }),
        outputIndex: faker.number.int({ min: 0, max: 10 }),
        amount: [{ unit: 'lovelace', quantity: amount.toString() }]
      });
      
      remainingBalance -= amount;
      if (remainingBalance <= 0) break;
    }
    
    return utxos;
  }
  
  /**
   * Generate a stake address
   */
  generateStakeAddress(testnet = true): string {
    const prefix = testnet ? 'stake_test' : 'stake';
    const bech32Chars = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
    const randomSuffix = Array.from({ length: 50 }, () => 
      bech32Chars[Math.floor(Math.random() * bech32Chars.length)]
    ).join('');
    
    return `${prefix}1${randomSuffix}`;
  }
  
  /**
   * Generate JWT token for testing
   */
  generateJWTToken(walletAddress: string, walletType: WalletType): string {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({
      walletAddress,
      walletType,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
    }));
    const signature = 'test-signature-' + faker.string.alphanumeric(20);
    
    return `${header}.${payload}.${signature}`;
  }
  
  /**
   * Create error response templates
   */
  createErrorResponse(type: ErrorType, customMessage?: string) {
    const errorTemplates = {
      [ErrorType.WALLET_NOT_FOUND]: {
        success: false,
        error: customMessage || 'Wallet not found or not connected',
        code: 'WALLET_NOT_FOUND'
      },
      [ErrorType.INVALID_SIGNATURE]: {
        success: false,
        error: customMessage || 'Invalid wallet signature provided',
        code: 'INVALID_SIGNATURE'
      },
      [ErrorType.NETWORK_ERROR]: {
        success: false,
        error: customMessage || 'Network request failed - please check connection',
        code: 'NETWORK_ERROR'
      },
      [ErrorType.SERVER_ERROR]: {
        success: false,
        error: customMessage || 'Internal server error occurred',
        code: 'SERVER_ERROR'
      },
      [ErrorType.VALIDATION_ERROR]: {
        success: false,
        error: customMessage || 'Request validation failed',
        code: 'VALIDATION_ERROR'
      }
    };
    
    return errorTemplates[type];
  }
  
  /**
   * Create success response template
   */
  createSuccessResponse<T>(data: T, message?: string) {
    return {
      success: true,
      data,
      message: message || 'Operation completed successfully'
    };
  }
  
  /**
   * Generate CIP-30 compliant wallet mock
   */
  generateCIP30WalletMock(walletType: WalletType, walletData: TestWalletData) {
    return {
      name: this.getWalletDisplayName(walletType),
      icon: this.getWalletIcon(walletType),
      version: '1.0.0',
      
      isEnabled: () => Promise.resolve(true),
      
      enable: () => Promise.resolve({
        getNetworkId: () => Promise.resolve(0), // testnet
        getUtxos: () => Promise.resolve(walletData.utxos.map(utxo => utxo.txHash)),
        getBalance: () => Promise.resolve(`0x${parseInt(walletData.balance.lovelace).toString(16)}`),
        getUsedAddresses: () => Promise.resolve([walletData.address]),
        getUnusedAddresses: () => Promise.resolve([]),
        getChangeAddress: () => Promise.resolve(walletData.address),
        getRewardAddresses: () => Promise.resolve([walletData.stakingInfo.stakeAddress]),
        signTx: () => Promise.resolve(faker.string.hexadecimal({ length: 200, prefix: '' })),
        signData: () => Promise.resolve({
          signature: faker.string.hexadecimal({ length: 128, prefix: '' }),
          key: faker.string.hexadecimal({ length: 64, prefix: '' })
        }),
        submitTx: () => Promise.resolve(faker.string.hexadecimal({ length: 64, prefix: '' }))
      })
    };
  }
  
  private hashSeed(seed: string): number {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
  
  private getWalletDisplayName(walletType: WalletType): string {
    const names = {
      [WalletType.NAMI]: 'Nami',
      [WalletType.ETERNL]: 'Eternl',
      [WalletType.LACE]: 'Lace Wallet',
      [WalletType.VESPR]: 'Vespr Wallet',
      [WalletType.GEROWALLET]: 'GeroWallet',
      [WalletType.NUFI]: 'NuFi',
      [WalletType.TYPHON]: 'Typhon Wallet'
    };
    return names[walletType] || 'Unknown Wallet';
  }
  
  private getWalletIcon(walletType: WalletType): string {
    // Return base64 encoded SVG icons for each wallet type
    return `data:image/svg+xml;base64,${btoa(`<svg><!-- ${walletType} icon --></svg>`)}`;
  }
}

// Export singleton instance
export const walletDataFactory = WalletDataFactory.getInstance();

// Predefined test scenarios
export const testScenarios = {
  emptyWallet: () => walletDataFactory.createWalletData({
    balanceAda: 0,
    assetCount: 0,
    utxoCount: 1,
    hasStaking: false,
    seed: 'empty-wallet'
  }),
  
  richWallet: () => walletDataFactory.createWalletData({
    balanceAda: 10000,
    assetCount: 10,
    utxoCount: 20,
    hasStaking: true,
    seed: 'rich-wallet'
  }),
  
  basicWallet: () => walletDataFactory.createWalletData({
    balanceAda: 100,
    assetCount: 2,
    utxoCount: 5,
    hasStaking: true,
    seed: 'basic-wallet'
  }),
  
  nftCollector: () => walletDataFactory.createWalletData({
    balanceAda: 500,
    assetCount: 50,
    utxoCount: 15,
    hasStaking: true,
    seed: 'nft-collector'
  })
};
