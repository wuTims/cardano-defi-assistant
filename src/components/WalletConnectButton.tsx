"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Wallet, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { WalletType } from '@/core/types/auth';

const WALLET_OPTIONS: Array<{ name: string; type: WalletType; color: string }> = [
  { name: 'Nami', type: WalletType.NAMI, color: 'text-blue-400' },
  { name: 'Eternl', type: WalletType.ETERNL, color: 'text-purple-400' },
  { name: 'Flint', type: WalletType.FLINT, color: 'text-orange-400' },
  { name: 'Yoroi', type: WalletType.YOROI, color: 'text-green-400' },
  { name: 'Gero', type: WalletType.GEROWALLET, color: 'text-pink-400' },
];

export const WalletConnectButton: React.FC = () => {
  const { 
    isAuthenticated, 
    user,
    connectionState,
    error,
    connectWallet, 
    disconnect, 
    clearError 
  } = useAuth();
  
  const walletType = user?.walletType;
  const walletAddress = user?.walletAddress;

  const handleWalletConnect = async (selectedWalletType: WalletType) => {
    clearError();
    await connectWallet(selectedWalletType);
  };

  const handleDisconnect = () => {
    disconnect();
  };

  if (isAuthenticated && walletAddress) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            data-testid="wallet-connected-button"
            className="bg-transparent border-2 border-green-500/50 text-green-400 hover:bg-green-500/10 transition-all duration-300"
          >
            <CheckCircle className="mr-2 w-4 h-4" />
            {walletType?.charAt(0).toUpperCase()}{walletType?.slice(1)} Connected
          </Button>
        </PopoverTrigger>
        <PopoverContent data-testid="wallet-connected-popover" className="w-80 bg-gray-900 border-gray-800 text-white">
          <div className="space-y-4">
            <div data-testid="wallet-connected-header" className="flex items-center justify-between">
              <h4 className="font-medium text-green-400">Wallet Connected</h4>
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            
            <div data-testid="wallet-type-section" className="space-y-2">
              <div className="text-sm text-gray-400">Wallet Type</div>
              <div data-testid="wallet-type-display" className="font-medium capitalize">{walletType}</div>
            </div>
            
            <div data-testid="wallet-address-section" className="space-y-2">
              <div className="text-sm text-gray-400">Address</div>
              <div data-testid="wallet-address-display" className="font-mono text-xs break-all bg-gray-800 p-2 rounded">
                {walletAddress.slice(0, 20)}...{walletAddress.slice(-10)}
              </div>
            </div>
            
            <Button 
              variant="outline" 
              data-testid="wallet-disconnect-button"
              className="w-full bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
              onClick={handleDisconnect}
            >
              Disconnect Wallet
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          data-testid={`wallet-connect-trigger-${connectionState}`}
          className={`bg-transparent border-2 transition-all duration-300 ${
            connectionState === 'error' 
              ? 'border-red-500/50 text-red-400 hover:bg-red-500/10' 
              : 'border-white/30 text-white hover:bg-white/10'
          }`}
          disabled={connectionState === 'connecting'}
        >
          {connectionState === 'connecting' ? (
            <>
              <Loader2 className="mr-2 w-4 h-4 animate-spin" />
              Connecting...
            </>
          ) : connectionState === 'error' ? (
            <>
              <AlertCircle className="mr-2 w-4 h-4" />
              Connection Failed
            </>
          ) : (
            <>
              <Wallet className="mr-2 w-4 h-4" />
              Connect Wallet
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent data-testid="wallet-selection-popover" className="w-80 bg-gray-900 border-gray-800 text-white">
        <div className="space-y-4">
          <div data-testid="wallet-selection-header" className="flex items-center justify-between">
            <h4 className="font-medium leading-none">Choose Your Wallet</h4>
            {error && (
              <Button
                variant="ghost"
                size="sm"
                data-testid="wallet-error-dismiss-button"
                onClick={clearError}
                className="text-gray-400 hover:text-white h-auto p-1"
              >
                ×
              </Button>
            )}
          </div>
          
          {error && (
            <div data-testid="wallet-connection-error" className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p data-testid="wallet-error-message" className="text-sm text-red-300">{error}</p>
              </div>
            </div>
          )}
          
          <div data-testid="wallet-options-grid" className="grid grid-cols-2 gap-3">
            {WALLET_OPTIONS.map((wallet) => (
              <Button 
                key={wallet.type}
                variant="outline" 
                data-testid={`wallet-option-${wallet.type}`}
                className="flex items-center justify-center space-x-2 bg-gray-800 border-gray-700 text-white hover:bg-gray-700 h-12 transition-colors"
                onClick={() => handleWalletConnect(wallet.type)}
                disabled={connectionState === 'connecting'}
              >
                <div className={`w-6 h-6 rounded-full bg-current/20 flex items-center justify-center ${wallet.color}`}>
                  <span className="text-xs font-bold">{wallet.name[0]}</span>
                </div>
                <span>{wallet.name}</span>
              </Button>
            ))}
          </div>
          
          <div data-testid="wallet-instructions" className="text-xs text-gray-400 text-center">
            Make sure your wallet extension is installed and unlocked
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};