/**
 * Coupon/Promo Code Manager
 */

import { logger } from './logger.js';

export class Coupon {
    constructor(data) {
        this.code = data.code;
        this.description = data.description || '';
        this.discount = data.discount || 0;
        this.discountType = data.discountType || 'percentage'; // percentage or fixed
        this.validUntil = data.validUntil || null;
        this.minimumPurchase = data.minimumPurchase || 0;
        this.platform = data.platform || 'all';
    }

    /**
     * Check if coupon is valid
     */
    isValid(cartTotal = 0) {
        if (this.validUntil && new Date(this.validUntil) < new Date()) {
            return false;
        }
        if (cartTotal < this.minimumPurchase) {
            return false;
        }
        return true;
    }

    /**
     * Calculate discount amount
     */
    calculateDiscount(cartTotal) {
        if (!this.isValid(cartTotal)) {
            return 0;
        }
        if (this.discountType === 'percentage') {
            return (cartTotal * this.discount) / 100;
        }
        return Math.min(this.discount, cartTotal);
    }
}

/**
 * Coupon Manager Service
 */
class CouponManager {
    constructor() {
        this.coupons = [];
    }

    /**
     * Load coupons from storage
     */
    async load() {
        try {
            const stored = await chrome.storage.local.get(['retailAgentCoupons']);
            if (stored.retailAgentCoupons) {
                this.coupons = stored.retailAgentCoupons.map(c => new Coupon(c));
            }
            logger.info(`Loaded ${this.coupons.length} coupons`);
            return this.coupons;
        } catch (error) {
            logger.error('Failed to load coupons', error);
            return [];
        }
    }

    /**
     * Save coupons to storage
     */
    async save() {
        try {
            await chrome.storage.local.set({ retailAgentCoupons: this.coupons });
            logger.info('Coupons saved');
        } catch (error) {
            logger.error('Failed to save coupons', error);
            throw error;
        }
    }

    /**
     * Add coupon
     */
    async addCoupon(couponData) {
        try {
            const coupon = new Coupon(couponData);
            this.coupons.push(coupon);
            await this.save();
            logger.info('Coupon added', { code: coupon.code });
            return coupon;
        } catch (error) {
            logger.error('Failed to add coupon', error);
            throw error;
        }
    }

    /**
     * Validate coupon code
     */
    validateCoupon(code, platform, cartTotal = 0) {
        const coupon = this.coupons.find(c => 
            c.code.toLowerCase() === code.toLowerCase() &&
            (c.platform === 'all' || c.platform === platform)
        );

        if (!coupon) {
            return { valid: false, error: 'Coupon not found' };
        }

        if (!coupon.isValid(cartTotal)) {
            return { valid: false, error: 'Coupon is not valid or minimum purchase not met' };
        }

        return {
            valid: true,
            coupon,
            discount: coupon.calculateDiscount(cartTotal),
        };
    }

    /**
     * Apply coupon to checkout
     */
    async applyCoupon(code, platform, cartTotal) {
        try {
            const validation = this.validateCoupon(code, platform, cartTotal);
            if (!validation.valid) {
                throw new Error(validation.error);
            }

            logger.info('Coupon applied', { code, discount: validation.discount });
            return validation;
        } catch (error) {
            logger.error('Failed to apply coupon', error);
            throw error;
        }
    }
}

// Export singleton instance
export const couponManager = new CouponManager();

// Initialize on load
couponManager.load().catch(error => {
    logger.error('Failed to initialize coupon manager', error);
});

