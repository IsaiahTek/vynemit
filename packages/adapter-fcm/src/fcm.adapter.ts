import * as admin from 'firebase-admin';
import { DeliveryReceipt, TransportAdapter, ChannelType, NotificationPreferences, PushNotification } from '@vynelix/vynemit-core';

export class FcmProvider implements TransportAdapter {
    name: ChannelType = 'push';

    constructor(private app?: admin.app.App) {
        if (!this.app && admin.apps.length === 0) {
            throw new Error('Firebase Admin SDK not initialized and no app provided.');
        }
    }

    async send(notification: PushNotification, preferences: NotificationPreferences): Promise<DeliveryReceipt> {
        try {
            const token = this.resolveDeviceToken(notification, preferences);
            if (!token) {
                return {
                    notificationId: notification.id,
                    channel: this.name,
                    status: 'failed',
                    attempts: 1,
                    lastAttempt: new Date(),
                    error: 'No device token found for recipient'
                };
            }

            const message: admin.messaging.Message = {
                token,
                notification: {
                    title: notification.title,
                    body: notification.body,
                },
                data: notification.data as Record<string, string>,
            };

            const response = await (this.app || admin).messaging().send(message);

            return {
                notificationId: notification.id,
                channel: this.name,
                status: 'sent',
                attempts: 1,
                lastAttempt: new Date(),
                metadata: { messageId: response }
            };
        } catch (error) {
            return this.handleError(notification.id, error as Error);
        }
    }

    async sendBatch(notifications: PushNotification[], preferences: NotificationPreferences): Promise<DeliveryReceipt[]> {
        const messages: admin.messaging.Message[] = [];
        const validNotifications: PushNotification[] = [];
        const receipts: DeliveryReceipt[] = [];

        for (const notification of notifications) {
            const token = this.resolveDeviceToken(notification, preferences);
            if (!token) {
                receipts.push({
                    notificationId: notification.id,
                    channel: this.name,
                    status: 'failed',
                    attempts: 1,
                    lastAttempt: new Date(),
                    error: 'No device token found for recipient'
                });
                continue;
            }

            messages.push({
                token,
                notification: {
                    title: notification.title,
                    body: notification.body,
                },
                data: notification.data as Record<string, string>,
            });
            validNotifications.push(notification);
        }

        if (messages.length === 0) {
            return receipts;
        }

        try {
            const batchResponse = await (this.app || admin).messaging().sendEach(messages);

            batchResponse.responses.forEach((res: admin.messaging.SendResponse, index: number) => {
                const notification = validNotifications[index];
                if (res.success) {
                    receipts.push({
                        notificationId: notification.id,
                        channel: this.name,
                        status: 'sent',
                        attempts: 1,
                        lastAttempt: new Date(),
                        metadata: { messageId: res.messageId }
                    });
                } else {
                    receipts.push(this.handleError(notification.id, res.error ?? new Error('Unknown error')));
                }
            });
        } catch (error) {
            // This loop handles the case where the entire batch call fails (e.g. network)
            validNotifications.forEach(notification => {
                receipts.push(this.handleError(notification.id, error as Error));
            });
        }

        return receipts;
    }

    async sendMulticast(notifications: PushNotification[], preferences: NotificationPreferences): Promise<DeliveryReceipt[]> {
        const receipts: DeliveryReceipt[] = [];
        const contentGroups = new Map<string, { notification: admin.messaging.Notification, data?: Record<string, string>, tokens: string[], originalNotifications: PushNotification[] }>();

        for (const notification of notifications) {
            const token = this.resolveDeviceToken(notification, preferences);
            if (!token) {
                receipts.push({
                    notificationId: notification.id,
                    channel: this.name,
                    status: 'failed',
                    attempts: 1,
                    lastAttempt: new Date(),
                    error: 'No device token found for recipient'
                });
                continue;
            }

            // Create a unique key for the notification content to group identical messages
            // Exclude deviceToken from the grouping key as it varies per notification
            const { deviceToken: _, ...groupingData } = notification.data || {};
            const contentKey = JSON.stringify({
                title: notification.title,
                body: notification.body,
                data: groupingData
            });

            if (!contentGroups.has(contentKey)) {
                contentGroups.set(contentKey, {
                    notification: {
                        title: notification.title,
                        body: notification.body,
                    },
                    data: notification.data as Record<string, string>,
                    tokens: [],
                    originalNotifications: []
                });
            }

            const group = contentGroups.get(contentKey)!;
            group.tokens.push(token);
            group.originalNotifications.push(notification);
        }

        if (contentGroups.size === 0) {
            return receipts;
        }

        // Process each group of identical messages
        for (const group of contentGroups.values()) {
            try {
                const message: admin.messaging.MulticastMessage = {
                    tokens: group.tokens,
                    notification: group.notification,
                    data: group.data,
                };

                const batchResponse = await (this.app || admin).messaging().sendEachForMulticast(message);

                batchResponse.responses.forEach((res: admin.messaging.SendResponse, index: number) => {
                    const originalNotif = group.originalNotifications[index];
                    if (res.success) {
                        receipts.push({
                            notificationId: originalNotif.id,
                            channel: this.name,
                            status: 'sent',
                            attempts: 1,
                            lastAttempt: new Date(),
                            metadata: { messageId: res.messageId }
                        });
                    } else {
                        receipts.push(this.handleError(originalNotif.id, res.error ?? new Error('Unknown error')));
                    }
                });
            } catch (error) {
                // Handle entire multicast call failure
                group.originalNotifications.forEach(notif => {
                    receipts.push(this.handleError(notif.id, error as Error));
                });
            }
        }

        return receipts;
    }

    canSend(notification: PushNotification, preferences: NotificationPreferences): boolean {
        const token = this.resolveDeviceToken(notification, preferences);
        return !!token;
    }

    async healthCheck(): Promise<boolean> {
        try {
            // Check if Firebase is initialized
            const app = this.app || admin.app();
            return !!app;
        } catch (error) {
            return false;
        }
    }

    private handleError(notificationId: string, error: Error | admin.FirebaseError): DeliveryReceipt {
        // Here we could add logic to classify errors (e.g. retryable vs non-retryable)
        return {
            notificationId,
            channel: this.name,
            status: 'failed',
            attempts: 1,
            lastAttempt: new Date(),
            error: error.message,
            metadata: { errorCode: (error as any).code }
        };
    }

    private resolveDeviceToken(notification: PushNotification, preferences?: NotificationPreferences): string | undefined {
        // 1. Check notification data
        if (notification.data?.deviceToken && typeof notification.data.deviceToken === 'string') {
            return notification.data.deviceToken;
        }

        // 2. Check preferences data
        if (preferences?.data?.deviceToken && typeof preferences.data.deviceToken === 'string') {
            return preferences.data.deviceToken;
        }

        return undefined;
    }
}
