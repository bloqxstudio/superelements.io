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

  // Network-specific logging with detailed context
  logNetworkError(context: string, details: {
    url?: string;
    method?: string;
    status?: number;
    statusText?: string;
    responseTime?: number;
    retryCount?: number;
    maxRetries?: number;
    error?: any;
    headers?: Record<string, string>;
  }) {
    // Always log network errors for debugging
    const timestamp = new Date().toISOString();
    const safeDetails = {
      ...details,
      // Remove sensitive data
      headers: details.headers ? {
        'Content-Type': details.headers['Content-Type'],
        'Authorization': details.headers['Authorization'] ? '***REDACTED***' : undefined
      } : undefined
    };
    
    console.error(`[${timestamp}] NETWORK ERROR - ${context}`, safeDetails);
  }

  logNetworkRequest(context: string, details: {
    url: string;
    method: string;
    timestamp: number;
    hasAuth: boolean;
    retryCount?: number;
  }) {
    if (!isDevelopment) return;
    
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] NETWORK REQUEST - ${context}`, details);
  }

  logNetworkSuccess(context: string, details: {
    url: string;
    status: number;
    responseTime: number;
    dataSize?: number;
  }) {
    if (!isDevelopment) return;
    
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] NETWORK SUCCESS - ${context}`, details);
  }
}

export const logger = new Logger();
