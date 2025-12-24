/**
 * eBay Platform Implementation
 */

import { EcommercePlatform } from '../../lib/ecommerce-platforms.js';
import { performSearch, extractProducts, clickProduct } from '../shared/actions.js';
import { logger } from '../../lib/logger.js';

export class EbayPlatform extends EcommercePlatform {
    constructor() {
        super('ebay', {
            enabled: true,
            domains: ['ebay.com', 'ebay.in'],
            selectors: {
                search: {
                    input: '#gh-ac',
                    button: '#gh-btn',
                },
                results: {
                    container: '.s-item',
                    title: '.s-item__title',
                    link: '.s-item__link',
                    price: '.s-item__price',
                    shipping: '.s-item__shipping',
                    image: '.s-item__image-img',
                },
                product: {
                    buyNow: '#binBtn_btn, .binBtn',
                    addToCart: '#isCartBtn_btn',
                    bid: '#bidBtn_btn',
                    title: '#x-item-title-label',
                    price: '.notranslate',
                },
            },
        });
    }

    async search(query, filters = {}) {
        try {
            logger.info('eBay: Performing search', { query });
            await performSearch(query, {
                input: this.selectors.search.input,
                button: this.selectors.search.button,
            });
            return true;
        } catch (error) {
            logger.error('eBay: Search failed', error);
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
                    shipping: this.selectors.results.shipping,
                }
            );
            logger.info(`eBay: Found ${products.length} products`);
            return products;
        } catch (error) {
            logger.error('eBay: Failed to get search results', error);
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

    async buyNow() {
        await clickBuyNow({ button: this.selectors.product.buyNow });
        return true;
    }
}

