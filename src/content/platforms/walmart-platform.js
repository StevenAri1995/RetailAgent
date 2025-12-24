/**
 * Walmart Platform Implementation
 */

import { EcommercePlatform } from '../../lib/ecommerce-platforms.js';
import { performSearch, extractProducts, clickProduct, addToCart } from '../shared/actions.js';
import { logger } from '../../lib/logger.js';

export class WalmartPlatform extends EcommercePlatform {
    constructor() {
        super('walmart', {
            enabled: true,
            domains: ['walmart.com'],
            selectors: {
                search: {
                    input: 'input[name="q"], input[data-automation-id="searchInput"]',
                    button: 'button[type="submit"], [data-automation-id="searchButton"]',
                },
                results: {
                    container: '[data-testid="item-stack"], .search-result-gridview-item',
                    title: '[data-automation-id="product-title"]',
                    link: 'a[data-automation-id="product-title"]',
                    price: '[data-automation-id="product-price"]',
                    rating: '[data-automation-id="product-rating"]',
                    image: 'img[data-testid="product-image"]',
                },
                product: {
                    addToCart: '[data-automation-id="addToCartButton"]',
                    pickup: '[data-automation-id="pickupButton"]',
                    title: 'h1[data-automation-id="product-title"]',
                    price: '[data-automation-id="product-price"]',
                },
            },
        });
    }

    async search(query, filters = {}) {
        try {
            logger.info('Walmart: Performing search', { query });
            await performSearch(query, {
                input: this.selectors.search.input,
                button: this.selectors.search.button,
            });
            return true;
        } catch (error) {
            logger.error('Walmart: Search failed', error);
            throw error;
        }
    }

    async getSearchResults() {
        try {
            const products = extractProducts(
                this.selectors.results.container,
                {
                    title: this.selectors.results.title,
                    price: this.selectors.results.price,
                    link: this.selectors.results.link,
                    image: this.selectors.results.image,
                    rating: this.selectors.results.rating,
                }
            );
            logger.info(`Walmart: Found ${products.length} products`);
            return products;
        } catch (error) {
            logger.error('Walmart: Failed to get search results', error);
            throw error;
        }
    }

    async selectProduct(productIndex = 0) {
        const products = await this.getSearchResults();
        if (productIndex >= products.length) {
            throw new Error(`Product index ${productIndex} out of range`);
        }
        await clickProduct(products[productIndex].link);
        return products[productIndex];
    }

    async addToCart() {
        await addToCart({ button: this.selectors.product.addToCart });
        return true;
    }

    async buyNow() {
        // Walmart doesn't have direct "Buy Now", use addToCart + checkout
        await this.addToCart();
        // Navigate to cart and proceed to checkout
        return true;
    }
}

