'use client';

import React, { useState } from 'react';
import { useTransactionList } from '@/hooks/queries/use-transactions-query';
import { TransactionAction, Protocol } from '@/types/transaction';
import { Filter, X, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function TransactionFilters() {
  const { filters, setFilters, clearFilters } = useTransactionList();
  const [isExpanded, setIsExpanded] = useState(false);
  
  const [selectedAction, setSelectedAction] = useState<TransactionAction | ''>('');
  const [selectedProtocol, setSelectedProtocol] = useState<Protocol | ''>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  
  const hasActiveFilters = Object.keys(filters).length > 0;
  
  const handleApplyFilters = () => {
    const filters: any = {};
    
    if (selectedAction) filters.action = selectedAction;
    if (selectedProtocol) filters.protocol = selectedProtocol;
    if (fromDate) filters.fromDate = new Date(fromDate);
    if (toDate) filters.toDate = new Date(toDate);
    
    setFilters(filters);
    setIsExpanded(false);
  };
  
  const handleClearFilters = () => {
    setSelectedAction('');
    setSelectedProtocol('');
    setFromDate('');
    setToDate('');
    clearFilters();
  };
  
  const actionOptions = [
    { value: '', label: 'All Actions' },
    { value: TransactionAction.SEND, label: 'Send' },
    { value: TransactionAction.RECEIVE, label: 'Receive' },
    { value: TransactionAction.SWAP, label: 'Swap' },
    { value: TransactionAction.SUPPLY, label: 'Supply' },
    { value: TransactionAction.WITHDRAW, label: 'Withdraw' },
    { value: TransactionAction.STAKE, label: 'Stake' },
    { value: TransactionAction.PROVIDE_LIQUIDITY, label: 'Provide Liquidity' },
  ];
  
  const protocolOptions = [
    { value: '', label: 'All Protocols' },
    { value: Protocol.MINSWAP, label: 'Minswap' },
    { value: Protocol.LIQWID, label: 'Liqwid' },
    { value: Protocol.SUNDAESWAP, label: 'SundaeSwap' },
    { value: Protocol.WINGRIDERS, label: 'WingRiders' },
    { value: Protocol.INDIGO, label: 'Indigo' },
  ];
  
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
        >
          <Filter className="w-4 h-4" />
          <span>Filters</span>
          {hasActiveFilters && (
            <span className="ml-2 px-2 py-0.5 bg-primary text-primary-foreground rounded-full text-xs">
              {Object.keys(filters).length}
            </span>
          )}
        </button>
        
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
            Clear filters
          </button>
        )}
      </div>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 bg-secondary/50 rounded-lg space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Action Type
                  </label>
                  <select
                    value={selectedAction}
                    onChange={(e) => setSelectedAction(e.target.value as TransactionAction | '')}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {actionOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Protocol
                  </label>
                  <select
                    value={selectedProtocol}
                    onChange={(e) => setSelectedProtocol(e.target.value as Protocol | '')}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {protocolOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">
                    From Date
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="w-full px-3 py-2 pl-10 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">
                    To Date
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="w-full px-3 py-2 pl-10 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setIsExpanded(false)}
                  className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyFilters}
                  className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}