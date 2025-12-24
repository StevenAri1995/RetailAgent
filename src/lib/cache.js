/**
 * Caching Module for Performance Optimization
 */

import { logger } from './logger.js';

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

class CacheEntry {
    constructor(data, ttl = DEFAULT_TTL) {
        this.data = data;
        this.expiresAt = Date.now() + ttl;
    }

    isExpired() {
        return Date.now() > this.expiresAt;
    }
}

/**
 * Simple in-memory cache with TTL
 */
class Cache {
    constructor() {
        this.store = new Map();
        this.maxSize = 100; // Maximum cache entries
    }

    /**
     * Get cached value
     */
    get(key) {
        const entry = this.store.get(key);
        if (!entry) {
            return null;
        }

        if (entry.isExpired()) {
            this.store.delete(key);
            return null;
        }

        logger.debug('Cache hit', { key });
        return entry.data;
    }

    /**
     * Set cached value
     */
    set(key, value, ttl = DEFAULT_TTL) {
        // Evict oldest entries if cache is full
        if (this.store.size >= this.maxSize && !this.store.has(key)) {
            const firstKey = this.store.keys().next().value;
            this.store.delete(firstKey);
        }

        this.store.set(key, new CacheEntry(value, ttl));
        logger.debug('Cache set', { key });
    }

    /**
     * Delete cached value
     */
    delete(key) {
        this.store.delete(key);
    }

    /**
     * Clear all cache
     */
    clear() {
        this.store.clear();
        logger.info('Cache cleared');
    }

    /**
     * Clean expired entries
     */
    clean() {
        let cleaned = 0;
        for (const [key, entry] of this.store.entries()) {
            if (entry.isExpired()) {
                this.store.delete(key);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            logger.debug(`Cleaned ${cleaned} expired cache entries`);
        }
    }

    /**
     * Get cache statistics
     */
    getStats() {
        return {
            size: this.store.size,
            maxSize: this.maxSize,
            hitRate: 0, // Would need to track hits/misses
        };
    }
}

// Export singleton instance
export const cache = new Cache();

// Clean expired entries periodically
setInterval(() => {
    cache.clean();
}, 60000); // Every minute

