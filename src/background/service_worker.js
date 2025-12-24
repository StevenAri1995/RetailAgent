import { generateContent, listModels } from '../lib/gemini.js';

// State management
let currentState = {
    status: 'IDLE', // IDLE, PARSING, SEARCHING, SELECTING, CHECKOUT, PROCESSING_PAYMENT, COMPLETED
    data: {},       // Parsed intent data
    tabId: null
};

// Listen for messages from Popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'PROCESS_QUERY') {
        handleUserQuery(message.text);
        sendResponse({ status: 'processing' });
    }
    if (message.type === 'CHECK_MODELS') {
        listModels(message.apiKey)
            .then(models => sendResponse({ models }))
            .catch(err => sendResponse({ error: err.message }));
        return true; // Keep channel open for async response
    }
});

// Function to send updates to Popup and save to storage
async function logAction(text) {
    // 1. Send to open popup
    chrome.runtime.sendMessage({ type: 'UPDATE_STATUS', text: text }).catch(() => { });

    // 2. Save to storage for history
    const { actionLogs = [] } = await chrome.storage.local.get(['actionLogs']);
    actionLogs.push({ time: new Date().toLocaleTimeString(), text });
    await chrome.storage.local.set({ actionLogs });
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
    // Clear previous logs on new request
    await chrome.storage.local.set({ actionLogs: [] });

    // 1. Get API Key
    const { geminiApiKey } = await chrome.storage.local.get(['geminiApiKey']);
    if (!geminiApiKey) {
        logAction('Error: No API Key found.');
        return;
    }

    logAction('Analyzing your request...');

    // 2. Parse Intent
    try {
        const intent = await parseIntent(geminiApiKey, text);
        console.log("Parsed Intent:", intent);

        if (!intent.product) {
            logAction('Could not understand the product to buy.');
            return;
        }

        currentState.data = intent;
        currentState.status = 'SEARCHING';

        logAction(`Searching for "${intent.product}"...`);

        // 3. Start Automation
        await startAutomation();

    } catch (error) {
        console.error(error);
        logAction(`Error: ${error.message} `);
    }
}

async function parseIntent(apiKey, text) {
    const systemPrompt = `
    You are a shopping assistant. Extract the following from the user's request.
    Return JSON ONLY. No markdown.
    Fields:
    - product: (string) The search query for the product.
    - filters: (object) Key-value pairs for potential filters (e.g., "storage": "256gb").
    - delivery_location: (string) e.g., "home", "office".
    - payment_method: (string) e.g., "wallet", "card".
    
    User Request: "${text}"
    `;

    const response = await generateContent(apiKey, text, systemPrompt);
    try {
        const textResp = response.candidates[0].content.parts[0].text;
        // Strip markdown code blocks if present
        const cleanJson = textResp.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);
    } catch (e) {
        throw new Error('Failed to parse LLM response: ' + e.message);
    }
}

async function startAutomation() {
    logAction('Opening Amazon.in in a new tab...');
    const tab = await chrome.tabs.create({ url: 'https://www.amazon.in/' });
    currentState.tabId = tab.id;
    // Wait for load...
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
        logAction('Analyzing search results...');

        // Get results from content script
        try {
            const response = await chrome.tabs.sendMessage(tabId, { action: 'GET_SEARCH_RESULTS' });
            const items = response.items;
            logAction(`Found ${items ? items.length : 0} items on page.`);

            if (items && items.length > 0) {
                const bestItem = items[0]; // Simple logic: first non-sponsored
                logAction(`Found likely match: ${bestItem.title}`);
                logAction(`Price: ${bestItem.price}`);
                logAction(`Navigating to product page...`);

                currentState.status = 'PRODUCT_PAGE';

                // Navigate
                await chrome.tabs.update(tabId, { url: bestItem.link });
            } else {
                logAction('No suitable products found.');
            }
        } catch (e) {
            console.error(e);
            logAction('Error reading search results.');
        }
    }
    else if (currentState.status === 'PRODUCT_PAGE') {
        logAction('On Product Page. Finding "Buy Now" button...');

        // Brief pause to ensure elements loaded (better to use polling in content script, but simplified here)
        setTimeout(async () => {
            try {
                const response = await chrome.tabs.sendMessage(tabId, { action: 'CLICK_BUY_NOW' });
                if (response && response.success) {
                    currentState.status = 'CHECKOUT_FLOW';
                    logAction('Clicked Buy Now. Proceeding to Checkout...');
                } else {
                    logAction('Could not click "Buy Now". Might be out of stock or different layout.');
                }
            } catch (e) {
                logAction('Error clicking Buy Now.');
            }
        }, 2000);
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
