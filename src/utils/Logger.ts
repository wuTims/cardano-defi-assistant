type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export class Logger {
  private static instance: Logger;
  private isClient: boolean;

  private constructor() {
    this.isClient = typeof window !== 'undefined';
  }

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

  private writeToFile(formattedMessage: string): void {
    // Only write to file on server side
    if (!this.isClient) {
      try {
        // Dynamic import to avoid bundling fs on client side
        import('fs').then(fs => {
          import('path').then(path => {
            const logDir = path.resolve(process.cwd(), 'logs');
            if (!fs.existsSync(logDir)) {
              fs.mkdirSync(logDir, { recursive: true });
            }
            const logFilePath = path.join(logDir, `app-${new Date().toISOString().split('T')[0]}.log`);
            fs.appendFileSync(logFilePath, formattedMessage + '\n');
          });
        }).catch(() => {
          // Silently fail if file system operations aren't available
        });
      } catch (error) {
        // Silently fail on client side
      }
    }
  }

  public info(message: string): void {
    const formattedMessage = this.formatMessage('INFO', message);
    console.log(formattedMessage);
    this.writeToFile(formattedMessage);
  }

  public warn(message: string): void {
    const formattedMessage = this.formatMessage('WARN', message);
    console.warn(formattedMessage);
    this.writeToFile(formattedMessage);
  }

  public error(message: string, error?: unknown): void {
    const errorDetails = error instanceof Error ? ` - ${error.message}` : '';
    const formattedMessage = this.formatMessage('ERROR', `${message}${errorDetails}`);
    console.error(formattedMessage);
    this.writeToFile(formattedMessage);
  }
}

// Export singleton instance
export const logger = Logger.getInstance();