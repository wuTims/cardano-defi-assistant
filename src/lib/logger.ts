/**
 * Client-safe Logger
 * 
 * Provides consistent logging across client and server with
 * file logging only on server side.
 */

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export class Logger {
  private static instance: Logger;

  private constructor() {}

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] ${message}`;
  }

  public debug(message: string): void {
    if (process.env.NODE_ENV === 'development') {
      const formattedMessage = this.formatMessage('DEBUG', message);
      console.log(formattedMessage);
    }
  }

  public info(message: string): void {
    const formattedMessage = this.formatMessage('INFO', message);
    console.log(formattedMessage);
  }

  public warn(message: string): void {
    const formattedMessage = this.formatMessage('WARN', message);
    console.warn(formattedMessage);
  }

  public error(message: string, error?: unknown): void {
    const errorDetails = error instanceof Error ? ` - ${error.message}` : '';
    const formattedMessage = this.formatMessage('ERROR', `${message}${errorDetails}`);
    console.error(formattedMessage);
  }
}

// Export singleton instance
export const logger = Logger.getInstance();