// Notify background that page loaded
chrome.runtime.sendMessage({ type: 'PAGE_LOADED', url: window.location.href });

// Listen for commands from Background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'GET_SEARCH_RESULTS') {
        const items = [];
        // Robust selectors for search results
        const resultSelectors = [
            '[data-component-type="s-search-result"]',
            '.s-result-item',
            '.s-card-container',
            '[data-cel-widget^="search_result_"]'
        ];

        let results = [];
        for (let sel of resultSelectors) {
            results = document.querySelectorAll(sel);
            if (results.length > 0) break;
        }

        console.log(`[Amazon Content Script] Found ${results.length} items using selector`);

        results.forEach(el => {
            // Check if sponsored
            const isSponsored =
                el.querySelector('.s-sponsored-label-text') ||
                el.innerText.includes('Sponsored') ||
                el.classList.contains('AdHolder');

            if (!isSponsored) {
                // Title Selectors
                const titleSelectors = ['h2 a span', 'h2 a', '[data-cy="title-recipe"] h2 span', '.a-text-normal'];
                let titleEl = null;
                for (let sel of titleSelectors) {
                    titleEl = el.querySelector(sel);
                    if (titleEl) break;
                }

                // Link Selectors
                const linkSelectors = ['h2 a', '.a-link-normal'];
                let linkEl = null;
                for (let sel of linkSelectors) {
                    linkEl = el.querySelector(sel);
                    if (linkEl && linkEl.href && !linkEl.href.includes('/sspa/')) break; // Avoid sponsored links
                }

                // Price Selectors
                const priceEl = el.querySelector('.a-price .a-offscreen') || el.querySelector('.a-price');

                if (titleEl && linkEl) {
                    items.push({
                        title: titleEl.innerText,
                        link: linkEl.href,
                        price: priceEl ? priceEl.innerText : 'N/A'
                    });
                }
            }
        });

        console.log(`[Amazon Content Script] Returning ${items.length} valid items`);
        sendResponse({ items: items });
    }

    if (request.action === 'CLICK_BUY_NOW') {
        const buyNowSelectors = ['#buy-now-button', '#sc-buy-box-ptc-button', '[name="submit.buy-now"]'];
        let buyNowBtn = null;

        for (let sel of buyNowSelectors) {
            buyNowBtn = document.querySelector(sel);
            if (buyNowBtn) break;
        }

        if (buyNowBtn) {
            buyNowBtn.click();
            sendResponse({ success: true });
        } else {
            sendResponse({ success: false, error: 'Buy Now button not found' });
        }
    }

    if (request.action === 'GET_ADDRESS_OPTIONS') {
        // Address selection logic
        // Usually a list of radio buttons or 'Deliver to this address' buttons
        // This is highly variable on Amazon, simplified for demo
        const invalid = false; // logic placeholder
        sendResponse({ options: [] }); // simple placeholder
    }

    // Add more handlers...
    if (request.action === 'GET_ORDER_DETAILS') {
        // Selectors for Thank You page
        const orderIdEl = document.querySelector('bdi') || document.querySelector('.my-orders-order-id'); // simplified
        const deliveryEl = document.querySelector('.delivery-box__primary-text');

        sendResponse({
            orderId: orderIdEl ? orderIdEl.innerText : 'Pending/Unknown',
            deliveryDate: deliveryEl ? deliveryEl.innerText : 'Unknown'
        });
    }
});
