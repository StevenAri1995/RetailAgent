/**
 * Amazon Content Script
 * Handles Amazon-specific page interactions
 */

import { AmazonPlatform } from './platforms/amazon-platform.js';
import { platformRegistry } from '../lib/ecommerce-platforms.js';
import { logger } from '../lib/logger.js';

// Register Amazon platform
const amazonPlatform = new AmazonPlatform();
platformRegistry.register(amazonPlatform);

// Notify background that page loaded
chrome.runtime.sendMessage({ type: 'PAGE_LOADED', url: window.location.href }).catch(() => {});

// Listen for commands from Background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Handle async operations properly
    if (request.action === 'GET_SEARCH_RESULTS') {
        // Use promise to handle async operation
        (async () => {
            try {
                logger.info('Content script: Getting search results...');
                const products = await amazonPlatform.getSearchResults();
                logger.info(`Content script: Found ${products.length} products`);
                
                // Ensure response is fully serializable by converting to JSON and back
                try {
                    const serializableProducts = JSON.parse(JSON.stringify(products));
                    logger.info('Content script: Sending response', { itemCount: serializableProducts.length });
                    sendResponse({ items: serializableProducts, success: true });
                } catch (serializeError) {
                    logger.error('Failed to serialize products', serializeError);
                    sendResponse({ items: [], success: false, error: 'Serialization failed' });
                }
            } catch (error) {
                logger.error('Content script: Error getting search results', error);
                sendResponse({ items: [], success: false, error: error.message || 'Unknown error' });
            }
        })();
        
        // Return true to indicate we will send response asynchronously
        return true;
    }
    
    // Handle other actions
    try {
        if (request.action === 'CLICK_BUY_NOW') {
            amazonPlatform.buyNow().then(success => {
                sendResponse({ success });
            }).catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            return true;
        } else if (request.action === 'ADD_TO_CART') {
            amazonPlatform.addToCart().then(success => {
                sendResponse({ success });
            }).catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            return true;
        } else if (request.action === 'GET_PRODUCT_DETAILS') {
            amazonPlatform.getProductDetails().then(details => {
                sendResponse({ details, success: true });
            }).catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            return true;
        } else if (request.action === 'GET_ADDRESS_OPTIONS') {
            sendResponse({ options: [], success: true });
        } else if (request.action === 'GET_ORDER_DETAILS') {
            const orderIdEl = document.querySelector('bdi') || document.querySelector('.my-orders-order-id');
            const deliveryEl = document.querySelector('.delivery-box__primary-text');

            sendResponse({
                orderId: orderIdEl ? orderIdEl.innerText : 'Pending/Unknown',
                deliveryDate: deliveryEl ? deliveryEl.innerText : 'Unknown',
                success: true
            });
        } else {
            sendResponse({ success: false, error: 'Unknown action' });
        }
    } catch (error) {
        logger.error('Amazon content script error', error);
        sendResponse({ success: false, error: error.message });
    }
    
    // Return false for synchronous handlers
    return false;
});
