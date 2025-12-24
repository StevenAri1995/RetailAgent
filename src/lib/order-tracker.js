/**
 * Order Tracking Module
 * Handles order tracking, returns, and support tickets
 */

import { logger } from './logger.js';
import { retryAPICall } from './retry.js';

export class Order {
    constructor(data) {
        this.orderId = data.orderId;
        this.platform = data.platform;
        this.status = data.status || 'pending'; // pending, confirmed, shipped, delivered, cancelled, returned
        this.items = data.items || [];
        this.totalAmount = data.totalAmount || 0;
        this.orderDate = data.orderDate || new Date().toISOString();
        this.estimatedDelivery = data.estimatedDelivery || null;
        this.trackingNumber = data.trackingNumber || null;
        this.trackingUrl = data.trackingUrl || null;
        this.shippingAddress = data.shippingAddress || null;
        this.paymentMethod = data.paymentMethod || null;
    }

    /**
     * Check if order can be returned
     */
    canReturn() {
        return ['delivered', 'shipped'].includes(this.status);
    }

    /**
     * Check if order can be cancelled
     */
    canCancel() {
        return ['pending', 'confirmed'].includes(this.status);
    }
}

/**
 * Order Tracker Service
 */
class OrderTracker {
    constructor() {
        this.orders = [];
    }

    /**
     * Load orders from storage
     */
    async load() {
        try {
            const stored = await chrome.storage.local.get(['retailAgentOrders']);
            if (stored.retailAgentOrders) {
                this.orders = stored.retailAgentOrders.map(order => new Order(order));
            }
            logger.info(`Loaded ${this.orders.length} orders`);
            return this.orders;
        } catch (error) {
            logger.error('Failed to load orders', error);
            return [];
        }
    }

    /**
     * Save orders to storage
     */
    async save() {
        try {
            await chrome.storage.local.set({ retailAgentOrders: this.orders });
            logger.info('Orders saved');
        } catch (error) {
            logger.error('Failed to save orders', error);
            throw error;
        }
    }

    /**
     * Add new order
     */
    async addOrder(orderData) {
        try {
            const order = new Order(orderData);
            this.orders.unshift(order); // Add to beginning
            await this.save();

            logger.info('Order added', { orderId: order.orderId, platform: order.platform });
            return order;
        } catch (error) {
            logger.error('Failed to add order', error);
            throw error;
        }
    }

    /**
     * Get order by ID
     */
    getOrder(orderId) {
        return this.orders.find(order => order.orderId === orderId);
    }

    /**
     * Get all orders
     */
    getAllOrders() {
        return [...this.orders];
    }

    /**
     * Get orders by platform
     */
    getOrdersByPlatform(platform) {
        return this.orders.filter(order => order.platform === platform);
    }

    /**
     * Update order status
     */
    async updateOrderStatus(orderId, status, updates = {}) {
        try {
            const order = this.getOrder(orderId);
            if (!order) {
                throw new Error(`Order not found: ${orderId}`);
            }

            order.status = status;
            Object.assign(order, updates);
            await this.save();

            logger.info('Order status updated', { orderId, status });
            return order;
        } catch (error) {
            logger.error('Failed to update order status', error);
            throw error;
        }
    }

    /**
     * Track order (fetch latest status from platform)
     */
    async trackOrder(orderId) {
        try {
            const order = this.getOrder(orderId);
            if (!order) {
                throw new Error(`Order not found: ${orderId}`);
            }

            logger.info('Tracking order', { orderId, platform: order.platform });

            // This would typically call the platform's API
            // For now, return mock updated status
            const mockStatus = {
                status: 'shipped',
                trackingNumber: 'TRACK123456',
                estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
            };

            await this.updateOrderStatus(orderId, mockStatus.status, mockStatus);
            return order;
        } catch (error) {
            logger.error('Failed to track order', error);
            throw error;
        }
    }

    /**
     * Initiate return
     */
    async initiateReturn(orderId, reason, items = []) {
        try {
            const order = this.getOrder(orderId);
            if (!order) {
                throw new Error(`Order not found: ${orderId}`);
            }

            if (!order.canReturn()) {
                throw new Error(`Order cannot be returned. Current status: ${order.status}`);
            }

            logger.info('Initiating return', { orderId, reason, items });

            // This would typically call the platform's return API
            // For now, update order status
            await this.updateOrderStatus(orderId, 'return_requested', {
                returnReason: reason,
                returnItems: items,
                returnRequestDate: new Date().toISOString(),
            });

            return order;
        } catch (error) {
            logger.error('Failed to initiate return', error);
            throw error;
        }
    }

    /**
     * Cancel order
     */
    async cancelOrder(orderId, reason = '') {
        try {
            const order = this.getOrder(orderId);
            if (!order) {
                throw new Error(`Order not found: ${orderId}`);
            }

            if (!order.canCancel()) {
                throw new Error(`Order cannot be cancelled. Current status: ${order.status}`);
            }

            logger.info('Cancelling order', { orderId, reason });

            // This would typically call the platform's cancel API
            await this.updateOrderStatus(orderId, 'cancelled', {
                cancellationReason: reason,
                cancelledDate: new Date().toISOString(),
            });

            return order;
        } catch (error) {
            logger.error('Failed to cancel order', error);
            throw error;
        }
    }

    /**
     * Create support ticket
     */
    async createSupportTicket(orderId, subject, message) {
        try {
            const order = this.getOrder(orderId);
            if (!order) {
                throw new Error(`Order not found: ${orderId}`);
            }

            const ticket = {
                id: `ticket_${Date.now()}`,
                orderId,
                platform: order.platform,
                subject,
                message,
                status: 'open',
                createdAt: new Date().toISOString(),
            };

            // Save ticket
            const { retailAgentTickets = [] } = await chrome.storage.local.get(['retailAgentTickets']);
            retailAgentTickets.push(ticket);
            await chrome.storage.local.set({ retailAgentTickets });

            logger.info('Support ticket created', { ticketId: ticket.id, orderId });
            return ticket;
        } catch (error) {
            logger.error('Failed to create support ticket', error);
            throw error;
        }
    }
}

// Export singleton instance
export const orderTracker = new OrderTracker();

// Initialize on load
orderTracker.load().catch(error => {
    logger.error('Failed to initialize order tracker', error);
});

