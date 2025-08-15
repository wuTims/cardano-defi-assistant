/**
 * TransactionFilterBuilder
 * 
 * Builder pattern for constructing TransactionFilters with validation.
 * Provides a fluent API for filter construction while maintaining type safety.
 */

import { TransactionAction, Protocol, TransactionFilters } from '@/types/transaction';

export class TransactionFilterBuilder {
  private filters: Partial<TransactionFilters> = {};

  /**
   * Add action filter with validation
   */
  withAction(action: string | null): this {
    if (action && Object.values(TransactionAction).includes(action as TransactionAction)) {
      this.filters.action = action as TransactionAction;
    }
    return this;
  }

  /**
   * Add protocol filter with validation
   */
  withProtocol(protocol: string | null): this {
    if (protocol && Object.values(Protocol).includes(protocol as Protocol)) {
      this.filters.protocol = protocol as Protocol;
    }
    return this;
  }

  /**
   * Add token unit filter
   */
  withTokenUnit(tokenUnit: string | null): this {
    if (tokenUnit) {
      this.filters.tokenUnit = tokenUnit;
    }
    return this;
  }

  /**
   * Add date range filters
   */
  withDateRange(from: string | null, to: string | null): this {
    if (from) {
      const fromDate = new Date(from);
      if (!isNaN(fromDate.getTime())) {
        this.filters.fromDate = fromDate;
      }
    }
    
    if (to) {
      const toDate = new Date(to);
      if (!isNaN(toDate.getTime())) {
        this.filters.toDate = toDate;
      }
    }
    
    return this;
  }

  /**
   * Add minimum amount filter
   */
  withMinAmount(amount: string | null): this {
    if (amount) {
      try {
        this.filters.minAmount = BigInt(amount);
      } catch {
        // Invalid BigInt, skip
      }
    }
    return this;
  }

  /**
   * Build from URLSearchParams directly
   */
  static fromSearchParams(searchParams: URLSearchParams): TransactionFilters {
    return new TransactionFilterBuilder()
      .withAction(searchParams.get('action'))
      .withProtocol(searchParams.get('protocol'))
      .withTokenUnit(searchParams.get('tokenUnit'))
      .withDateRange(searchParams.get('fromDate'), searchParams.get('toDate'))
      .withMinAmount(searchParams.get('minAmount'))
      .build();
  }

  /**
   * Build the final immutable filter object
   */
  build(): TransactionFilters {
    return Object.freeze({ ...this.filters }) as TransactionFilters;
  }

  /**
   * Check if any filters are set
   */
  hasFilters(): boolean {
    return Object.keys(this.filters).length > 0;
  }

  /**
   * Get current filter count
   */
  getFilterCount(): number {
    return Object.keys(this.filters).length;
  }
}