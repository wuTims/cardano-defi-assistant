import fs from 'fs';
import path from 'path';

type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export class Logger {
  private static instance: Logger;
  private logFilePath: string;

  private constructor() {
    const logDir = path.resolve(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    this.logFilePath = path.join(logDir, `app-${new Date().toISOString().split('T')[0]}.log`);
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] ${message}\n`;
  }

  private writeToFile(formattedMessage: string): void {
    try {
      fs.appendFileSync(this.logFilePath, formattedMessage);
    } catch (error) {
      console.error('Failed to write to log file', error);
    }
  }

  public info(message: string): void {
    const formattedMessage = this.formatMessage('INFO', message);
    console.log(formattedMessage.trim());
    this.writeToFile(formattedMessage);
  }

  public warn(message: string): void {
    const formattedMessage = this.formatMessage('WARN', message);
    console.warn(formattedMessage.trim());
    this.writeToFile(formattedMessage);
  }

  public error(message: string, error?: unknown): void {
    const errorDetails = error instanceof Error ? ` - ${error.message}` : '';
    const formattedMessage = this.formatMessage('ERROR', `${message}${errorDetails}`);
    console.error(formattedMessage.trim());
    this.writeToFile(formattedMessage);
  }
}