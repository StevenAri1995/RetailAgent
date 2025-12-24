/**
 * Flipkart Platform Implementation
 */

import { EcommercePlatform } from '../../lib/ecommerce-platforms.js';
import { performSearch, extractProducts, clickProduct, addToCart, clickBuyNow } from '../shared/actions.js';
import { logger } from '../../lib/logger.js';

export class FlipkartPlatform extends EcommercePlatform {
    constructor() {
        super('flipkart', {
            enabled: true,
            domains: ['flipkart.com'],
            selectors: {
                search: {
                    input: 'input[name="q"], input[placeholder*="Search"]',
                    button: 'button[type="submit"], .L0Z3Pu',
                },
                results: {
                    container: '._1AtVbE, ._2kHMtA',
                    title: '._4rR01T, a.IRpwTa',
                    link: 'a.IRpwTa, a._1fQZEK',
                    price: '._30jeq3, ._1_WHN1',
                    rating: '._3LWZlK',
                    image: '._396cs4',
                },
                product: {
                    buyNow: '._2KpZ6l._2U9uOA._3v1-ww, button:contains("BUY NOW")',
                    addToCart: '._2KpZ6l._2U9uOA.ihZ75k._3AWRsL, button:contains("ADD TO CART")',
                    title: '.B_NuCI',
                    price: '._30jeq3._16Jk6d',
                },
            },
        });
    }

    async search(query, filters = {}) {
        try {
            logger.info('Flipkart: Performing search', { query });
            await performSearch(query, {
                input: this.selectors.search.input,
                button: this.selectors.search.button,
            });
            return true;
        } catch (error) {
            logger.error('Flipkart: Search failed', error);
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
                    reviews: '._13vcmD',
                }
            );
            logger.info(`Flipkart: Found ${products.length} products`);
            return products;
        } catch (error) {
            logger.error('Flipkart: Failed to get search results', error);
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
        await clickBuyNow({ button: this.selectors.product.buyNow });
        return true;
    }
}

