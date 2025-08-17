'use client';

import React, { useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTransactionList } from '@/hooks/queries/use-transactions-query';
import { TransactionCard } from './TransactionCard';
import { Loader2, FileX } from 'lucide-react';

export function TransactionList() {
  const { 
    transactions, 
    isLoading, 
    hasMore, 
    loadMore,
    isLoadingMore 
  } = useTransactionList();
  console.log(transactions);
  console.log(isLoading);
  console.log(hasMore);
  console.log(isLoadingMore);
  
  const parentRef = useRef<HTMLDivElement>(null);

  // Setup virtualizer
  const virtualizer = useVirtualizer({
    count: transactions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100, // Estimated row height
    overscan: 5, // Number of items to render outside of viewport
  });

  // Handle infinite scroll
  useEffect(() => {
    const items = virtualizer.getVirtualItems();
    const lastItem = items[items.length - 1];
    console.log(lastItem);
    console.log(items);
    
    if (!lastItem) return;
    
    // Load more when reaching the end
    if (
      lastItem.index >= transactions.length - 1 &&
      hasMore &&
      !isLoadingMore
    ) {
      loadMore();
    }
  }, [
    hasMore,
    loadMore,
    transactions.length,
    isLoadingMore,
    virtualizer,
  ]);
  
  // Loading state
  if (isLoading && transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground mt-4">Loading transactions...</p>
      </div>
    );
  }
  
  // Empty state
  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <FileX className="w-12 h-12 text-muted-foreground" />
        <h3 className="text-lg font-semibold mt-4">No transactions found</h3>
        <p className="text-muted-foreground mt-2">
          Your transaction history will appear here after syncing
        </p>
      </div>
    );
  }

  // Virtual scroll list
  return (
    <div 
      ref={parentRef}
      className="flex-1 overflow-auto"
      style={{ height: '100%', position: 'relative' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            data-index={virtualItem.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <TransactionCard 
              transaction={transactions[virtualItem.index]} 
            />
          </div>
        ))}
        
        {isLoadingMore && (
          <div 
            className="flex justify-center py-4"
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
            }}
          >
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}