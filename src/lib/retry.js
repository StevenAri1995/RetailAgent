/**
 * Retry logic with exponential backoff
 */

import { logger } from './logger.js';
import { ErrorHandler } from './error-handler.js';

/**
 * Retry configuration
 */
export class RetryConfig {
    constructor(options = {}) {
        this.maxRetries = options.maxRetries || 3;
        this.initialDelay = options.initialDelay || 1000;
        this.maxDelay = options.maxDelay || 30000;
        this.multiplier = options.multiplier || 2;
        this.retryableErrors = options.retryableErrors || [];
        this.onRetry = options.onRetry || null;
    }
}

/**
 * Calculate delay for exponential backoff
 */
function calculateDelay(attempt, config) {
    const delay = Math.min(
        config.initialDelay * Math.pow(config.multiplier, attempt),
        config.maxDelay
    );
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.3 * delay;
    return delay + jitter;
}

/**
 * Check if error is retryable
 */
function isRetryable(error, config) {
    // Network errors are always retryable
    if (error.name === 'NetworkError' || error.message.includes('network')) {
        return true;
    }

    // Check status codes
    if (error.statusCode || error.status) {
        const status = error.statusCode || error.status;
        // Retry on 5xx errors and 429 (rate limit)
        return status >= 500 || status === 429;
    }

    // Check custom retryable errors
    if (config.retryableErrors.length > 0) {
        return config.retryableErrors.some(retryableError => 
            error instanceof retryableError || error.name === retryableError.name
        );
    }

    // Default: don't retry unless explicitly configured
    return false;
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff(fn, config = new RetryConfig()) {
    let lastError;
    
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        try {
            const result = await fn();
            if (attempt > 0) {
                logger.info(`Operation succeeded after ${attempt} retries`);
            }
            return result;
        } catch (error) {
            lastError = error;
            
            // Check if error is retryable
            if (!isRetryable(error, config)) {
                logger.warn('Error is not retryable', { error: error.message });
                throw error;
            }

            // Don't retry on last attempt
            if (attempt >= config.maxRetries) {
                logger.error(`Max retries (${config.maxRetries}) exceeded`, error);
                break;
            }

            // Calculate delay
            const delay = calculateDelay(attempt, config);
            logger.warn(`Retry attempt ${attempt + 1}/${config.maxRetries} after ${delay}ms`, {
                error: error.message,
                delay
            });

            // Call onRetry callback if provided
            if (config.onRetry) {
                await config.onRetry(attempt + 1, error, delay);
            }

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}

/**
 * Retry DOM operations with element waiting
 */
export async function retryDOMOperation(selector, operation, options = {}) {
    const config = new RetryConfig({
        maxRetries: options.maxRetries || 5,
        initialDelay: options.initialDelay || 500,
        maxDelay: options.maxDelay || 5000,
        ...options
    });

    return retryWithBackoff(async () => {
        // Check if document is available (not in service worker context)
        if (typeof document === 'undefined') {
            throw new Error('DOM operations not available in service worker context');
        }
        const element = document.querySelector(selector);
        if (!element) {
            throw new Error(`Element not found: ${selector}`);
        }
        return await operation(element);
    }, config);
}

/**
 * Retry API calls with exponential backoff
 */
export async function retryAPICall(apiCall, options = {}) {
    const config = new RetryConfig({
        maxRetries: options.maxRetries || 3,
        initialDelay: options.initialDelay || 1000,
        maxDelay: options.maxDelay || 30000,
        multiplier: options.multiplier || 2,
        retryableErrors: options.retryableErrors || [],
        ...options
    });

    return retryWithBackoff(apiCall, config);
}

/**
 * Wait for condition with timeout
 */
export async function waitForCondition(condition, options = {}) {
    const timeout = options.timeout || 10000;
    const interval = options.interval || 500;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        try {
            const result = await condition();
            if (result) {
                return result;
            }
        } catch (error) {
            // Ignore errors during condition check
        }
        await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error(`Condition not met within ${timeout}ms`);
}

