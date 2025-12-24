/**
 * Store Locator Module
 * Handles finding nearby offline stores, availability checking, and directions
 */

import { logger } from './logger.js';
import { configManager } from './config.js';

/**
 * Store information structure
 */
export class Store {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.address = data.address;
        this.phone = data.phone;
        this.latitude = data.latitude;
        this.longitude = data.longitude;
        this.distance = data.distance; // in km
        this.hours = data.hours || {};
        this.availability = data.availability || null;
        this.rating = data.rating || null;
    }

    /**
     * Get formatted address
     */
    getFormattedAddress() {
        return `${this.address.street}, ${this.address.city}, ${this.address.state} ${this.address.zip}`;
    }

    /**
     * Get formatted phone number
     */
    getFormattedPhone() {
        return this.phone;
    }

    /**
     * Get Google Maps URL
     */
    getGoogleMapsUrl() {
        const query = encodeURIComponent(this.getFormattedAddress());
        return `https://www.google.com/maps/search/?api=1&query=${query}`;
    }

    /**
     * Get Apple Maps URL
     */
    getAppleMapsUrl() {
        const query = encodeURIComponent(this.getFormattedAddress());
        return `https://maps.apple.com/?q=${query}`;
    }

    /**
     * Get directions URL
     */
    getDirectionsUrl(userLocation = null) {
        if (userLocation) {
            return `https://www.google.com/maps/dir/${userLocation.lat},${userLocation.lng}/${this.latitude},${this.longitude}`;
        }
        return this.getGoogleMapsUrl();
    }
}

/**
 * Store Locator Service
 */
class StoreLocator {
    constructor() {
        this.googleMapsApiKey = null;
        this.userLocation = null;
    }

    /**
     * Initialize with Google Maps API key
     */
    async initialize(apiKey = null) {
        this.googleMapsApiKey = apiKey || await configManager.get('googleMapsApiKey');
        logger.info('Store locator initialized');
    }

    /**
     * Get user's current location
     */
    async getUserLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported by this browser'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.userLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    };
                    logger.info('User location obtained', this.userLocation);
                    resolve(this.userLocation);
                },
                (error) => {
                    logger.error('Failed to get user location', error);
                    reject(error);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 60000,
                }
            );
        });
    }

    /**
     * Find stores near a location
     */
    async findNearbyStores(query, options = {}) {
        try {
            logger.info('Finding nearby stores', { query, options });

            const location = options.location || this.userLocation || await this.getUserLocation();
            const radius = options.radius || 10; // km
            const maxResults = options.maxResults || 20;

            // Use Google Places API if available
            if (this.googleMapsApiKey) {
                return await this._searchGooglePlaces(query, location, radius, maxResults);
            }

            // Fallback: Use browser-based search
            return await this._searchBrowserBased(query, location, radius);
        } catch (error) {
            logger.error('Failed to find nearby stores', error);
            throw error;
        }
    }

    /**
     * Search using Google Places API
     */
    async _searchGooglePlaces(query, location, radius, maxResults) {
        if (!this.googleMapsApiKey) {
            throw new Error('Google Maps API key not configured');
        }

        const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${location.lat},${location.lng}&radius=${radius * 1000}&key=${this.googleMapsApiKey}`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (data.status !== 'OK') {
                throw new Error(`Google Places API error: ${data.status}`);
            }

            const stores = data.results.slice(0, maxResults).map((place, index) => {
                return new Store({
                    id: place.place_id,
                    name: place.name,
                    address: {
                        street: place.formatted_address,
                        city: place.vicinity,
                    },
                    phone: place.formatted_phone_number,
                    latitude: place.geometry.location.lat,
                    longitude: place.geometry.location.lng,
                    distance: this._calculateDistance(
                        location.lat,
                        location.lng,
                        place.geometry.location.lat,
                        place.geometry.location.lng
                    ),
                    rating: place.rating,
                    hours: place.opening_hours,
                });
            });

            // Sort by distance
            stores.sort((a, b) => a.distance - b.distance);

            logger.info(`Found ${stores.length} stores`);
            return stores;
        } catch (error) {
            logger.error('Google Places API search failed', error);
            throw error;
        }
    }

    /**
     * Browser-based search (opens Google Maps)
     */
    async _searchBrowserBased(query, location, radius) {
        // Open Google Maps search in new tab
        const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}/@${location.lat},${location.lng},${radius}km`;
        chrome.tabs.create({ url });
        
        logger.info('Opened Google Maps search', { url });
        return [];
    }

    /**
     * Check store availability for a product
     */
    async checkAvailability(storeId, productId) {
        try {
            logger.info('Checking store availability', { storeId, productId });
            
            // This would typically call the store's API or website
            // For now, return mock data
            return {
                available: Math.random() > 0.3, // 70% chance available
                quantity: Math.floor(Math.random() * 10) + 1,
                lastChecked: new Date().toISOString(),
            };
        } catch (error) {
            logger.error('Failed to check availability', error);
            throw error;
        }
    }

    /**
     * Get store hours
     */
    async getStoreHours(storeId) {
        try {
            // This would fetch from store API or Google Places
            return {
                monday: '9:00 AM - 9:00 PM',
                tuesday: '9:00 AM - 9:00 PM',
                wednesday: '9:00 AM - 9:00 PM',
                thursday: '9:00 AM - 9:00 PM',
                friday: '9:00 AM - 10:00 PM',
                saturday: '9:00 AM - 10:00 PM',
                sunday: '10:00 AM - 8:00 PM',
            };
        } catch (error) {
            logger.error('Failed to get store hours', error);
            throw error;
        }
    }

    /**
     * Call store phone number
     */
    callStore(phoneNumber) {
        const telUrl = `tel:${phoneNumber.replace(/\D/g, '')}`;
        window.location.href = telUrl;
        logger.info('Initiating phone call', { phoneNumber });
    }

    /**
     * Get directions to store
     */
    getDirections(store, userLocation = null) {
        const location = userLocation || this.userLocation;
        const url = store.getDirectionsUrl(location);
        chrome.tabs.create({ url });
        logger.info('Opening directions', { url });
    }

    /**
     * Calculate distance between two coordinates (Haversine formula)
     */
    _calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = this._toRad(lat2 - lat1);
        const dLon = this._toRad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this._toRad(lat1)) *
                Math.cos(this._toRad(lat2)) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    _toRad(degrees) {
        return degrees * (Math.PI / 180);
    }
}

// Export singleton instance
export const storeLocator = new StoreLocator();

