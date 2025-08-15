/**
 * Base Repository
 * 
 * Purpose: Common functionality for all repositories
 * SOLID: Dependency injection, DRY principle
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { PostgrestError } from '@supabase/postgrest-js';
import { handleSupabaseError } from './errors/repository-error';

export abstract class BaseRepository {
  constructor(
    protected readonly supabase: SupabaseClient,
    protected readonly logger = console
  ) {}

  /**
   * Execute a database READ operation (select, rpc that returns data)
   * Use this for operations that naturally return a Promise with data
   * Accepts both Promises and Supabase query builders (which are thenable)
   */
  protected async executeReadOperation<T>(
    operation: string,
    queryFn: () => PromiseLike<{ data: T | null; error: PostgrestError | null }>
  ): Promise<T | null> {
    const { data, error } = await queryFn();
    
    if (error) {
      handleSupabaseError(error, operation, this.logger);
    }
    
    return data;
  }

  /**
   * Execute a database WRITE operation (insert, update, delete, upsert)
   * Automatically adds .select() to make the query builder return a Promise
   * Returns void by default since write operations often don't need to return data
   */
  protected async executeWriteOperation(
    operation: string,
    queryFn: () => any
  ): Promise<void> {
    const query = queryFn();
    const { error } = await query.select();
    
    if (error) {
      handleSupabaseError(error, operation, this.logger);
    }
  }

  /**
   * Execute a database WRITE operation that returns data
   * Use this when you need the inserted/updated/deleted records back
   */
  protected async executeWriteOperationWithReturn<T>(
    operation: string,
    queryFn: () => any
  ): Promise<T | null> {
    const query = queryFn();
    const { data, error } = await query.select();
    
    if (error) {
      handleSupabaseError(error, operation, this.logger);
    }
    
    return data;
  }

  /**
   * Execute a database operation that must return data
   * @deprecated Use executeRequiredReadOperation instead
   */
  protected async executeOperation<T>(
    operation: string,
    queryFn: () => PromiseLike<{ data: T | null; error: PostgrestError | null }>
  ): Promise<T | null> {
    return this.executeReadOperation(operation, queryFn);
  }

  /**
   * Execute a database READ operation that must return data
   */
  protected async executeRequiredReadOperation<T>(
    operation: string,
    queryFn: () => PromiseLike<{ data: T | null; error: PostgrestError | null }>
  ): Promise<T> {
    const data = await this.executeReadOperation(operation, queryFn);
    
    if (!data) {
      handleSupabaseError(
        new Error('No data returned from operation'),
        operation,
        this.logger
      );
    }
    
    return data;
  }

  /**
   * @deprecated Use executeRequiredReadOperation instead
   */
  protected async executeRequiredOperation<T>(
    operation: string,
    queryFn: () => PromiseLike<{ data: T | null; error: PostgrestError | null }>
  ): Promise<T> {
    return this.executeRequiredReadOperation(operation, queryFn);
  }
}