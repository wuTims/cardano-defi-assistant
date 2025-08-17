/**
 * Pino-based Logger
 * 
 * High-performance structured logging for both client and server.
 * Uses JSON format in production, pretty printing in development.
 */

import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';
const isBrowser = typeof window !== 'undefined';

const config: pino.LoggerOptions = {
  level: process.env.PINO_LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  
  // Browser configuration
  ...(isBrowser && {
    browser: {
      asObject: true,
    },
  }),

  // Server configuration  
  ...(!isBrowser && isDevelopment && {
    // Pretty printing for development only
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        ignore: 'pid,hostname',
        translateTime: 'yyyy-mm-dd HH:MM:ss'
      },
    },
  }),

  // Base context
  base: {
    env: process.env.NODE_ENV,
  },
};

// Export Pino logger directly - this is the standard approach
export const logger = pino(config);