import { useState, useCallback, useRef } from 'react';
import { logger } from '@/utils/logger';

interface CircuitState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
  successCount: number;
}

const FAILURE_THRESHOLD = 5; // Open circuit after 5 consecutive failures
const RECOVERY_TIMEOUT = 60000; // 60 seconds
const SUCCESS_THRESHOLD = 2; // Close circuit after 2 consecutive successes

// Global state per connection
const circuitBreakers = new Map<string, CircuitState>();

export const useCircuitBreaker = () => {
  const [, forceUpdate] = useState({});

  const checkCircuit = useCallback((connectionId: string): boolean => {
    const circuit = circuitBreakers.get(connectionId);
    
    if (!circuit || !circuit.isOpen) {
      return true; // Circuit closed, allow requests
    }

    const timeSinceLastFailure = Date.now() - circuit.lastFailure;
    
    if (timeSinceLastFailure >= RECOVERY_TIMEOUT) {
      // Try to half-open the circuit
      logger.info(`Circuit breaker half-open for connection: ${connectionId}`);
      circuit.isOpen = false;
      circuit.successCount = 0;
      forceUpdate({});
      return true;
    }

    const remainingTime = Math.ceil((RECOVERY_TIMEOUT - timeSinceLastFailure) / 1000);
    logger.warn(`Circuit breaker OPEN for ${connectionId}. Retry in ${remainingTime}s`);
    return false;
  }, []);

  const recordSuccess = useCallback((connectionId: string) => {
    const circuit = circuitBreakers.get(connectionId) || {
      failures: 0,
      lastFailure: 0,
      isOpen: false,
      successCount: 0
    };

    circuit.successCount++;
    circuit.failures = 0;

    if (circuit.successCount >= SUCCESS_THRESHOLD && circuit.isOpen) {
      logger.info(`Circuit breaker CLOSED for ${connectionId} after ${circuit.successCount} successes`);
      circuit.isOpen = false;
    }

    circuitBreakers.set(connectionId, circuit);
    forceUpdate({});
  }, []);

  const recordFailure = useCallback((connectionId: string, error?: any) => {
    const circuit = circuitBreakers.get(connectionId) || {
      failures: 0,
      lastFailure: 0,
      isOpen: false,
      successCount: 0
    };

    circuit.failures++;
    circuit.lastFailure = Date.now();
    circuit.successCount = 0;

    if (circuit.failures >= FAILURE_THRESHOLD && !circuit.isOpen) {
      circuit.isOpen = true;
      logger.error(`Circuit breaker OPEN for ${connectionId} after ${circuit.failures} failures`, {
        error: error?.message,
        recoveryTime: `${RECOVERY_TIMEOUT / 1000}s`
      });
    }

    circuitBreakers.set(connectionId, circuit);
    forceUpdate({});
  }, []);

  const getCircuitStatus = useCallback((connectionId: string) => {
    const circuit = circuitBreakers.get(connectionId);
    
    if (!circuit) {
      return { isOpen: false, failures: 0, canRetry: true, remainingTime: 0 };
    }

    const timeSinceLastFailure = Date.now() - circuit.lastFailure;
    const remainingTime = circuit.isOpen 
      ? Math.max(0, RECOVERY_TIMEOUT - timeSinceLastFailure)
      : 0;

    return {
      isOpen: circuit.isOpen,
      failures: circuit.failures,
      canRetry: !circuit.isOpen || timeSinceLastFailure >= RECOVERY_TIMEOUT,
      remainingTime: Math.ceil(remainingTime / 1000)
    };
  }, []);

  const resetCircuit = useCallback((connectionId: string) => {
    circuitBreakers.delete(connectionId);
    logger.info(`Circuit breaker RESET for ${connectionId}`);
    forceUpdate({});
  }, []);

  return {
    checkCircuit,
    recordSuccess,
    recordFailure,
    getCircuitStatus,
    resetCircuit
  };
};
