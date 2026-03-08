// ============================================================================
// NOTIFICATION SERVICE
// ============================================================================

import { Injectable, OnModuleInit, OnModuleDestroy, Logger, InternalServerErrorException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { NotificationCenter, NotificationInput, NotificationMulticastInput, NotificationFilters, NotificationPreferences, NotificationTemplate, Unsubscribe, Notification } from "@notifyc/core";
import { EventEmitter } from "events";
import { NOTIFICATION_CENTER } from "../types/types";
import { getNotificationCenterInstance } from '../module';

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(NotificationsService.name);
    private eventEmitter = new EventEmitter();

    private notificationCenter: NotificationCenter | null = null;

    constructor() {
        this.logger.log('NotificationsService: Constructor called.');
    }

    async onModuleInit() {
        this.logger.log('NotificationsService: onModuleInit called. Retrieving NotificationCenter instance...');

        // Wait a bit to ensure the initialization provider has run
        // This is a safety mechanism
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            this.notificationCenter = getNotificationCenterInstance();
            this.logger.log('NotificationsService: NotificationCenter instance retrieved successfully.');
        } catch (error) {
            this.logger.error('NotificationsService: Failed to get NotificationCenter instance', error);
            throw error;
        }
    }

    async onModuleDestroy() {
        if (this.notificationCenter) {
            await this.notificationCenter.stop();
            this.logger.log('Notification system stopped');
        }
    }

    private getCenter(): NotificationCenter {
        if (!this.notificationCenter) {
            // Fallback: try to get it again
            this.notificationCenter = getNotificationCenterInstance();
        }
        return this.notificationCenter!;
    }

    // ========== EVENT EMITTER (for WebSocket integration) ==========

    onNotificationSent(callback: (notification: Notification) => void): () => void {
        this.eventEmitter.on('notification:sent', callback);
        return () => this.eventEmitter.off('notification:sent', callback);
    }

    onUnreadCountChanged(callback: (userId: string, count: number) => void): () => void {
        this.eventEmitter.on('unread:changed', callback);
        return () => this.eventEmitter.off('unread:changed', callback);
    }

    // ========== SEND OPERATIONS ==========

    async send(input: NotificationInput): Promise<Notification> {
        console.log("🔔 NotificationsService.send() CALLED");
        console.log("📋 Input:", JSON.stringify(input, null, 2));
        this.logger.log("SEND NOTIFICATION TRIGGERED WITH INPUT: ", input);

        let notification: Notification;

        try {
            const center = this.getCenter();
            console.log("✅ NotificationCenter instance obtained");

            notification = await center.send(input);
            console.log("✅ Notification sent successfully:", notification.id);

            // Emit the local event for the WebSocket to pick up
            this.eventEmitter.emit('notification:sent', notification);
            console.log("✅ Event emitted: notification:sent");

        } catch (error: any) {
            const errorMessage = `Failed to send notification via NotificationCenter: ${error.message}`;
            console.error("❌ " + errorMessage, error);
            this.logger.error(errorMessage, error.stack);
            throw new InternalServerErrorException('Notification sending failed.');
        }

        return notification;
    }

    async sendBatch(inputs: NotificationInput[]): Promise<Notification[]> {
        const center = this.getCenter();
        const notifications = await center.sendBatch(inputs);

        notifications.forEach(notification => {
            this.eventEmitter.emit('notification:sent', notification);
        });

        return notifications;
    }

    async multicast(inputs: NotificationMulticastInput): Promise<Notification[]> {
        const center = this.getCenter();
        const notifications = await center.sendMulticast(inputs);

        notifications.forEach(notification => {
            this.eventEmitter.emit('notification:sent', notification);
        });

        return notifications;
    }

    async schedule(input: NotificationInput, when: Date): Promise<string> {
        const center = this.getCenter();
        return center.schedule(input, when);
    }

    // ========== QUERY OPERATIONS ==========

    async getForUser(userId: string, filters?: NotificationFilters): Promise<Notification[]> {
        const center = this.getCenter();
        return center.getForUser(userId, filters);
    }

    async getById(id: string): Promise<Notification | null> {
        const center = this.getCenter();
        return center.getById(id);
    }

    async getUnreadCount(userId: string): Promise<number> {
        const center = this.getCenter();
        return center.getUnreadCount(userId);
    }

    async getStats(userId: string) {
        const center = this.getCenter();
        return center.getStats(userId);
    }

    // ========== STATE OPERATIONS ==========

    async markAsRead(notificationId: string): Promise<void> {
        const center = this.getCenter();
        const notification = await center.getById(notificationId);
        await center.markAsRead(notificationId);

        if (notification) {
            const count = await center.getUnreadCount(notification.userId);
            this.eventEmitter.emit('unread:changed', notification.userId, count);
        }
    }

    async markAsReadForUser(userId: string, notificationId: string): Promise<void> {
        const center = this.getCenter();
        const notification = await center.getById(notificationId);

        if (!notification) {
            throw new NotFoundException('Notification not found.');
        }

        if (String(notification.userId) !== String(userId)) {
            throw new ForbiddenException('Cannot mark another user\'s notification as read.');
        }

        await center.markAsRead(notificationId);
        const count = await center.getUnreadCount(userId);
        this.eventEmitter.emit('unread:changed', userId, count);
    }

    async markAllAsRead(userId: string): Promise<void> {
        const center = this.getCenter();
        await center.markAllAsRead(userId);
        this.eventEmitter.emit('unread:changed', userId, 0);
    }

    async markAsUnreadForUser(userId: string, notificationId: string): Promise<void> {
        const center = this.getCenter();
        const notification = await center.getById(notificationId);

        if (!notification) {
            throw new NotFoundException('Notification not found.');
        }

        if (String(notification.userId) !== String(userId)) {
            throw new ForbiddenException('Cannot mark another user\'s notification as unread.');
        }

        await center.markAsUnread(notificationId);
        const count = await center.getUnreadCount(userId);
        this.eventEmitter.emit('unread:changed', userId, count);
    }

    async markAllAsUnread(userId: string): Promise<void> {
        const center = this.getCenter();
        await center.markAllAsUnread(userId);
        this.eventEmitter.emit('unread:changed', userId, 0);
    }

    async delete(notificationId: string): Promise<void> {
        const center = this.getCenter();
        return center.delete(notificationId);
    }

    async deleteForUser(userId: string, notificationId: string): Promise<void> {
        const center = this.getCenter();
        const notification = await center.getById(notificationId);

        if (!notification) {
            throw new NotFoundException('Notification not found.');
        }

        if (String(notification.userId) !== String(userId)) {
            throw new ForbiddenException('Cannot delete another user\'s notification.');
        }

        await center.delete(notificationId);
        const count = await center.getUnreadCount(userId);
        this.eventEmitter.emit('unread:changed', userId, count);
    }

    async deleteAll(userId: string): Promise<void> {
        const center = this.getCenter();
        return center.deleteAll(userId);
    }

    // ========== PREFERENCES ==========

    async getPreferences(userId: string): Promise<NotificationPreferences> {
        const center = this.getCenter();
        return center.getPreferences(userId);
    }

    async updatePreferences(userId: string, prefs: Partial<NotificationPreferences>): Promise<void> {
        const center = this.getCenter();
        return center.updatePreferences(userId, prefs);
    }

    // ========== TEMPLATES ==========

    registerTemplate(template: NotificationTemplate): void {
        const center = this.getCenter();
        center.registerTemplate(template);
    }

    // ========== SUBSCRIPTIONS ==========

    subscribe(userId: string, callback: (notification: Notification) => void): Unsubscribe {
        const center = this.getCenter();
        return center.subscribe(userId, callback);
    }

    onUnreadCountChange(userId: string, callback: (count: number, userId: string) => void): Unsubscribe {
        const center = this.getCenter();
        return center.onUnreadCountChange(userId, callback);
    }

    // ========== HEALTH ==========

    async healthCheck() {
        const center = this.getCenter();
        return center.healthCheck();
    }
}
