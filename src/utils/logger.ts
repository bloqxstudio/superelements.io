/**
 * Development-only logging utility
 * Logs are only shown in development mode to keep production console clean
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const isDevelopment = process.env.NODE_ENV === 'development';

class Logger {
  private log(level: LogLevel, message: string, ...args: any[]) {
    if (!isDevelopment) return;
    
    const timestamp = new Date().toISOString().slice(11, 23);
    const prefix = `[${timestamp}] ${level.toUpperCase()}:`;
    
    switch (level) {
      case 'error':
        console.error(prefix, message, ...args);
        break;
      case 'warn':
        console.warn(prefix, message, ...args);
        break;
      case 'info':
        console.info(prefix, message, ...args);
        break;
      case 'debug':
      default:
        console.log(prefix, message, ...args);
        break;
    }
  }

  debug(message: string, ...args: any[]) {
    this.log('debug', message, ...args);
  }

  info(message: string, ...args: any[]) {
    this.log('info', message, ...args);
  }

  warn(message: string, ...args: any[]) {
    this.log('warn', message, ...args);
  }

  error(message: string, ...args: any[]) {
    // Always log errors, even in production
    const timestamp = new Date().toISOString().slice(11, 23);
    const prefix = `[${timestamp}] ERROR:`;
    console.error(prefix, message, ...args);
  }
}

export const logger = new Logger();