/**
 * Centralized Error Handling System
 * 
 * Provides consistent error handling across the application with
 * specific error types for different domains.
 */

/**
 * Base error class for all application errors
 */
export abstract class BaseError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly timestamp: Date;
  public readonly context?: Record<string, any>;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date();
    this.context = context;

    // Maintains proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON for API responses
   */
  public toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp.toISOString(),
      ...(this.context && { context: this.context }),
    };
  }
}

/**
 * Authentication related errors
 */
export class AuthenticationError extends BaseError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'AUTH_ERROR', 401, true, context);
  }
}

/**
 * Authorization related errors
 */
export class AuthorizationError extends BaseError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'AUTHZ_ERROR', 403, true, context);
  }
}

/**
 * Validation errors
 */
export class ValidationError extends BaseError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 400, true, context);
  }
}

/**
 * Wallet connection errors
 */
export class WalletError extends BaseError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'WALLET_ERROR', 400, true, context);
  }
}

/**
 * Database errors
 */
export class DatabaseError extends BaseError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'DATABASE_ERROR', 500, true, context);
  }
}

/**
 * External API errors
 */
export class ExternalAPIError extends BaseError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'EXTERNAL_API_ERROR', 502, true, context);
  }
}

/**
 * Configuration errors
 */
export class ConfigurationError extends BaseError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'CONFIG_ERROR', 500, false, context);
  }
}

/**
 * Centralized error handler
 */
export class ErrorHandler {
  private static instance: ErrorHandler;

  private constructor() {}

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Handle an error and return appropriate response
   */
  public handle(error: Error | BaseError): {
    statusCode: number;
    body: {
      error: string;
      message: string;
      code?: string;
      context?: Record<string, any>;
    };
  } {
    // If it's our custom error, use its properties
    if (error instanceof BaseError) {
      return {
        statusCode: error.statusCode,
        body: {
          error: error.name,
          message: error.message,
          code: error.code,
          ...(error.context && { context: error.context }),
        },
      };
    }

    // For unknown errors, return generic 500
    return {
      statusCode: 500,
      body: {
        error: 'InternalServerError',
        message: 'An unexpected error occurred',
      },
    };
  }

  /**
   * Check if error is operational (expected) or programming error
   */
  public isOperationalError(error: Error): boolean {
    if (error instanceof BaseError) {
      return error.isOperational;
    }
    return false;
  }

  /**
   * Format error for logging
   */
  public formatForLogging(error: Error | BaseError): Record<string, any> {
    if (error instanceof BaseError) {
      return {
        name: error.name,
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        isOperational: error.isOperational,
        timestamp: error.timestamp,
        context: error.context,
        stack: error.stack,
      };
    }

    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    };
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();