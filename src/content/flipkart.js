/**
 * Flipkart Content Script
 */

import { FlipkartPlatform } from './platforms/flipkart-platform.js';
import { platformRegistry } from '../lib/ecommerce-platforms.js';
import { logger } from '../lib/logger.js';

// Register Flipkart platform
const flipkartPlatform = new FlipkartPlatform();
platformRegistry.register(flipkartPlatform);

// Notify background that page loaded
chrome.runtime.sendMessage({ type: 'PAGE_LOADED', url: window.location.href }).catch(() => {});

// Listen for commands from Background
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    try {
        if (request.action === 'GET_SEARCH_RESULTS') {
            const products = await flipkartPlatform.getSearchResults();
            sendResponse({ items: products, success: true });
        } else if (request.action === 'CLICK_BUY_NOW') {
            const success = await flipkartPlatform.buyNow();
            sendResponse({ success });
        } else if (request.action === 'ADD_TO_CART') {
            const success = await flipkartPlatform.addToCart();
            sendResponse({ success });
        } else if (request.action === 'GET_PRODUCT_DETAILS') {
            const details = await flipkartPlatform.getProductDetails();
            sendResponse({ details, success: true });
        } else {
            sendResponse({ success: false, error: 'Unknown action' });
        }
    } catch (error) {
        logger.error('Flipkart content script error', error);
        sendResponse({ success: false, error: error.message });
    }
    
    return true;
});

