/**
 * Logger Tests
 */

import { logger, Logger } from '../logger';

describe('Logger', () => {
  let consoleSpy: {
    log: jest.SpyInstance;
    warn: jest.SpyInstance;
    error: jest.SpyInstance;
  };

  beforeEach(() => {
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation(),
    };
  });

  afterEach(() => {
    consoleSpy.log.mockRestore();
    consoleSpy.warn.mockRestore();
    consoleSpy.error.mockRestore();
  });

  describe('Singleton Pattern', () => {
    test('should return the same instance when called multiple times', () => {
      const instance1 = Logger.getInstance();
      const instance2 = Logger.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBe(logger);
    });
  });

  describe('Info Logging', () => {
    test('should log info message with correct format', () => {
      const message = 'Test info message';
      logger.info(message);

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const logCall = consoleSpy.log.mock.calls[0][0];
      
      expect(logCall).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[INFO\] Test info message$/);
    });

    test('should handle empty info message', () => {
      logger.info('');

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const logCall = consoleSpy.log.mock.calls[0][0];
      
      expect(logCall).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[INFO\] $/);
    });
  });

  describe('Warn Logging', () => {
    test('should log warning message with correct format', () => {
      const message = 'Test warning message';
      logger.warn(message);

      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      const logCall = consoleSpy.warn.mock.calls[0][0];
      
      expect(logCall).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[WARN\] Test warning message$/);
    });

    test('should handle empty warning message', () => {
      logger.warn('');

      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      const logCall = consoleSpy.warn.mock.calls[0][0];
      
      expect(logCall).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[WARN\] $/);
    });
  });

  describe('Error Logging', () => {
    test('should log error message with correct format', () => {
      const message = 'Test error message';
      logger.error(message);

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      const logCall = consoleSpy.error.mock.calls[0][0];
      
      expect(logCall).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[ERROR\] Test error message$/);
    });

    test('should log error message with Error object details', () => {
      const message = 'Test error message';
      const error = new Error('Detailed error information');
      logger.error(message, error);

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      const logCall = consoleSpy.error.mock.calls[0][0];
      
      expect(logCall).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[ERROR\] Test error message - Detailed error information$/);
    });

    test('should handle non-Error objects gracefully', () => {
      const message = 'Test error message';
      const errorObject = { code: 'CUSTOM_ERROR', details: 'Some details' };
      logger.error(message, errorObject);

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      const logCall = consoleSpy.error.mock.calls[0][0];
      
      expect(logCall).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[ERROR\] Test error message$/);
    });

    test('should handle null error gracefully', () => {
      const message = 'Test error message';
      logger.error(message, null);

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      const logCall = consoleSpy.error.mock.calls[0][0];
      
      expect(logCall).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[ERROR\] Test error message$/);
    });

    test('should handle undefined error gracefully', () => {
      const message = 'Test error message';
      logger.error(message, undefined);

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      const logCall = consoleSpy.error.mock.calls[0][0];
      
      expect(logCall).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[ERROR\] Test error message$/);
    });
  });

  describe('Message Formatting', () => {
    test('should format timestamp correctly', () => {
      const beforeTime = new Date().toISOString();
      logger.info('timestamp test');
      const afterTime = new Date().toISOString();

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const logCall = consoleSpy.log.mock.calls[0][0];
      
      const timestampMatch = logCall.match(/^\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\]/);
      expect(timestampMatch).not.toBeNull();
      
      const timestamp = timestampMatch![1];
      expect(timestamp >= beforeTime).toBe(true);
      expect(timestamp <= afterTime).toBe(true);
    });

    test('should include level in formatted message', () => {
      logger.info('info test');
      logger.warn('warn test');
      logger.error('error test');

      const infoCall = consoleSpy.log.mock.calls[0][0];
      const warnCall = consoleSpy.warn.mock.calls[0][0];
      const errorCall = consoleSpy.error.mock.calls[0][0];

      expect(infoCall).toContain('[INFO]');
      expect(warnCall).toContain('[WARN]');
      expect(errorCall).toContain('[ERROR]');
    });

    test('should handle special characters in messages', () => {
      const specialMessage = 'Message with "quotes", [brackets], {braces}, and 日本語';
      logger.info(specialMessage);

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const logCall = consoleSpy.log.mock.calls[0][0];
      
      expect(logCall).toContain(specialMessage);
    });

    test('should handle very long messages', () => {
      const longMessage = 'A'.repeat(1000);
      logger.info(longMessage);

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const logCall = consoleSpy.log.mock.calls[0][0];
      
      expect(logCall).toContain(longMessage);
      expect(logCall.length).toBeGreaterThan(1000);
    });
  });

  describe('Thread Safety', () => {
    test('should handle rapid consecutive calls', () => {
      const messages = Array.from({ length: 10 }, (_, i) => `Message ${i}`);
      
      messages.forEach(message => {
        logger.info(message);
      });

      expect(consoleSpy.log).toHaveBeenCalledTimes(10);
      messages.forEach((message, index) => {
        const logCall = consoleSpy.log.mock.calls[index][0];
        expect(logCall).toContain(message);
      });
    });
  });

  describe('Performance', () => {
    test('should log messages efficiently', () => {
      const startTime = performance.now();
      
      for (let i = 0; i < 100; i++) {
        logger.info(`Performance test message ${i}`);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete 100 log calls in reasonable time (less than 100ms)
      expect(duration).toBeLessThan(100);
      expect(consoleSpy.log).toHaveBeenCalledTimes(100);
    });
  });

  describe('Error Edge Cases', () => {
    test('should handle Error with circular references', () => {
      const error: any = new Error('Circular error');
      error.self = error; // Create circular reference
      
      expect(() => {
        logger.error('Circular test', error);
      }).not.toThrow();
      
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    });

    test('should handle Error with complex nested properties', () => {
      const error = new Error('Complex error');
      (error as any).details = {
        nested: {
          deep: {
            value: 'test',
            number: 42,
            array: [1, 2, 3]
          }
        }
      };
      
      expect(() => {
        logger.error('Complex test', error);
      }).not.toThrow();
      
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      const logCall = consoleSpy.error.mock.calls[0][0];
      expect(logCall).toContain('Complex error');
    });
  });
});