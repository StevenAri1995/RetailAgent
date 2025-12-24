/**
 * Amazon Platform Implementation
 */

import { EcommercePlatform } from '../../lib/ecommerce-platforms.js';
import { performSearch, extractProducts, clickProduct, addToCart, clickBuyNow, applyFilters, sortResults } from '../shared/actions.js';
import { findElement, safeClick, fillInput, getText } from '../shared/selectors.js';
import { logger } from '../../lib/logger.js';
import { retryDOMOperation } from '../../lib/retry.js';

export class AmazonPlatform extends EcommercePlatform {
    constructor() {
        super('amazon', {
            enabled: true,
            domains: ['amazon.in', 'amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.fr'],
            selectors: {
                search: {
                    input: '#twotabsearchtextbox',
                    button: 'input[type="submit"][value="Go"]',
                    form: 'form.nav-searchbar',
                },
                results: {
                    container: '[data-component-type="s-search-result"], .s-result-item, .s-card-container',
                    title: 'h2 a span, h2 a, [data-cy="title-recipe"] h2 span',
                    link: 'h2 a[href*="/dp/"], h2 a[href*="/gp/product/"], .a-link-normal[href*="/dp/"]',
                    price: '.a-price .a-offscreen, .a-price',
                    rating: '.a-icon-alt, .a-star-rating',
                    image: '.s-image',
                },
                product: {
                    buyNow: '#buy-now-button, #sc-buy-box-ptc-button, [name="submit.buy-now"]',
                    addToCart: '#add-to-cart-button, #add-to-cart-button-ubb',
                    title: '#productTitle',
                    price: '.a-price .a-offscreen, .a-price-whole',
                },
                checkout: {
                    address: '#address-book-entry-0, [data-action="select-shipping-address"]',
                    continue: 'input[name="shipToThisAddress"], [data-action="continue"]',
                    payment: '#payment-button, [data-action="select-payment-method"]',
                    placeOrder: '#placeYourOrder, [name="placeYourOrder1"]',
                },
            },
        });
    }

    async search(query, filters = {}) {
        try {
            logger.info('Amazon: Performing search', { query, filters });
            
            await performSearch(query, {
                input: this.selectors.search.input,
                button: this.selectors.search.button,
            });

            // Apply filters if provided
            if (Object.keys(filters).length > 0) {
                await this.applyFilters(filters);
            }

            return true;
        } catch (error) {
            logger.error('Amazon: Search failed', error);
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
                    reviews: '.a-size-base',
                }
            );

            // Filter out sponsored items
            const nonSponsored = products.filter((product, index) => {
                const container = document.querySelectorAll(this.selectors.results.container)[index];
                if (!container) return false;
                const isSponsored = container.querySelector('.s-sponsored-label-text') ||
                                  container.innerText.includes('Sponsored') ||
                                  container.classList.contains('AdHolder');
                return !isSponsored;
            });

            // Ensure all products are plain serializable objects (no DOM references)
            const serializableProducts = nonSponsored.map(product => ({
                index: typeof product.index === 'number' ? product.index : 0,
                title: String(product.title || ''),
                price: String(product.price || ''),
                link: String(product.link || ''),
                image: String(product.image || ''),
                rating: String(product.rating || ''),
                reviews: String(product.reviews || '')
            }));

            logger.info(`Amazon: Found ${serializableProducts.length} products`);
            
            return serializableProducts;
        } catch (error) {
            logger.error('Amazon: Failed to get search results', error);
            throw error;
        }
    }

    async selectProduct(productIndex = 0) {
        try {
            const products = await this.getSearchResults();
            if (productIndex >= products.length) {
                throw new Error(`Product index ${productIndex} out of range`);
            }

            const product = products[productIndex];
            logger.info('Amazon: Selecting product', { index: productIndex, title: product.title });
            
            await clickProduct(product.link);
            return product;
        } catch (error) {
            logger.error('Amazon: Failed to select product', error);
            throw error;
        }
    }

    async addToCart() {
        try {
            logger.info('Amazon: Adding to cart');
            await addToCart({
                button: this.selectors.product.addToCart,
            });
            return true;
        } catch (error) {
            logger.error('Amazon: Failed to add to cart', error);
            throw error;
        }
    }

    async buyNow() {
        try {
            logger.info('Amazon: Clicking Buy Now');
            await clickBuyNow({
                button: this.selectors.product.buyNow,
            });
            return true;
        } catch (error) {
            logger.error('Amazon: Failed to click Buy Now', error);
            throw error;
        }
    }

    async getProductDetails() {
        try {
            const title = getText(document.querySelector(this.selectors.product.title));
            const price = getText(document.querySelector(this.selectors.product.price));
            
            return {
                title,
                price,
                url: window.location.href,
            };
        } catch (error) {
            logger.error('Amazon: Failed to get product details', error);
            throw error;
        }
    }

    async applyFilters(filters) {
        // Amazon-specific filter implementation
        logger.info('Amazon: Applying filters', { filters });
        // Implementation would go here
        return true;
    }

    async sortResults(sortOption) {
        try {
            await sortResults(sortOption, {
                dropdown: '#s-result-sort-select',
            });
            return true;
        } catch (error) {
            logger.error('Amazon: Failed to sort results', error);
            throw error;
        }
    }
}

