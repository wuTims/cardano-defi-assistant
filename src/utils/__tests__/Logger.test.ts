import fs from 'fs';
import path from 'path';
import { Logger } from '../Logger';

describe('Logger', () => {
  let logger: Logger;
  const logDir = path.resolve(process.cwd(), 'logs');
  
  beforeEach(() => {
    // Use jest.spyOn to mock console methods
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    
    // Clear log files before each test
    if (fs.existsSync(logDir)) {
      const files = fs.readdirSync(logDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(logDir, file));
      });
    }
    
    // Get singleton instance
    logger = Logger.getInstance();
  });

  afterEach(() => {
    // Restore console methods
    jest.restoreAllMocks();
  });

  it('should create a singleton instance', () => {
    const anotherLogger = Logger.getInstance();
    expect(anotherLogger).toBe(logger);
  });

  it('should log info messages', () => {
    const infoSpy = jest.spyOn(console, 'log');
    logger.info('Test info message');
    
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('[INFO]'));
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('Test info message'));
  });

  it('should log warning messages', () => {
    const warnSpy = jest.spyOn(console, 'warn');
    logger.warn('Test warning message');
    
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[WARN]'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Test warning message'));
  });

  it('should log error messages', () => {
    const errorSpy = jest.spyOn(console, 'error');
    const testError = new Error('Test error');
    logger.error('Something went wrong', testError);
    
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[ERROR]'));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Something went wrong'));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(testError.message));
  });

  it('should write log messages to file', () => {
    logger.info('File logging test');
    
    const logFiles = fs.readdirSync(logDir);
    expect(logFiles.length).toBe(1);
    
    const logContent = fs.readFileSync(path.join(logDir, logFiles[0]), 'utf-8');
    expect(logContent).toContain('[INFO]');
    expect(logContent).toContain('File logging test');
  });
});