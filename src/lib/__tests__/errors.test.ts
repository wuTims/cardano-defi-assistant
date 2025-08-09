/**
 * Error Handling System Tests
 */

import { 
  errorHandler, 
  ErrorHandler,
  BaseError,
  WalletError, 
  AuthenticationError, 
  AuthorizationError,
  ValidationError, 
  DatabaseError,
  ExternalAPIError,
  ConfigurationError
} from '../errors';

describe('Error Handling System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('BaseError Class', () => {
    class TestError extends BaseError {
      constructor(message: string) {
        super(message, 'TEST_ERROR', 400);
      }
    }

    test('should create BaseError with required properties', () => {
      const error = new TestError('Test error message');

      expect(error).toBeInstanceOf(BaseError);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Test error message');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
      expect(error.timestamp).toBeInstanceOf(Date);
      expect(error.name).toBe('TestError');
    });

    test('should include stack trace', () => {
      const error = new TestError('Test error');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('TestError');
    });

    test('should serialize to JSON correctly', () => {
      const context = { userId: 123, action: 'test' };
      const error = new TestError('Test error message');
      (error as any).context = context;
      const json = error.toJSON();

      expect(json).toEqual({
        name: 'TestError',
        message: 'Test error message',
        code: 'TEST_ERROR',
        statusCode: 400,
        timestamp: error.timestamp.toISOString(),
        context: context
      });
    });
  });

  describe('WalletError', () => {
    test('should create WalletError with correct properties', () => {
      const context = { walletType: 'nami' };
      const error = new WalletError('Wallet not found', context);

      expect(error).toBeInstanceOf(WalletError);
      expect(error).toBeInstanceOf(BaseError);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Wallet not found');
      expect(error.code).toBe('WALLET_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe('WalletError');
      expect(error.context).toEqual(context);
    });
  });

  describe('AuthenticationError', () => {
    test('should create AuthenticationError with correct properties', () => {
      const error = new AuthenticationError('Invalid token');

      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error).toBeInstanceOf(BaseError);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Invalid token');
      expect(error.code).toBe('AUTH_ERROR');
      expect(error.statusCode).toBe(401);
      expect(error.name).toBe('AuthenticationError');
    });
  });

  describe('AuthorizationError', () => {
    test('should create AuthorizationError with correct properties', () => {
      const error = new AuthorizationError('Access denied');

      expect(error).toBeInstanceOf(AuthorizationError);
      expect(error).toBeInstanceOf(BaseError);
      expect(error.message).toBe('Access denied');
      expect(error.code).toBe('AUTHZ_ERROR');
      expect(error.statusCode).toBe(403);
      expect(error.name).toBe('AuthorizationError');
    });
  });

  describe('ValidationError', () => {
    test('should create ValidationError with field information', () => {
      const context = { field: 'walletAddress', value: 'invalid' };
      const error = new ValidationError('Invalid wallet address', context);

      expect(error).toBeInstanceOf(ValidationError);
      expect(error).toBeInstanceOf(BaseError);
      expect(error.message).toBe('Invalid wallet address');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe('ValidationError');
      expect(error.context).toEqual(context);
    });
  });

  describe('DatabaseError', () => {
    test('should create DatabaseError with correct properties', () => {
      const error = new DatabaseError('Connection failed');

      expect(error).toBeInstanceOf(DatabaseError);
      expect(error).toBeInstanceOf(BaseError);
      expect(error.message).toBe('Connection failed');
      expect(error.code).toBe('DATABASE_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('DatabaseError');
    });
  });

  describe('ExternalAPIError', () => {
    test('should create ExternalAPIError with correct properties', () => {
      const error = new ExternalAPIError('Blockfrost API error');

      expect(error).toBeInstanceOf(ExternalAPIError);
      expect(error).toBeInstanceOf(BaseError);
      expect(error.message).toBe('Blockfrost API error');
      expect(error.code).toBe('EXTERNAL_API_ERROR');
      expect(error.statusCode).toBe(502);
      expect(error.name).toBe('ExternalAPIError');
    });
  });

  describe('ConfigurationError', () => {
    test('should create ConfigurationError as non-operational', () => {
      const error = new ConfigurationError('Missing JWT secret');

      expect(error).toBeInstanceOf(ConfigurationError);
      expect(error).toBeInstanceOf(BaseError);
      expect(error.message).toBe('Missing JWT secret');
      expect(error.code).toBe('CONFIG_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(false);
      expect(error.name).toBe('ConfigurationError');
    });
  });

  describe('ErrorHandler Singleton', () => {
    test('should return the same instance', () => {
      const handler1 = ErrorHandler.getInstance();
      const handler2 = ErrorHandler.getInstance();

      expect(handler1).toBe(handler2);
      expect(handler1).toBe(errorHandler);
    });
  });

  describe('Error Handler - handle method', () => {
    test('should handle WalletError correctly', () => {
      const context = { walletType: 'nami' };
      const walletError = new WalletError('Wallet connection failed', context);
      const result = errorHandler.handle(walletError);

      expect(result).toEqual({
        statusCode: 400,
        body: {
          error: 'WalletError',
          message: 'Wallet connection failed',
          code: 'WALLET_ERROR',
          context: context
        }
      });
    });

    test('should handle AuthenticationError correctly', () => {
      const authError = new AuthenticationError('Token expired');
      const result = errorHandler.handle(authError);

      expect(result).toEqual({
        statusCode: 401,
        body: {
          error: 'AuthenticationError',
          message: 'Token expired',
          code: 'AUTH_ERROR'
        }
      });
    });

    test('should handle ValidationError correctly', () => {
      const context = { field: 'address' };
      const validationError = new ValidationError('Invalid address format', context);
      const result = errorHandler.handle(validationError);

      expect(result).toEqual({
        statusCode: 400,
        body: {
          error: 'ValidationError',
          message: 'Invalid address format',
          code: 'VALIDATION_ERROR',
          context: context
        }
      });
    });

    test('should handle generic Error correctly', () => {
      const genericError = new Error('Something went wrong');
      const result = errorHandler.handle(genericError);

      expect(result).toEqual({
        statusCode: 500,
        body: {
          error: 'InternalServerError',
          message: 'An unexpected error occurred'
        }
      });
    });

    test('should include context when available', () => {
      const context = { userId: 123, action: 'sync' };
      const error = new DatabaseError('Query failed', context);
      const result = errorHandler.handle(error);

      expect(result.body).toHaveProperty('context', context);
    });

    test('should not include context when not available', () => {
      const error = new DatabaseError('Query failed');
      const result = errorHandler.handle(error);

      expect(result.body).not.toHaveProperty('context');
    });
  });

  describe('Error Handler - isOperationalError method', () => {
    test('should identify operational errors correctly', () => {
      const operationalError = new WalletError('Connection failed');
      const nonOperationalError = new ConfigurationError('Missing config');
      const genericError = new Error('Generic error');

      expect(errorHandler.isOperationalError(operationalError)).toBe(true);
      expect(errorHandler.isOperationalError(nonOperationalError)).toBe(false);
      expect(errorHandler.isOperationalError(genericError)).toBe(false);
    });
  });

  describe('Error Handler - formatForLogging method', () => {
    test('should format BaseError for logging', () => {
      const context = { userId: 123 };
      const error = new WalletError('Test error', context);
      const formatted = errorHandler.formatForLogging(error);

      expect(formatted).toEqual({
        name: 'WalletError',
        message: 'Test error',
        code: 'WALLET_ERROR',
        statusCode: 400,
        isOperational: true,
        timestamp: error.timestamp,
        context: context,
        stack: error.stack
      });
    });

    test('should format generic Error for logging', () => {
      const error = new Error('Generic error');
      const formatted = errorHandler.formatForLogging(error);

      expect(formatted).toEqual({
        name: 'Error',
        message: 'Generic error',
        stack: error.stack,
        timestamp: expect.any(String)
      });
      
      // Verify timestamp format
      expect(new Date(formatted.timestamp).toISOString()).toBe(formatted.timestamp);
    });
  });

  describe('Error Inheritance', () => {
    test('should maintain proper prototype chain', () => {
      const walletError = new WalletError('Test');
      const authError = new AuthenticationError('Test');
      const validationError = new ValidationError('Test');
      const dbError = new DatabaseError('Test');

      expect(walletError instanceof WalletError).toBe(true);
      expect(walletError instanceof BaseError).toBe(true);
      expect(walletError instanceof Error).toBe(true);

      expect(authError instanceof AuthenticationError).toBe(true);
      expect(authError instanceof BaseError).toBe(true);
      expect(authError instanceof Error).toBe(true);

      expect(validationError instanceof ValidationError).toBe(true);
      expect(validationError instanceof BaseError).toBe(true);
      expect(validationError instanceof Error).toBe(true);

      expect(dbError instanceof DatabaseError).toBe(true);
      expect(dbError instanceof BaseError).toBe(true);
      expect(dbError instanceof Error).toBe(true);
    });

    test('should work with instanceof checks', () => {
      const errors = [
        new WalletError('Test'),
        new AuthenticationError('Test'),
        new ValidationError('Test'),
        new DatabaseError('Test'),
        new ExternalAPIError('Test'),
        new ConfigurationError('Test')
      ];

      errors.forEach(error => {
        expect(error instanceof BaseError).toBe(true);
        expect(error instanceof Error).toBe(true);
      });
    });
  });

  describe('Context Handling', () => {
    test('should handle complex context objects', () => {
      const complexContext = {
        user: { id: 123, email: 'test@example.com' },
        transaction: { id: 'tx123', amount: 100 },
        metadata: { timestamp: new Date(), source: 'api' }
      };

      const error = new WalletError('Complex error', complexContext);
      const result = errorHandler.handle(error);

      expect(result.body.context).toEqual(complexContext);
    });

    test('should handle undefined context gracefully', () => {
      const error = new WalletError('No context');
      const result = errorHandler.handle(error);

      expect(result.body).not.toHaveProperty('context');
    });
  });
});