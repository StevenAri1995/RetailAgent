/**
 * Address Management Module
 * Handles address CRUD operations, validation, and selection
 */

import { logger } from './logger.js';
import { configManager } from './config.js';

export class Address {
    constructor(data) {
        this.id = data.id || `addr_${Date.now()}`;
        this.type = data.type || 'home'; // home, office, other
        this.name = data.name || '';
        this.phone = data.phone || '';
        this.addressLine1 = data.addressLine1 || '';
        this.addressLine2 = data.addressLine2 || '';
        this.city = data.city || '';
        this.state = data.state || '';
        this.zipCode = data.zipCode || '';
        this.country = data.country || 'India';
        this.isDefault = data.isDefault || false;
    }

    /**
     * Get formatted address string
     */
    getFormattedAddress() {
        const parts = [
            this.addressLine1,
            this.addressLine2,
            this.city,
            this.state,
            this.zipCode,
            this.country,
        ].filter(Boolean);
        return parts.join(', ');
    }

    /**
     * Validate address
     */
    validate() {
        const errors = [];

        if (!this.name.trim()) {
            errors.push('Name is required');
        }
        if (!this.phone.trim()) {
            errors.push('Phone number is required');
        }
        if (!this.addressLine1.trim()) {
            errors.push('Address line 1 is required');
        }
        if (!this.city.trim()) {
            errors.push('City is required');
        }
        if (!this.state.trim()) {
            errors.push('State is required');
        }
        if (!this.zipCode.trim()) {
            errors.push('ZIP code is required');
        }

        // Validate phone number format (basic)
        if (this.phone && !/^[\d\s\-\+\(\)]+$/.test(this.phone)) {
            errors.push('Invalid phone number format');
        }

        // Validate ZIP code format (basic)
        if (this.zipCode && !/^\d{5,6}$/.test(this.zipCode.replace(/\s/g, ''))) {
            errors.push('Invalid ZIP code format');
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }
}

/**
 * Address Manager Service
 */
class AddressManager {
    constructor() {
        this.addresses = [];
        this.defaultAddress = null;
    }

    /**
     * Load addresses from storage
     */
    async load() {
        try {
            const stored = await chrome.storage.local.get(['retailAgentAddresses']);
            if (stored.retailAgentAddresses) {
                this.addresses = stored.retailAgentAddresses.map(addr => new Address(addr));
                this.defaultAddress = this.addresses.find(addr => addr.isDefault) || this.addresses[0] || null;
            }
            logger.info(`Loaded ${this.addresses.length} addresses`);
            return this.addresses;
        } catch (error) {
            logger.error('Failed to load addresses', error);
            return [];
        }
    }

    /**
     * Save addresses to storage
     */
    async save() {
        try {
            await chrome.storage.local.set({ retailAgentAddresses: this.addresses });
            logger.info('Addresses saved');
        } catch (error) {
            logger.error('Failed to save addresses', error);
            throw error;
        }
    }

    /**
     * Add new address
     */
    async addAddress(addressData) {
        try {
            const address = new Address(addressData);
            const validation = address.validate();

            if (!validation.valid) {
                throw new Error(`Invalid address: ${validation.errors.join(', ')}`);
            }

            // If this is the first address or marked as default, set as default
            if (this.addresses.length === 0 || address.isDefault) {
                // Unset other defaults
                this.addresses.forEach(addr => { addr.isDefault = false; });
                address.isDefault = true;
                this.defaultAddress = address;
            }

            this.addresses.push(address);
            await this.save();

            logger.info('Address added', { id: address.id });
            return address;
        } catch (error) {
            logger.error('Failed to add address', error);
            throw error;
        }
    }

    /**
     * Update existing address
     */
    async updateAddress(addressId, updates) {
        try {
            const address = this.addresses.find(addr => addr.id === addressId);
            if (!address) {
                throw new Error(`Address not found: ${addressId}`);
            }

            Object.assign(address, updates);
            const validation = address.validate();

            if (!validation.valid) {
                throw new Error(`Invalid address: ${validation.errors.join(', ')}`);
            }

            // Handle default address change
            if (updates.isDefault && !address.isDefault) {
                this.addresses.forEach(addr => { addr.isDefault = false; });
                address.isDefault = true;
                this.defaultAddress = address;
            }

            await this.save();

            logger.info('Address updated', { id: addressId });
            return address;
        } catch (error) {
            logger.error('Failed to update address', error);
            throw error;
        }
    }

    /**
     * Delete address
     */
    async deleteAddress(addressId) {
        try {
            const index = this.addresses.findIndex(addr => addr.id === addressId);
            if (index === -1) {
                throw new Error(`Address not found: ${addressId}`);
            }

            const address = this.addresses[index];
            this.addresses.splice(index, 1);

            // If deleted address was default, set new default
            if (address.isDefault && this.addresses.length > 0) {
                this.addresses[0].isDefault = true;
                this.defaultAddress = this.addresses[0];
            } else if (this.addresses.length === 0) {
                this.defaultAddress = null;
            }

            await this.save();

            logger.info('Address deleted', { id: addressId });
            return true;
        } catch (error) {
            logger.error('Failed to delete address', error);
            throw error;
        }
    }

    /**
     * Get address by ID
     */
    getAddress(addressId) {
        return this.addresses.find(addr => addr.id === addressId);
    }

    /**
     * Get all addresses
     */
    getAllAddresses() {
        return [...this.addresses];
    }

    /**
     * Get default address
     */
    getDefaultAddress() {
        return this.defaultAddress;
    }

    /**
     * Set default address
     */
    async setDefaultAddress(addressId) {
        try {
            const address = this.addresses.find(addr => addr.id === addressId);
            if (!address) {
                throw new Error(`Address not found: ${addressId}`);
            }

            this.addresses.forEach(addr => { addr.isDefault = false; });
            address.isDefault = true;
            this.defaultAddress = address;

            await this.save();

            logger.info('Default address set', { id: addressId });
            return address;
        } catch (error) {
            logger.error('Failed to set default address', error);
            throw error;
        }
    }
}

// Export singleton instance
export const addressManager = new AddressManager();

// Initialize on load
addressManager.load().catch(error => {
    logger.error('Failed to initialize address manager', error);
});

