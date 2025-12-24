import { generateContent, listModels } from '../lib/gemini.js';
import { logger } from '../lib/logger.js';
import { ErrorHandler, IntentParseError, APIError } from '../lib/error-handler.js';
import { retryAPICall } from '../lib/retry.js';
import { platformRegistry } from '../lib/ecommerce-platforms.js';
import { configManager } from '../lib/config.js';
import { SearchFilter, ProductSorter, ProductComparator } from '../lib/search-filters.js';
// Register platforms in service worker context
// Since service worker and content scripts have separate contexts,
// we need to register platforms here for the service worker to use

// Import EcommercePlatform class
import { EcommercePlatform } from '../lib/ecommerce-platforms.js';

// Create minimal platform instances for service worker
// Full implementations are in content scripts
class SWAmazonPlatform extends EcommercePlatform {
    constructor() {
        super('amazon', {
            enabled: true,
            domains: ['amazon.in', 'amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.fr'],
        });
    }
}

class SWFlipkartPlatform extends EcommercePlatform {
    constructor() {
        super('flipkart', {
            enabled: true,
            domains: ['flipkart.com'],
        });
    }
}

class SWEbayPlatform extends EcommercePlatform {
    constructor() {
        super('ebay', {
            enabled: true,
            domains: ['ebay.com', 'ebay.in'],
        });
    }
}

class SWWalmartPlatform extends EcommercePlatform {
    constructor() {
        super('walmart', {
            enabled: true,
            domains: ['walmart.com'],
        });
    }
}

// Register platforms immediately
try {
    platformRegistry.register(new SWAmazonPlatform());
    platformRegistry.register(new SWFlipkartPlatform());
    platformRegistry.register(new SWEbayPlatform());
    platformRegistry.register(new SWWalmartPlatform());
    
    logger.info('Platforms registered in service worker', { 
        count: platformRegistry.getAll().length,
        platforms: platformRegistry.getAll().map(p => p.name)
    });
} catch (error) {
    logger.error('Failed to register platforms', error);
    console.error('Platform registration error:', error);
}

// State management
let currentState = {
    status: 'IDLE', // IDLE, PARSING, SEARCHING, SELECTING, CHECKOUT, PROCESSING_PAYMENT, COMPLETED
    data: {},       // Parsed intent data
    tabId: null
};

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ tabId: tab.id });
});

// Listen for messages from Popup/Side Panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'PROCESS_QUERY') {
        handleUserQuery(message.text).catch(error => {
            ErrorHandler.handle(error, { context: 'PROCESS_QUERY' });
        });
        sendResponse({ status: 'processing' });
    }
    if (message.type === 'CHECK_MODELS') {
        retryAPICall(() => listModels(message.apiKey), {
            maxRetries: 2,
            retryableErrors: [APIError]
        })
            .then(models => sendResponse({ models }))
            .catch(err => {
                const userMessage = ErrorHandler._getUserFriendlyMessage(err);
                sendResponse({ error: userMessage });
            });
        return true; // Keep channel open for async response
    }
});

// Function to send updates to Popup and save to storage
async function logAction(text, level = 'INFO') {
    logger[level.toLowerCase()](text);
    // Send to open popup
    chrome.runtime.sendMessage({ type: 'UPDATE_STATUS', text: text }).catch(() => { });
}

// Handle messages from Content Scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'PAGE_LOADED') {
        // Check state and execute next step
        logAction(`Page loaded: ${message.url}`);
        executeNextStep(sender.tab.id);
    }
});

async function handleUserQuery(text) {
    try {
        // Clear previous logs on new request
        await logger.clearLogs();

        // 1. Get API Key
        const { geminiApiKey } = await chrome.storage.local.get(['geminiApiKey']);
        if (!geminiApiKey) {
            const error = new Error('No API Key found. Please configure your Gemini API key in settings.');
            await ErrorHandler.handle(error, { context: 'API_KEY_MISSING' });
            logAction('Error: No API Key found. Please configure in settings.', 'error');
            return;
        }

        logAction('Analyzing your request...', 'info');

        // 2. Parse Intent with retry
        const intent = await retryAPICall(
            () => parseIntent(geminiApiKey, text),
            {
                maxRetries: 2,
                retryableErrors: [APIError, IntentParseError]
            }
        );

        logger.debug('Parsed Intent', { intent });

        if (!intent || !intent.product) {
            throw new IntentParseError('Could not understand the product to buy. Please rephrase your request.', text);
        }

        currentState.data = intent;
        currentState.status = 'SEARCHING';

        logAction(`Searching for "${intent.product}"...`, 'info');

        // 3. Start Automation
        await startAutomation();

    } catch (error) {
        logger.error('Error in handleUserQuery', error, { userQuery: text });
        const result = await ErrorHandler.handle(error, { context: 'HANDLE_USER_QUERY', userQuery: text });
        const errorMessage = result.message || result || `Error: ${error.message || error}`;
        logAction(errorMessage, 'error');
        console.error('RetailAgent Error:', error);
        console.error('Error stack:', error.stack);
    }
}

