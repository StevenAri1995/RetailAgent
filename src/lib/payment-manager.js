/**
 * Payment Method Management Module
 */

import { logger } from './logger.js';

export class PaymentMethod {
    constructor(data) {
        this.id = data.id || `pm_${Date.now()}`;
        this.type = data.type; // card, wallet, upi, netbanking, cod
        this.name = data.name || '';
        this.last4 = data.last4 || ''; // Last 4 digits for cards
        this.provider = data.provider || ''; // Visa, Mastercard, Paytm, etc.
        this.isDefault = data.isDefault || false;
        this.expiryDate = data.expiryDate || null; // For cards
        this.upiId = data.upiId || ''; // For UPI
    }

    /**
     * Get display name
     */
    getDisplayName() {
        if (this.type === 'card') {
            return `${this.provider} •••• ${this.last4}`;
        } else if (this.type === 'upi') {
            return `UPI - ${this.upiId}`;
        } else if (this.type === 'wallet') {
            return `${this.provider} Wallet`;
        } else {
            return this.name || this.type.toUpperCase();
        }
    }

    /**
     * Validate payment method
     */
    validate() {
        const errors = [];

        if (!this.type) {
            errors.push('Payment type is required');
        }

        if (this.type === 'card' && !this.last4) {
            errors.push('Card last 4 digits required');
        }

        if (this.type === 'upi' && !this.upiId) {
            errors.push('UPI ID is required');
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }
}

/**
 * Payment Manager Service
 */
class PaymentManager {
    constructor() {
        this.paymentMethods = [];
        this.defaultMethod = null;
    }

    /**
     * Load payment methods from storage
     */
    async load() {
        try {
            const stored = await chrome.storage.local.get(['retailAgentPaymentMethods']);
            if (stored.retailAgentPaymentMethods) {
                this.paymentMethods = stored.retailAgentPaymentMethods.map(pm => new PaymentMethod(pm));
                this.defaultMethod = this.paymentMethods.find(pm => pm.isDefault) || this.paymentMethods[0] || null;
            }
            logger.info(`Loaded ${this.paymentMethods.length} payment methods`);
            return this.paymentMethods;
        } catch (error) {
            logger.error('Failed to load payment methods', error);
            return [];
        }
    }

    /**
     * Save payment methods to storage
     */
    async save() {
        try {
            await chrome.storage.local.set({ retailAgentPaymentMethods: this.paymentMethods });
            logger.info('Payment methods saved');
        } catch (error) {
            logger.error('Failed to save payment methods', error);
            throw error;
        }
    }

    /**
     * Add payment method
     */
    async addPaymentMethod(paymentData) {
        try {
            const payment = new PaymentMethod(paymentData);
            const validation = payment.validate();

            if (!validation.valid) {
                throw new Error(`Invalid payment method: ${validation.errors.join(', ')}`);
            }

            if (payment.isDefault || this.paymentMethods.length === 0) {
                this.paymentMethods.forEach(pm => { pm.isDefault = false; });
                payment.isDefault = true;
                this.defaultMethod = payment;
            }

            this.paymentMethods.push(payment);
            await this.save();

            logger.info('Payment method added', { id: payment.id, type: payment.type });
            return payment;
        } catch (error) {
            logger.error('Failed to add payment method', error);
            throw error;
        }
    }

    /**
     * Get default payment method
     */
    getDefaultMethod() {
        return this.defaultMethod;
    }

    /**
     * Set default payment method
     */
    async setDefaultMethod(paymentId) {
        try {
            const payment = this.paymentMethods.find(pm => pm.id === paymentId);
            if (!payment) {
                throw new Error(`Payment method not found: ${paymentId}`);
            }

            this.paymentMethods.forEach(pm => { pm.isDefault = false; });
            payment.isDefault = true;
            this.defaultMethod = payment;

            await this.save();

            logger.info('Default payment method set', { id: paymentId });
            return payment;
        } catch (error) {
            logger.error('Failed to set default payment method', error);
            throw error;
        }
    }

    /**
     * Get all payment methods
     */
    getAllMethods() {
        return [...this.paymentMethods];
    }

    /**
     * Get payment methods by type
     */
    getMethodsByType(type) {
        return this.paymentMethods.filter(pm => pm.type === type);
    }
}

// Export singleton instance
export const paymentManager = new PaymentManager();

// Initialize on load
paymentManager.load().catch(error => {
    logger.error('Failed to initialize payment manager', error);
});

