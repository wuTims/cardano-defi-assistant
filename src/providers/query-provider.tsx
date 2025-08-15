'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '@/lib/query/query-client';

interface QueryProviderProps {
  children: React.ReactNode;
}

/**
 * Query Provider - Wraps the application with TanStack Query
 * 
 * Provides:
 * - QueryClient instance to all child components
 * - DevTools for debugging in development mode
 * - Centralized query configuration
 */
export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools 
          initialIsOpen={false}
        />
      )}
    </QueryClientProvider>
  );
}