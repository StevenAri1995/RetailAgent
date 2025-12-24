/**
 * Shared action utilities for common ecommerce operations
 */

import { logger } from '../../lib/logger.js';
import { findElement, safeClick, fillInput, scrollIntoView, getText, isVisible } from './selectors.js';

/**
 * Perform search on a page
 */
export async function performSearch(searchQuery, searchSelectors, options = {}) {
    try {
        logger.info('Performing search', { query: searchQuery });

        // Find search input
        const searchInput = await findElement(searchSelectors.input, {
            maxRetries: options.maxRetries || 3,
        });

        // Fill search input
        await fillInput(searchSelectors.input, searchQuery, {
            simulateTyping: options.simulateTyping || false,
        });

        // Click search button or submit form
        if (searchSelectors.button) {
            const searchButton = await findElement(searchSelectors.button);
            await safeClick(searchButton);
        } else if (searchSelectors.submit) {
            // Submit form
            const form = searchInput.closest('form');
            if (form) {
                form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            }
        } else {
            // Press Enter
            searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
        }

        logger.info('Search submitted', { query: searchQuery });
        return true;
    } catch (error) {
        logger.error('Search failed', error, { query: searchQuery });
        throw error;
    }
}

/**
 * Extract product information from search results
 */
export function extractProducts(containerSelector, productSelectors) {
    const products = [];
    const containers = document.querySelectorAll(containerSelector);

    containers.forEach((container, index) => {
        try {
            // Get link element - try multiple approaches
            let linkElement = container.querySelector(productSelectors.link);
            if (!linkElement && typeof productSelectors.link === 'string') {
                // Try finding link within container - Amazon product links
                linkElement = container.querySelector(`a[href*="/dp/"], a[href*="/gp/product/"], a[href*="/product/"]`);
            }
            // If still not found, try any link in h2
            if (!linkElement) {
                linkElement = container.querySelector('h2 a, h3 a');
            }
            
            const titleElement = container.querySelector(productSelectors.title);
            const title = getText(titleElement);
            
            const product = {
                index,
                title: title,
                price: getText(container.querySelector(productSelectors.price)),
                link: linkElement?.href || linkElement?.getAttribute('href') || '',
                image: container.querySelector(productSelectors.image)?.src || '',
                rating: getText(container.querySelector(productSelectors.rating)),
                reviews: getText(container.querySelector(productSelectors.reviews)),
            };

            // Ensure link is absolute URL
            if (product.link && !product.link.startsWith('http')) {
                try {
                    // Check if window is available (should be in content script context)
                    if (typeof window !== 'undefined' && window.location) {
                        product.link = new URL(product.link, window.location.origin).href;
                    } else {
                        // Fallback: assume current origin
                        product.link = product.link.startsWith('/') ? `https://www.amazon.in${product.link}` : product.link;
                    }
                } catch (e) {
                    logger.warn('Failed to convert relative URL to absolute', { link: product.link, error: e.message });
                }
            }

            // Filter out invalid products - must have both title and link
            if (product.title && product.title.trim() && product.link && product.link.trim()) {
                products.push(product);
            } else {
                logger.debug('Skipping invalid product', { 
                    hasTitle: !!product.title, 
                    hasLink: !!product.link,
                    title: product.title,
                    link: product.link 
                });
            }
        } catch (error) {
            logger.warn('Failed to extract product', { error: error.message, index });
        }
    });

    logger.debug(`Extracted ${products.length} products from search results`);
    return products;
}

/**
 * Click on a product from search results
 */
export async function clickProduct(productLink, options = {}) {
    try {
        logger.info('Clicking product', { link: productLink });

        // If productLink is a URL, navigate directly
        if (productLink.startsWith('http')) {
            window.location.href = productLink;
            return;
        }

        // Otherwise, find and click the element
        const productElement = await findElement(productLink, options);
        await safeClick(productElement);

        logger.info('Product clicked');
        return true;
    } catch (error) {
        logger.error('Failed to click product', error);
        throw error;
    }
}

/**
 * Add product to cart
 */
export async function addToCart(addToCartSelectors, options = {}) {
    try {
        logger.info('Adding product to cart');

        const addToCartButton = await findElement(addToCartSelectors.button, {
            maxRetries: options.maxRetries || 3,
        });

        await scrollIntoView(addToCartButton);
        await safeClick(addToCartButton, {
            waitForClickable: true,
        });

        logger.info('Product added to cart');
        return true;
    } catch (error) {
        logger.error('Failed to add to cart', error);
        throw error;
    }
}

/**
 * Click buy now button
 */
export async function clickBuyNow(buyNowSelectors, options = {}) {
    try {
        logger.info('Clicking Buy Now');

        const buyNowButton = await findElement(buyNowSelectors.button, {
            maxRetries: options.maxRetries || 3,
        });

        await scrollIntoView(buyNowButton);
        await safeClick(buyNowButton, {
            waitForClickable: true,
        });

        logger.info('Buy Now clicked');
        return true;
    } catch (error) {
        logger.error('Failed to click Buy Now', error);
        throw error;
    }
}

/**
 * Apply filters to search results
 */
export async function applyFilters(filters, filterSelectors, options = {}) {
    try {
        logger.info('Applying filters', { filters });

        for (const [filterType, filterValue] of Object.entries(filters)) {
            if (!filterSelectors[filterType]) {
                logger.warn(`No selector found for filter: ${filterType}`);
                continue;
            }

            try {
                const filterElement = await findElement(filterSelectors[filterType].container);
                
                if (filterSelectors[filterType].type === 'checkbox') {
                    const checkbox = filterElement.querySelector(`[value="${filterValue}"]`);
                    if (checkbox && !checkbox.checked) {
                        await safeClick(checkbox);
                    }
                } else if (filterSelectors[filterType].type === 'dropdown') {
                    await selectOption(filterSelectors[filterType].container, filterValue);
                } else if (filterSelectors[filterType].type === 'range') {
                    // Handle price range or other range filters
                    const minInput = filterElement.querySelector(filterSelectors[filterType].min);
                    const maxInput = filterElement.querySelector(filterSelectors[filterType].max);
                    
                    if (filterValue.min && minInput) {
                        await fillInput(minInput, filterValue.min.toString());
                    }
                    if (filterValue.max && maxInput) {
                        await fillInput(maxInput, filterValue.max.toString());
                    }
                }

                logger.debug(`Filter applied: ${filterType}`, { value: filterValue });
            } catch (error) {
                logger.warn(`Failed to apply filter: ${filterType}`, { error: error.message });
            }
        }

        return true;
    } catch (error) {
        logger.error('Failed to apply filters', error);
        throw error;
    }
}

/**
 * Select option from dropdown (helper function)
 */
async function selectOption(selector, value) {
    const element = await findElement(selector);
    if (element.tagName === 'SELECT') {
        element.value = value;
        element.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

/**
 * Sort search results
 */
export async function sortResults(sortOption, sortSelectors, options = {}) {
    try {
        logger.info('Sorting results', { sortOption });

        const sortDropdown = await findElement(sortSelectors.dropdown, {
            maxRetries: options.maxRetries || 2,
        });

        await selectOption(sortSelectors.dropdown, sortOption);
        
        // Wait for results to reload
        await new Promise(resolve => setTimeout(resolve, options.waitAfterSort || 2000));

        logger.info('Results sorted');
        return true;
    } catch (error) {
        logger.error('Failed to sort results', error);
        throw error;
    }
}

