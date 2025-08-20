/**
 * Wallet and Blockchain Types
 * 
 * Type definitions for wallet data synchronization and blockchain operations
 */

export type CardanoAsset = {
  unit: string;
  quantity: string;
  policyId: string;
  assetName: string;
  fingerprint: string;
};

export type CardanoUTXO = {
  txHash: string;
  outputIndex: number;
  amount: Array<{
    unit: string;
    quantity: string;
  }>;
  block: string;
  dataHash?: string;
};

export type WalletBalance = {
  lovelace: string;
  assets: CardanoAsset[];
};

export type WalletData = {
  address: string;
  balance: WalletBalance;
  utxos: CardanoUTXO[];
  lastSyncedAt: Date | null;
  syncedBlockHeight: number;
};

export type SyncOptions = {
  forceSync?: boolean;
  includeAssets?: boolean;
  maxRetries?: number;
};

export type BlockfrostResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
};

/**
 * Sync API Response
 * Returned when queuing a wallet sync job
 */
export type SyncJobResponse = {
  success: boolean;
  jobId?: string;
  status?: string;
  message?: string;
  error?: string;
  cachedData?: WalletData;
};

/**
 * Sync Job Status
 * Returned when checking job status
 */
export type SyncJobStatus = {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  retryCount?: number;
};