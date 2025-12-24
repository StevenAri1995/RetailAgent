/**
 * Ecommerce Platform Abstraction Layer
 * Base class and platform registry for multi-platform support
 */

import { logger } from './logger.js';

/**
 * Base class for ecommerce platforms
 */
export class EcommercePlatform {
    constructor(name, config) {
        this.name = name;
        this.config = config;
        this.domains = config.domains || [];
        this.selectors = config.selectors || {};
        this.actions = config.actions || {};
    }

    /**
     * Check if current page matches this platform
     */
    matches(url) {
        return this.domains.some(domain => url.includes(domain));
    }

    /**
     * Get platform-specific selectors
     */
    getSelectors() {
        return this.selectors;
    }

    /**
     * Perform search
     */
    async search(query, filters = {}) {
        throw new Error(`search() not implemented for ${this.name}`);
    }

    /**
     * Get search results
     */
    async getSearchResults() {
        throw new Error(`getSearchResults() not implemented for ${this.name}`);
    }

    /**
     * Select product from results
     */
    async selectProduct(productIndex = 0) {
        throw new Error(`selectProduct() not implemented for ${this.name}`);
    }

    /**
     * Add to cart
     */
    async addToCart() {
        throw new Error(`addToCart() not implemented for ${this.name}`);
    }

    /**
     * Click buy now
     */
    async buyNow() {
        throw new Error(`buyNow() not implemented for ${this.name}`);
    }

    /**
     * Handle checkout flow
     */
    async checkout(options = {}) {
        throw new Error(`checkout() not implemented for ${this.name}`);
    }

    /**
     * Apply filters
     */
    async applyFilters(filters) {
        throw new Error(`applyFilters() not implemented for ${this.name}`);
    }

    /**
     * Sort results
     */
    async sortResults(sortOption) {
        throw new Error(`sortResults() not implemented for ${this.name}`);
    }

    /**
     * Get product details
     */
    async getProductDetails() {
        throw new Error(`getProductDetails() not implemented for ${this.name}`);
    }

    /**
     * Track order
     */
    async trackOrder(orderId) {
        throw new Error(`trackOrder() not implemented for ${this.name}`);
    }

    /**
     * Initiate return
     */
    async initiateReturn(orderId, reason) {
        throw new Error(`initiateReturn() not implemented for ${this.name}`);
    }

    /**
     * Create support ticket
     */
    async createSupportTicket(subject, message) {
        throw new Error(`createSupportTicket() not implemented for ${this.name}`);
    }
}

/**
 * Platform Registry
 */
class PlatformRegistry {
    constructor() {
        this.platforms = new Map();
    }

    /**
     * Register a platform
     */
    register(platform) {
        if (!(platform instanceof EcommercePlatform)) {
            throw new Error('Platform must be an instance of EcommercePlatform');
        }
        this.platforms.set(platform.name, platform);
        logger.info(`Platform registered: ${platform.name}`);
    }

    /**
     * Get platform by name
     */
    get(name) {
        const platform = this.platforms.get(name);
        if (!platform) {
            throw new Error(`Platform not found: ${name}`);
        }
        return platform;
    }

    /**
     * Get platform by URL
     */
    getByUrl(url) {
        for (const platform of this.platforms.values()) {
            if (platform.matches(url)) {
                return platform;
            }
        }
        return null;
    }

    /**
     * Get all registered platforms
     */
    getAll() {
        return Array.from(this.platforms.values());
    }

    /**
     * Get enabled platforms
     */
    getEnabled() {
        return this.getAll().filter(p => p.config.enabled !== false);
    }

    /**
     * Check if platform is registered
     */
    has(name) {
        return this.platforms.has(name);
    }
}

// Export singleton instance
export const platformRegistry = new PlatformRegistry();

/**
 * Initialize platforms (called from content scripts)
 */
export function initializePlatforms() {
    // Platforms will be registered by their respective content scripts
    logger.info('Platform registry initialized');
}

