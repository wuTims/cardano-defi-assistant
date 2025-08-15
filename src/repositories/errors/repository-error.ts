/**
 * Repository Error Handling
 * 
 * Purpose: Simple, focused error handling for repository operations
 * Principle: Keep it simple - we have logging for detailed debugging
 */

/**
 * Base repository error with operation context
 */
export class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'RepositoryError';
    Object.setPrototypeOf(this, RepositoryError.prototype);
  }
}

/**
 * Error for when requested data is not found
 */
export class NotFoundError extends RepositoryError {
  constructor(
    entityType: string,
    identifier: string | Record<string, unknown>
  ) {
    const id = typeof identifier === 'string' 
      ? identifier 
      : JSON.stringify(identifier);
    
    super(
      `${entityType} not found: ${id}`,
      `find${entityType}`
    );
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Convert Supabase errors to repository errors with logging
 */
export function handleSupabaseError(
  error: unknown,
  operation: string,
  logger: { error: (...args: unknown[]) => void } = console
): never {
  // Log the full error for debugging
  logger.error(`[Repository] ${operation} failed:`, error);

  // Extract message from error
  let message = 'Database operation failed';
  if (error instanceof Error) {
    message = error.message;
  } else if (error && typeof error === 'object' && 'message' in error) {
    message = String((error as { message: unknown }).message);
  }

  throw new RepositoryError(message, operation, error);
}

/**
 * Type guard for repository errors
 */
export function isRepositoryError(error: unknown): error is RepositoryError {
  return error instanceof RepositoryError;
}

/**
 * Type guard for not found errors
 */
export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}