/**
 * Lazy Loading Module
 * Implements code splitting and lazy loading for content scripts
 */

import { logger } from './logger.js';

/**
 * Lazy load platform-specific content script
 */
export async function loadPlatformScript(platformName) {
    try {
        logger.debug(`Lazy loading platform script: ${platformName}`);
        
        // Dynamic import based on platform
        switch (platformName) {
            case 'amazon':
                return await import('../content/platforms/amazon-platform.js');
            case 'flipkart':
                return await import('../content/platforms/flipkart-platform.js');
            case 'ebay':
                return await import('../content/platforms/ebay-platform.js');
            case 'walmart':
                return await import('../content/platforms/walmart-platform.js');
            default:
                throw new Error(`Unknown platform: ${platformName}`);
        }
    } catch (error) {
        logger.error(`Failed to load platform script: ${platformName}`, error);
        throw error;
    }
}

/**
 * Preload platform scripts for better performance
 */
export async function preloadPlatforms(platformNames) {
    const loadPromises = platformNames.map(name => 
        loadPlatformScript(name).catch(err => {
            logger.warn(`Failed to preload platform: ${name}`, err);
            return null;
        })
    );
    
    await Promise.all(loadPromises);
    logger.info(`Preloaded ${platformNames.length} platforms`);
}

