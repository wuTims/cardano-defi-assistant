"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  ArrowDownRight,
  Bitcoin,
  DollarSign,
  Wallet,
  Activity,
  ArrowUpDown,
  Plus,
  Minus
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface AssetBalance {
  id: string;
  symbol: string;
  name: string;
  balance: string;
  value: string;
  change24h: number;
  icon: React.ReactNode;
  price: string;
}

interface Transaction {
  id: string;
  type: 'inflow' | 'outflow';
  asset: string;
  amount: string;
  value: string;
  timestamp: string;
  status: 'completed' | 'pending';
  description: string;
}

interface CategoryData {
  id: string;
  title: string;
  items: Transaction[];
  totalValue: string;
  change: number;
}

const defaultAssets: AssetBalance[] = [
  {
    id: '1',
    symbol: 'BTC',
    name: 'Bitcoin',
    balance: '2.45821',
    value: '$89,234.50',
    change24h: 5.2,
    price: '$36,320.45',
    icon: <Bitcoin className="w-6 h-6 text-orange-500" />
  },
  {
    id: '2',
    symbol: 'ETH',
    name: 'Ethereum',
    balance: '15.8934',
    value: '$32,145.80',
    change24h: -2.1,
    price: '$2,023.45',
    icon: <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">Ξ</div>
  },
  {
    id: '3',
    symbol: 'USDC',
    name: 'USD Coin',
    balance: '8,450.00',
    value: '$8,450.00',
    change24h: 0.1,
    price: '$1.00',
    icon: <DollarSign className="w-6 h-6 text-green-500" />
  },
  {
    id: '4',
    symbol: 'SOL',
    name: 'Solana',
    balance: '125.67',
    value: '$12,567.89',
    change24h: 8.7,
    price: '$100.05',
    icon: <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold">S</div>
  }
];

const defaultTransactions: Transaction[] = [
  {
    id: '1',
    type: 'inflow',
    asset: 'BTC',
    amount: '+0.5234',
    value: '+$18,945.67',
    timestamp: '2024-01-15T10:30:00Z',
    status: 'completed',
    description: 'Received from Coinbase Pro'
  },
  {
    id: '2',
    type: 'outflow',
    asset: 'ETH',
    amount: '-2.1567',
    value: '-$4,367.89',
    timestamp: '2024-01-15T09:15:00Z',
    status: 'completed',
    description: 'Sent to DeFi Protocol'
  },
  {
    id: '3',
    type: 'inflow',
    asset: 'USDC',
    amount: '+1,250.00',
    value: '+$1,250.00',
    timestamp: '2024-01-14T16:45:00Z',
    status: 'completed',
    description: 'Bank transfer deposit'
  },
  {
    id: '4',
    type: 'outflow',
    asset: 'SOL',
    amount: '-25.00',
    value: '-$2,501.25',
    timestamp: '2024-01-14T14:20:00Z',
    status: 'pending',
    description: 'Staking rewards claim'
  },
  {
    id: '5',
    type: 'inflow',
    asset: 'BTC',
    amount: '+0.1234',
    value: '+$4,467.89',
    timestamp: '2024-01-13T11:30:00Z',
    status: 'completed',
    description: 'Mining rewards'
  }
];

const categoryData: CategoryData[] = [
  {
    id: 'trading',
    title: 'Trading Activity',
    items: defaultTransactions.slice(0, 3),
    totalValue: '$15,828.78',
    change: 12.5
  },
  {
    id: 'defi',
    title: 'DeFi Transactions',
    items: defaultTransactions.slice(1, 4),
    totalValue: '$3,116.14',
    change: -5.2
  },
  {
    id: 'staking',
    title: 'Staking & Rewards',
    items: defaultTransactions.slice(2, 5),
    totalValue: '$3,216.64',
    change: 8.9
  }
];

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  
  if (diffInHours < 1) return 'Just now';
  if (diffInHours < 24) return `${diffInHours}h ago`;
  if (diffInHours < 48) return 'Yesterday';
  return date.toLocaleDateString();
}