async function parseIntent(apiKey, text) {
    try {
        const systemPrompt = `
        You are a shopping assistant. Extract the following from the user's request.
        Return JSON ONLY. No markdown.
        Fields:
        - product: (string) The search query for the product.
        - platform: (string, optional) Preferred ecommerce platform: "amazon", "flipkart", "ebay", "walmart", or null.
        - filters: (object) Key-value pairs for potential filters:
          * price_min: (number) Minimum price
          * price_max: (number) Maximum price
          * brand: (string) Brand name
          * storage: (string) Storage capacity (e.g., "256gb", "512gb")
          * rating: (number) Minimum rating (1-5)
          * category: (string) Product category
          * color: (string) Product color
          * condition: (string) Product condition (new, used, refurbished)
        - sort: (string, optional) Sort option: "price_low", "price_high", "rating", "newest", "relevance"
        - delivery_location: (string) e.g., "home", "office".
        - payment_method: (string) e.g., "wallet", "card", "upi".
        - quantity: (number, optional) Quantity to purchase.
        
        User Request: "${text}"
        `;

        const response = await generateContent(apiKey, text, systemPrompt);
        
        if (!response || !response.candidates || !response.candidates[0]) {
            throw new IntentParseError('Invalid response from AI service', text);
        }

        const textResp = response.candidates[0].content.parts[0].text;
        // Strip markdown code blocks if present
        const cleanJson = textResp.replace(/```json/g, '').replace(/```/g, '').trim();
        
        try {
            return JSON.parse(cleanJson);
        } catch (parseError) {
            throw new IntentParseError(`Failed to parse AI response: ${parseError.message}`, text, {
                rawResponse: textResp
            });
        }
    } catch (error) {
        if (error instanceof IntentParseError) {
            throw error;
        }
        // Wrap other errors
        throw new IntentParseError(`Intent parsing failed: ${error.message}`, text, { originalError: error });
    }
}

async function startAutomation() {
    try {
        // Determine platform
        const platformName = currentState.data.platform || 
                            (await configManager.get('preferredPlatform')) || 
                            'amazon';
        
        logger.info('Starting automation', { platformName, intent: currentState.data });
        
        let platform;
        try {
            platform = platformRegistry.get(platformName);
            logger.info('Platform found', { platform: platform.name });
        } catch (error) {
            logger.warn(`Platform ${platformName} not found, defaulting to amazon`, error);
            platform = platformRegistry.get('amazon');
        }

        if (!platform || !platform.config || !platform.config.domains || platform.config.domains.length === 0) {
            throw new Error(`Platform ${platformName} configuration is invalid`);
        }

        // Get platform URL - use amazon.in as default for Amazon
        let platformUrl;
        if (platform.name === 'amazon') {
            platformUrl = 'https://www.amazon.in/';
        } else {
            platformUrl = `https://www.${platform.config.domains[0]}/`;
        }
        
        logger.info('Creating tab', { url: platformUrl, platform: platform.name });
        logAction(`Opening ${platform.name} in a new tab...`, 'info');
        
        const tab = await chrome.tabs.create({ url: platformUrl });
        currentState.tabId = tab.id;
        currentState.platform = platform;
        
        logger.info('Tab created successfully', { tabId: tab.id, url: platformUrl });
    } catch (error) {
        logger.error('Error in startAutomation', error, { 
            platformName: currentState.data.platform,
            registeredPlatforms: Array.from(platformRegistry.getAll().map(p => p.name))
        });
        throw error;
    }
}

