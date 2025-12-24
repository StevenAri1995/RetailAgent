/**
 * Configuration management system
 */

import { logger } from './logger.js';

const DEFAULT_CONFIG = {
    apiKey: null,
    preferredPlatform: null,
    features: {
        multiPlatform: true,
        offlineStores: true,
        orderTracking: true,
        returns: true,
        analytics: false,
    },
    settings: {
        autoRetry: true,
        maxRetries: 3,
        retryDelay: 1000,
        logLevel: 'INFO',
    },
    platforms: {
        amazon: {
            enabled: true,
            domains: ['amazon.in', 'amazon.com', 'amazon.co.uk'],
        },
        flipkart: {
            enabled: false,
            domains: ['flipkart.com'],
        },
        ebay: {
            enabled: false,
            domains: ['ebay.com', 'ebay.in'],
        },
        walmart: {
            enabled: false,
            domains: ['walmart.com'],
        },
    },
};

class ConfigManager {
    constructor() {
        this.config = { ...DEFAULT_CONFIG };
        this.loaded = false;
    }

    /**
     * Load configuration from storage
     */
    async load() {
        try {
            const stored = await chrome.storage.local.get(['retailAgentConfig']);
            if (stored.retailAgentConfig) {
                this.config = {
                    ...DEFAULT_CONFIG,
                    ...stored.retailAgentConfig,
                    platforms: {
                        ...DEFAULT_CONFIG.platforms,
                        ...(stored.retailAgentConfig.platforms || {}),
                    },
                };
            }
            this.loaded = true;
            logger.debug('Configuration loaded', { config: this.config });
            return this.config;
        } catch (error) {
            logger.error('Failed to load configuration', error);
            return this.config;
        }
    }

    /**
     * Save configuration to storage
     */
    async save(config = null) {
        try {
            if (config) {
                this.config = { ...this.config, ...config };
            }
            await chrome.storage.local.set({ retailAgentConfig: this.config });
            logger.info('Configuration saved');
            return this.config;
        } catch (error) {
            logger.error('Failed to save configuration', error);
            throw error;
        }
    }

    /**
     * Get configuration value
     */
    get(path, defaultValue = null) {
        const keys = path.split('.');
        let value = this.config;
        
        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return defaultValue;
            }
        }
        
        return value !== undefined ? value : defaultValue;
    }

    /**
     * Set configuration value
     */
    async set(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let target = this.config;
        
        for (const key of keys) {
            if (!target[key] || typeof target[key] !== 'object') {
                target[key] = {};
            }
            target = target[key];
        }
        
        target[lastKey] = value;
        await this.save();
        logger.debug(`Configuration updated: ${path}`, { value });
    }

    /**
     * Check if feature is enabled
     */
    isFeatureEnabled(feature) {
        return this.get(`features.${feature}`, false);
    }

    /**
     * Enable/disable feature
     */
    async setFeature(feature, enabled) {
        await this.set(`features.${feature}`, enabled);
    }

    /**
     * Check if platform is enabled
     */
    isPlatformEnabled(platform) {
        return this.get(`platforms.${platform}.enabled`, false);
    }

    /**
     * Enable/disable platform
     */
    async setPlatform(platform, enabled) {
        await this.set(`platforms.${platform}.enabled`, enabled);
    }

    /**
     * Get API key
     */
    getApiKey() {
        return this.get('apiKey');
    }

    /**
     * Set API key
     */
    async setApiKey(apiKey) {
        await this.set('apiKey', apiKey);
    }

    /**
     * Reset to defaults
     */
    async reset() {
        this.config = { ...DEFAULT_CONFIG };
        await this.save();
        logger.info('Configuration reset to defaults');
    }

    /**
     * Validate configuration
     */
    validate() {
        const errors = [];

        if (!this.config.apiKey) {
            errors.push('API key is required');
        }

        // Validate platform configurations
        for (const [platform, config] of Object.entries(this.config.platforms)) {
            if (!config.domains || !Array.isArray(config.domains) || config.domains.length === 0) {
                errors.push(`Platform ${platform} must have at least one domain`);
            }
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }
}

// Export singleton instance
export const configManager = new ConfigManager();

// Initialize on load
configManager.load().catch(error => {
    logger.error('Failed to initialize configuration', error);
});

