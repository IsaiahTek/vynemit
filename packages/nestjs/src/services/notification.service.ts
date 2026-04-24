// ============================================================================
// NOTIFICATION SERVICE
// ============================================================================

import { Injectable, OnModuleInit, OnModuleDestroy, Logger, InternalServerErrorException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { NotificationCenter, NotificationInput, NotificationMulticastInput, NotificationFilters, NotificationPreferences, NotificationTemplate, Unsubscribe, Notification } from "@vynelix/vynemit-core";
import { EventEmitter } from "events";
import { NOTIFICATION_CENTER } from "../types/types";
import { getNotificationCenterInstance } from '../module';

/**
 * A NestJS injectable service that wraps the @vynelix/vynemit-core NotificationCenter.
 * It provides methods for sending, scheduling, querying, and managing notifications within a NestJS application.
 */
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

    /**
     * Safely retrieves the underlying NotificationCenter instance.
     * @private
     */
    private getCenter(): NotificationCenter {
        if (!this.notificationCenter) {
            // Fallback: try to get it again
            this.notificationCenter = getNotificationCenterInstance();
        }
        return this.notificationCenter!;
    }

    // ========== EVENT EMITTER (for WebSocket integration) ==========

    /**
     * Subscribes to the internal `notification:sent` event.
     * This is primarily used by the WebSocket Gateway to push updates to connected clients.
     * 
     * @param callback Function executed when a notification is successfully sent.
     * @returns A function to remove the listener.
     */
    onNotificationSent(callback: (notification: Notification) => void): () => void {
        this.eventEmitter.on('notification:sent', callback);
        return () => this.eventEmitter.off('notification:sent', callback);
    }

    /**
     * Subscribes to the internal `unread:changed` event.
     * Triggered when a user's unread count changes (e.g. after a message is read or deleted).
     * 
     * @param callback Function executed with the updated unread count and user ID.
     * @returns A function to remove the listener.
     */
    onUnreadCountChanged(callback: (userId: string, count: number) => void): () => void {
        this.eventEmitter.on('unread:changed', callback);
        return () => this.eventEmitter.off('unread:changed', callback);
    }

    // ========== SEND OPERATIONS ==========

    /**
     * Dispatches a single notification to a user.
     * 
     * @param input The notification payload and configuration.
     * @returns A promise resolving to the dispatched Notification object.
     * @throws InternalServerErrorException if the send operation fails.
     */
    async send(input: NotificationInput): Promise<Notification> {
        let notification: Notification;

        try {
            const center = this.getCenter();

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

    /**
     * Sends multiple distinct notifications in a single batch operation.
     * 
     * @param inputs An array of notification payload inputs.
     * @returns A promise resolving to an array of dispatched Notification objects.
     */
    async sendBatch(inputs: NotificationInput[]): Promise<Notification[]> {
        const center = this.getCenter();
        const notifications = await center.sendBatch(inputs);

        notifications.forEach(notification => {
            this.eventEmitter.emit('notification:sent', notification);
        });

        return notifications;
    }

    /**
     * Multicasts a single identical notification out to multiple target users.
     * Automatically uses optimized bulk delivery endpoints for Push and SMS routes if available.
     * 
     * @param inputs The multicast notification payload containing an array of user IDs.
     * @returns A promise resolving to an array of dispatched Notification objects.
     */
    async multicast(inputs: NotificationMulticastInput): Promise<Notification[]> {
        const center = this.getCenter();
        const notifications = await center.sendMulticast(inputs);

        notifications.forEach(notification => {
            this.eventEmitter.emit('notification:sent', notification);
        });

        return notifications;
    }

    /**
     * Schedules a notification for delivery at a future date and time.
     * 
     * @param input The notification payload.
     * @param when A Date object specifying when it should be sent.
     * @returns A promise resolving to the generated Notification ID.
     */
    async schedule(input: NotificationInput, when: Date): Promise<string> {
        const center = this.getCenter();
        return center.schedule(input, when);
    }

    // ========== QUERY OPERATIONS ==========

    /**
     * Retrieves the notification history for a specific user.
     * 
     * @param userId The unique user ID to query.
     * @param filters Optional filtering parameters (e.g., limit, offset, status).
     * @returns A promise resolving to an array of related Notification objects.
     */
    async getForUser(userId: string, filters?: NotificationFilters): Promise<Notification[]> {
        const center = this.getCenter();
        return center.getForUser(userId, filters);
    }

    /**
     * Retrieves a notification by its unique ID.
     * 
     * @param id The notification ID.
     * @returns A promise resolving to the Notification or null if not found.
     */
    async getById(id: string): Promise<Notification | null> {
        const center = this.getCenter();
        return center.getById(id);
    }

    /**
     * Gets the total count of unread notifications for a specific user.
     * 
     * @param userId The unique user ID to query.
     * @returns A promise resolving to the unread count integer.
     */
    async getUnreadCount(userId: string): Promise<number> {
        const center = this.getCenter();
        return center.getUnreadCount(userId);
    }

    /**
     * Computes statistics describing a user's notification history (e.g. breakdown by channel and status).
     * 
     * @param userId The unique user ID to compile stats for.
     * @returns A promise resolving to a NotificationStats object.
     */
    async getStats(userId: string) {
        const center = this.getCenter();
        return center.getStats(userId);
    }

    // ========== STATE OPERATIONS ==========

    /**
     * Marks a specific notification as "read" and bypasses ownership checks.
     * Use sparingly; typically endpoints should use `markAsReadForUser` instead for security.
     * 
     * @param notificationId The ID of the notification to update.
     */
    async markAsRead(notificationId: string): Promise<void> {
        const center = this.getCenter();
        const notification = await center.getById(notificationId);
        await center.markAsRead(notificationId);

        if (notification) {
            const count = await center.getUnreadCount(notification.userId);
            this.eventEmitter.emit('unread:changed', notification.userId, count);
        }
    }

    /**
     * Marks a specific notification as "read", strictly validating that it belongs to the given user.
     * 
     * @param userId The user ID requesting the update.
     * @param notificationId The ID of the notification.
     * @throws NotFoundException if the notification does not exist.
     * @throws ForbiddenException if the user doesn't own the notification.
     */
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

    /**
     * Marks all notifications belonging to a specific user as "read".
     * 
     * @param userId The target user ID.
     */
    async markAllAsRead(userId: string): Promise<void> {
        const center = this.getCenter();
        await center.markAllAsRead(userId);
        this.eventEmitter.emit('unread:changed', userId, 0);
    }

    /**
     * Reverts a notification belonging to a specific user to "unread" status.
     * 
     * @param userId The user ID requesting the update.
     * @param notificationId The ID of the notification.
     * @throws NotFoundException if the notification does not exist.
     * @throws ForbiddenException if the user doesn't own the notification.
     */
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

    /**
     * Marks all notifications belonging to a specific user as "unread".
     * 
     * @param userId The target user ID.
     */
    async markAllAsUnread(userId: string): Promise<void> {
        const center = this.getCenter();
        await center.markAllAsUnread(userId);
        this.eventEmitter.emit('unread:changed', userId, 0);
    }

    /**
     * Deletes a given notification from storage bypassing ownership checks.
     * 
     * @param notificationId The ID of the notification to delete.
     */
    async delete(notificationId: string): Promise<void> {
        const center = this.getCenter();
        return center.delete(notificationId);
    }

    /**
     * Deletes a given notification, strictly validating that it belongs to the given user.
     * 
     * @param userId The user ID requesting the deletion.
     * @param notificationId The ID of the notification.
     * @throws NotFoundException if the notification does not exist.
     * @throws ForbiddenException if the user doesn't own the notification.
     */
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

    /**
     * Deletes all notifications for a specific user.
     * 
     * @param userId The target user ID.
     */
    async deleteAll(userId: string): Promise<void> {
        const center = this.getCenter();
        return center.deleteAll(userId);
    }

    // ========== PREFERENCES ==========

    /**
     * Fetches the opt-in and delivery routing preferences for a given user.
     * 
     * @param userId The target user ID.
     * @returns A promise resolving to a NotificationPreferences object.
     */
    async getPreferences(userId: string): Promise<NotificationPreferences> {
        const center = this.getCenter();
        return center.getPreferences(userId);
    }

    /**
     * Updates the delivery routing or channel opt-out preferences for a given user.
     * 
     * @param userId The target user ID.
     * @param prefs The partial preferences payload to update.
     */
    async updatePreferences(userId: string, prefs: Partial<NotificationPreferences>): Promise<void> {
        const center = this.getCenter();
        return center.updatePreferences(userId, prefs);
    }

    // ========== TEMPLATES ==========

    /**
     * Registers a new notification template for centralized copy and defaults.
     * 
     * @param template The template configuration.
     */
    registerTemplate(template: NotificationTemplate): void {
        const center = this.getCenter();
        center.registerTemplate(template);
    }

    // ========== SUBSCRIPTIONS ==========

    /**
     * Registers an internal observer function to be called whenever `userId` is sent a notification directly via the core.
     * 
     * @param userId The target user to observe.
     * @param callback The handler to execute when a notification fires.
     * @returns Unsubscribe function.
     */
    subscribe(userId: string, callback: (notification: Notification) => void): Unsubscribe {
        const center = this.getCenter();
        return center.subscribe(userId, callback);
    }

    /**
     * Registers an internal observer function to be called whenever `userId`'s unread count ticks.
     * 
     * @param userId The target user to observe.
     * @param callback The handler to execute receiving the new unread count.
     * @returns Unsubscribe function.
     */
    onUnreadCountChange(userId: string, callback: (count: number, userId: string) => void): Unsubscribe {
        const center = this.getCenter();
        return center.onUnreadCountChange(userId, callback);
    }

    // ========== HEALTH ==========

    /**
     * Pings the internal core center and its registered transports to evaluate systems readiness.
     * 
     * @returns A promise resolving to a dictionary indicating health per-channel/transport.
     */
    async healthCheck() {
        const center = this.getCenter();
        return center.healthCheck();
    }
}
