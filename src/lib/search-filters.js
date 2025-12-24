/**
 * Advanced Search Filters Module
 * Handles filtering, sorting, and product comparison
 */

import { logger } from './logger.js';

export class SearchFilter {
    constructor(filters = {}) {
        this.priceMin = filters.price_min || null;
        this.priceMax = filters.price_max || null;
        this.brand = filters.brand || null;
        this.storage = filters.storage || null;
        this.rating = filters.rating || null;
        this.category = filters.category || null;
        this.color = filters.color || null;
        this.condition = filters.condition || null;
    }

    /**
     * Check if product matches filters
     */
    matches(product) {
        if (this.priceMin && product.price < this.priceMin) {
            return false;
        }
        if (this.priceMax && product.price > this.priceMax) {
            return false;
        }
        if (this.brand && !product.brand?.toLowerCase().includes(this.brand.toLowerCase())) {
            return false;
        }
        if (this.rating && product.rating < this.rating) {
            return false;
        }
        return true;
    }

    /**
     * Get filter summary
     */
    getSummary() {
        const filters = [];
        if (this.priceMin || this.priceMax) {
            filters.push(`Price: ${this.priceMin || '0'} - ${this.priceMax || '∞'}`);
        }
        if (this.brand) filters.push(`Brand: ${this.brand}`);
        if (this.rating) filters.push(`Rating: ${this.rating}+`);
        return filters.join(', ');
    }
}

export class ProductSorter {
    /**
     * Sort products by various criteria
     */
    static sort(products, sortOption) {
        const sorted = [...products];

        switch (sortOption) {
            case 'price_low':
                return sorted.sort((a, b) => this._parsePrice(a.price) - this._parsePrice(b.price));
            case 'price_high':
                return sorted.sort((a, b) => this._parsePrice(b.price) - this._parsePrice(a.price));
            case 'rating':
                return sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
            case 'newest':
                return sorted.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
            case 'relevance':
            default:
                return sorted; // Keep original order
        }
    }

    /**
     * Parse price string to number
     */
    static _parsePrice(priceStr) {
        if (!priceStr) return 0;
        const cleaned = priceStr.replace(/[^\d.]/g, '');
        return parseFloat(cleaned) || 0;
    }
}

export class ProductComparator {
    /**
     * Compare multiple products
     */
    static compare(products) {
        if (products.length < 2) {
            return { error: 'Need at least 2 products to compare' };
        }

        const comparison = {
            products: products.map(p => ({
                title: p.title,
                price: p.price,
                rating: p.rating,
                reviews: p.reviews,
                features: p.features || [],
            })),
            differences: this._findDifferences(products),
            recommendation: this._recommend(products),
        };

        logger.info('Product comparison completed', { productCount: products.length });
        return comparison;
    }

    /**
     * Find key differences between products
     */
    static _findDifferences(products) {
        const differences = [];
        
        // Compare prices
        const prices = products.map(p => ProductSorter._parsePrice(p.price));
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        if (maxPrice - minPrice > 0) {
            differences.push({
                attribute: 'price',
                range: `${minPrice} - ${maxPrice}`,
                variance: ((maxPrice - minPrice) / minPrice * 100).toFixed(1) + '%',
            });
        }

        // Compare ratings
        const ratings = products.map(p => p.rating || 0);
        const minRating = Math.min(...ratings);
        const maxRating = Math.max(...ratings);
        if (maxRating - minRating > 0) {
            differences.push({
                attribute: 'rating',
                range: `${minRating} - ${maxRating}`,
            });
        }

        return differences;
    }

    /**
     * Recommend best product
     */
    static _recommend(products) {
        // Simple recommendation based on rating and price
        const scored = products.map(p => ({
            ...p,
            score: (p.rating || 0) * 2 - (ProductSorter._parsePrice(p.price) / 1000),
        }));

        const best = scored.reduce((best, current) => 
            current.score > best.score ? current : best
        );

        return {
            product: best.title,
            reason: `Best balance of rating (${best.rating}) and price (${best.price})`,
        };
    }
}