function AssetBalanceCard({ asset }: { asset: AssetBalance }) {
  const isPositive = asset.change24h >= 0;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className="group"
    >
      <Card className="bg-card/50 backdrop-blur-sm border-border/50 p-6 hover:bg-card/80 transition-all duration-300">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {asset.icon}
            <div>
              <h3 className="font-semibold text-foreground">{asset.symbol}</h3>
              <p className="text-sm text-muted-foreground">{asset.name}</p>
            </div>
          </div>
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
            isPositive 
              ? 'bg-green-500/10 text-green-400' 
              : 'bg-red-500/10 text-red-400'
          }`}>
            {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(asset.change24h)}%
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Balance</span>
            <span className="font-medium text-foreground">{asset.balance}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Value</span>
            <span className="font-semibold text-lg text-foreground">{asset.value}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Price</span>
            <span className="text-sm text-foreground">{asset.price}</span>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function TransactionItem({ transaction }: { transaction: Transaction }) {
  const isInflow = transaction.type === 'inflow';
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
          isInflow ? 'bg-green-500/10' : 'bg-red-500/10'
        }`}>
          {isInflow ? (
            <Plus className="w-5 h-5 text-green-400" />
          ) : (
            <Minus className="w-5 h-5 text-red-400" />
          )}
        </div>
        <div>
          <p className="font-medium text-foreground">{transaction.description}</p>
          <p className="text-sm text-muted-foreground">{formatTimestamp(transaction.timestamp)}</p>
        </div>
      </div>
      
      <div className="text-right">
        <p className={`font-semibold ${
          isInflow ? 'text-green-400' : 'text-red-400'
        }`}>
          {transaction.amount} {transaction.asset}
        </p>
        <p className={`text-sm ${
          isInflow ? 'text-green-400' : 'text-red-400'
        }`}>
          {transaction.value}
        </p>
        <div className="flex items-center gap-1 mt-1">
          <div className={`w-2 h-2 rounded-full ${
            transaction.status === 'completed' ? 'bg-green-400' : 'bg-yellow-400'
          }`} />
          <span className="text-xs text-muted-foreground capitalize">{transaction.status}</span>
        </div>
      </div>
    </motion.div>
  );
}

function CategoryAccordion({ categories }: { categories: CategoryData[] }) {
  return (
    <Accordion type="single" collapsible className="space-y-4">
      {categories.map((category, index) => (
        <motion.div
          key={category.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <AccordionItem value={category.id} className="border border-border/50 rounded-lg bg-card/30 backdrop-blur-sm">
            <AccordionTrigger className="px-6 py-4 hover:no-underline group">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  <Activity className="w-5 h-5 text-muted-foreground" />
                  <span className="font-semibold text-foreground">{category.title}</span>
                </div>
                <div className="flex items-center gap-4 mr-4">
                  <span className="font-semibold text-foreground">{category.totalValue}</span>
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                    category.change >= 0 
                      ? 'bg-green-500/10 text-green-400' 
                      : 'bg-red-500/10 text-red-400'
                  }`}>
                    {category.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {Math.abs(category.change)}%
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-4">
              <div className="space-y-3">
                {category.items.map((transaction) => (
                  <TransactionItem key={transaction.id} transaction={transaction} />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </motion.div>
      ))}
    </Accordion>
  );
}

export function CoinbaseDashboard() {
  // Mock portfolio data - to be replaced with real wallet data
  const totalPortfolioValue = '$142,398.19';
  const portfolioChange = 4.2;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto p-6 space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-3xl font-bold text-foreground">Portfolio</h1>
            <p className="text-muted-foreground">Track your crypto assets and transactions</p>
          </div>
          <div className="flex items-center gap-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <ArrowUpDown className="w-4 h-4" />
              Trade
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-4 py-2 bg-card border border-border hover:bg-muted/50 rounded-lg transition-colors"
            >
              <Wallet className="w-4 h-4" />
              Wallet
            </motion.button>
          </div>
        </motion.div>

        {/* Portfolio Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 border-border/50 p-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground mb-2">Total Portfolio Value</p>
                <h2 className="text-4xl font-bold text-foreground">{totalPortfolioValue}</h2>
                <div className={`flex items-center gap-2 mt-2 ${
                  portfolioChange >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {portfolioChange >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                  <span className="font-semibold">{Math.abs(portfolioChange)}% (24h)</span>
                </div>
              </div>
              <div className="w-32 h-32 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full opacity-20" />
            </div>
          </Card>
        </motion.div>

        {/* Asset Balance Cards */}
        <div>
          <motion.h2
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-bold text-foreground mb-6"
          >
            Your Assets
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {defaultAssets.map((asset, index) => (
              <motion.div
                key={asset.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
              >
                <AssetBalanceCard asset={asset} />
              </motion.div>
            ))}
          </div>
        </div>

        {/* Recent Transactions */}
        <div>
          <motion.h2
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="text-2xl font-bold text-foreground mb-6"
          >
            Recent Activity
          </motion.h2>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="bg-card/50 backdrop-blur-sm border-border/50 p-6">
              <div className="space-y-4">
                {defaultTransactions.slice(0, 5).map((transaction, index) => (
                  <motion.div
                    key={transaction.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.7 + index * 0.1 }}
                  >
                    <TransactionItem transaction={transaction} />
                  </motion.div>
                ))}
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Category Sections */}
        <div>
          <motion.h2
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 }}
            className="text-2xl font-bold text-foreground mb-6"
          >
            Activity Categories
          </motion.h2>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
          >
            <CategoryAccordion categories={categoryData} />
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default function CoinbaseDashboardDemo() {
  return (
    <div className="dark">
      <CoinbaseDashboard />
    </div>
  );
}