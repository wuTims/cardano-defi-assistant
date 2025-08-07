import React, { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Wallet } from 'lucide-react';

const WALLET_OPTIONS = [
  { name: 'Nami', icon: '/icons/nami.svg' },
  { name: 'Eternl', icon: '/icons/eternl.svg' },
  { name: 'Flint', icon: '/icons/flint.svg' },
  { name: 'Yoroi', icon: '/icons/yoroi.svg' },
];

export const WalletConnectButton: React.FC = () => {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleWalletConnect = async (walletName: string) => {
    setIsConnecting(true);
    try {
      // Implement wallet connection logic
      console.log(`Connecting to ${walletName}`);
      // TODO: Implement actual wallet connection using Mesh SDK
    } catch (error) {
      console.error('Wallet connection failed', error);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          className="bg-transparent border-2 border-white/30 text-white hover:bg-white/10 transition-all duration-300"
        >
          <Wallet className="mr-2" /> Connect Wallet
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 bg-gray-900 border-gray-800 text-white">
        <div className="grid gap-4">
          <h4 className="font-medium leading-none mb-4">Choose Your Wallet</h4>
          <div className="grid grid-cols-2 gap-4">
            {WALLET_OPTIONS.map((wallet) => (
              <Button 
                key={wallet.name}
                variant="outline" 
                className="flex items-center justify-center space-x-2 bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
                onClick={() => handleWalletConnect(wallet.name)}
                disabled={isConnecting}
              >
                <Image src={wallet.icon} alt={wallet.name} width={24} height={24} className="w-6 h-6" />
                <span>{wallet.name}</span>
              </Button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};