async function executeNextStep(tabId) {
    if (tabId !== currentState.tabId) return;

    if (currentState.status === 'SEARCHING') {
        // We are on homepage, search for product
        logAction("Executing Search...");
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: (product) => {
                const input = document.getElementById('twotabsearchtextbox');
                const form = document.querySelector('form.nav-searchbar'); // Using form submit is safer
                if (input && form) {
                    input.value = product;
                    document.querySelector('input[type="submit"]').click(); // Click search button
                }
            },
            args: [currentState.data.product]
        });

        currentState.status = 'SELECTING'; // Next state after search loads
    }
    else if (currentState.status === 'SELECTING') {
        logAction('Analyzing search results...', 'info');

        // Wait a bit for page to fully load
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Get results from content script
        try {
            logger.info('Requesting search results from content script', { tabId });
            
            // Use promise wrapper for chrome.tabs.sendMessage with timeout
            const getSearchResults = () => {
                return new Promise((resolve, reject) => {
                    logger.info('Sending message to content script', { tabId });
                    
                    // Set a timeout to avoid hanging forever
                    const timeout = setTimeout(() => {
                        reject(new Error('Timeout waiting for content script response'));
                    }, 10000); // 10 second timeout
                    
                    chrome.tabs.sendMessage(tabId, { action: 'GET_SEARCH_RESULTS' }, (response) => {
                        clearTimeout(timeout);
                        
                        if (chrome.runtime.lastError) {
                            const errorMsg = chrome.runtime.lastError.message;
                            logger.error('Chrome runtime error in sendMessage', null, { errorMessage: errorMsg });
                            reject(new Error(errorMsg));
                        } else if (response === undefined || response === null) {
                            logger.warn('No response from content script', {});
                            reject(new Error('No response from content script'));
                        } else {
                            logger.info('Received response from content script', { 
                                hasItems: 'items' in response,
                                itemCount: response.items ? response.items.length : 0,
                                success: response.success
                            });
                            resolve(response);
                        }
                    });
                });
            };
            
            // Wait a bit for content script to be fully loaded
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            let response;
            try {
                logger.info('Attempting to get search results (first try)...');
                response = await getSearchResults();
                logger.info('Got response on first try', { 
                    hasResponse: !!response,
                    hasItems: response && 'items' in response,
                    itemCount: response && response.items ? response.items.length : 0
                });
            } catch (sendError) {
                const errorMsg = sendError && sendError.message ? String(sendError.message) : 'Unknown error';
                logger.warn('First attempt failed, retrying...', { error: errorMsg });
                logAction('Content script not ready. Waiting...', 'warn');
                
                // Wait longer and try again
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                try {
                    logger.info('Attempting to get search results (retry)...');
                    response = await getSearchResults();
                    logger.info('Got response on retry', { 
                        hasResponse: !!response,
                        hasItems: response && 'items' in response,
                        itemCount: response && response.items ? response.items.length : 0
                    });
                } catch (retryError) {
                    const retryErrorMsg = retryError && retryError.message ? String(retryError.message) : 'Unknown error';
                    logger.error('Failed after retry', null, { 
                        errorMessage: retryErrorMsg,
                        lastError: chrome.runtime.lastError ? chrome.runtime.lastError.message : 'No lastError'
                    });
                    logAction('Could not retrieve search results.', 'error');
                    return;
                }
            }
            
            // Safely check response without accessing properties that might trigger getters
            if (!response) {
                logAction('No response from content script.', 'error');
                logger.error('Empty response from content script', null, {});
                return;
            }

            // Safely extract items - use JSON to ensure clean serialization
            let items = [];
            try {
                // First, try to serialize the response to ensure it's clean
                const responseStr = JSON.stringify(response);
                const cleanResponse = JSON.parse(responseStr);
                
                // Check if response is an array
                if (Array.isArray(cleanResponse)) {
                    items = cleanResponse;
                    logger.info('Response is direct array', { count: items.length });
                } else if (cleanResponse && Array.isArray(cleanResponse.items)) {
                    items = cleanResponse.items;
                    logger.info('Response has items property', { count: items.length });
                } else {
                    logger.warn('Response items is not an array', { 
                        responseType: typeof cleanResponse,
                        hasItems: 'items' in cleanResponse
                    });
                }
            } catch (extractError) {
                logger.error('Error extracting items from response', null, { 
                    errorMessage: String(extractError.message || 'Unknown error')
                });
                logAction('Error processing search results.', 'error');
                return;
            }
            
            // Safely process items
            let firstItemSafe = null;
            try {
                if (items.length > 0 && items[0]) {
                    const first = items[0];
                    firstItemSafe = {
                        title: String(first.title || '').substring(0, 50),
                        price: String(first.price || ''),
                        hasLink: !!first.link,
                        linkPreview: first.link ? String(first.link).substring(0, 80) : 'NO LINK'
                    };
                }
            } catch (processError) {
                logger.warn('Error processing first item', { errorMessage: String(processError.message || 'Unknown') });
            }
            
            logger.info('Processing search results', { 
                itemCount: items.length,
                firstItem: firstItemSafe
            });
            logAction(`Found ${items.length} items on page.`, 'info');

            if (items && items.length > 0) {
                try {
                    const bestItem = items[0]; // Simple logic: first non-sponsored
                    
                    // Safely extract product data
                    const productTitle = String(bestItem.title || '');
                    const productPrice = String(bestItem.price || '');
                    const productLink = String(bestItem.link || '');
                    
                    // Safely log best item
                    const safeBestItem = {
                        title: productTitle,
                        price: productPrice,
                        link: productLink,
                        hasLink: !!productLink && productLink.length > 0
                    };
                    logger.info('Best item selected', safeBestItem);
                    
                    if (!productLink || productLink === '') {
                        logAction('Product link not found in search results.', 'error');
                        logger.error('Invalid product item - no link', null, { item: safeBestItem });
                        return;
                    }

                    logAction(`Found likely match: ${productTitle}`, 'info');
                    logAction(`Price: ${productPrice}`, 'info');
                    logAction(`Navigating to product page...`, 'info');

                    currentState.status = 'PRODUCT_PAGE';

                    // Navigate to product page
                    logger.info('Navigating to product', { url: productLink, tabId });
                    try {
                        await chrome.tabs.update(tabId, { url: productLink });
                        logger.info('Navigation initiated successfully', { url: productLink });
                        logAction(`Opening product page...`, 'info');
                    } catch (navError) {
                        logger.error('Navigation failed', null, { errorMessage: String(navError.message || 'Unknown error') });
                        logAction(`Failed to navigate: ${navError.message}`, 'error');
                    }
                } catch (itemError) {
                    logger.error('Error processing best item', null, { errorMessage: String(itemError.message || 'Unknown error') });
                    logAction('Error processing product item.', 'error');
                }
            } else {
                logAction('No suitable products found.', 'warn');
                logger.warn('No products in response', { itemCount: items ? items.length : 0 });
            }
        } catch (e) {
            // Safely extract error message without trying to serialize the error object
            const errorMessage = e && typeof e.message === 'string' ? e.message : 'Unknown error';
            const errorName = e && typeof e.name === 'string' ? e.name : 'Error';
            logger.error('Error reading search results', null, { 
                errorMessage: errorMessage,
                errorName: errorName
            });
            logAction(`Error reading search results: ${errorMessage}`, 'error');
        }
    }
    else if (currentState.status === 'PRODUCT_PAGE') {
        logAction('On Product Page. Finding "Buy Now" button...', 'info');

        // Wait for product page to fully load
        await new Promise(resolve => setTimeout(resolve, 3000));

        try {
            logger.info('Attempting to click Buy Now', { tabId });
            const response = await chrome.tabs.sendMessage(tabId, { action: 'CLICK_BUY_NOW' });
            logger.info('Buy Now response', { response });
            
            if (response && response.success) {
                currentState.status = 'CHECKOUT_FLOW';
                logAction('Clicked Buy Now. Proceeding to Checkout...', 'info');
            } else {
                logAction('Could not click "Buy Now". Trying Add to Cart instead...', 'warn');
                // Try Add to Cart as fallback
                const cartResponse = await chrome.tabs.sendMessage(tabId, { action: 'ADD_TO_CART' });
                if (cartResponse && cartResponse.success) {
                    logAction('Added to cart successfully. Please proceed to checkout manually.', 'info');
                } else {
                    logAction('Could not add to cart. Product might be out of stock.', 'warn');
                }
            }
        } catch (e) {
            logger.error('Error clicking Buy Now', e, { 
                errorMessage: e.message,
                errorStack: e.stack 
            });
            logAction(`Error clicking Buy Now: ${e.message}`, 'error');
        }
    }
    else if (currentState.status === 'CHECKOUT_FLOW') {
        // This is complex. We might hit a Login page, Address Selection, or straight to Payment.
        logAction('In Checkout Flow. Navigating purchase steps...');

        // Check for Order Confirmation URL
        const currentUrl = (await chrome.tabs.get(tabId)).url;
        if (currentUrl.includes('thank-you') || currentUrl.includes('order-confirmation')) {
            currentState.status = 'COMPLETED';

            const response = await chrome.tabs.sendMessage(tabId, { action: 'GET_ORDER_DETAILS' });
            logAction(`Order Placed Successfully!`);
            logAction(`Order ID: ${response.orderId}`);
            logAction(`Delivery Estimate: ${response.deliveryDate}`);
        }
    }
}
