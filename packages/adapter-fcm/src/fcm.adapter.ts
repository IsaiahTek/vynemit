import * as admin from 'firebase-admin';
import { DeliveryReceipt, TransportAdapter, ChannelType, NotificationPreferences, PushNotification } from '@vynelix/vynemit-core';

export interface FcmConfig {
    messaging?: admin.messaging.Messaging;
    debug?: boolean;
}

export class FcmProvider implements TransportAdapter {
    name: ChannelType = 'push';
    private messaging?: admin.messaging.Messaging;

    constructor(private config?: FcmConfig | admin.messaging.Messaging) {
        if (config && (config as any).send) {
            // Backward compatibility for passing admin.messaging() directly
            this.messaging = config as admin.messaging.Messaging;
            this.config = { messaging: this.messaging };
        } else if (config) {
            this.config = config as FcmConfig;
            this.messaging = (config as FcmConfig).messaging;
        }

        if (!this.messaging && admin.apps.length === 0) {
            throw new Error('Firebase Admin SDK not initialized and no app provided.');
        }

        if (this.config && (this.config as FcmConfig).debug) {
            console.log('[FCM] Provider initialized');
        }
    }

    private get isDebug(): boolean {
        return !!(this.config && (this.config as FcmConfig).debug);
    }

    async send(notification: PushNotification, preferences: NotificationPreferences): Promise<DeliveryReceipt> {
        try {
            const token = this.resolveDeviceToken(notification, preferences);
            if (!token) {
                if (this.isDebug) {
                    console.warn(`[FCM] No device token found for notification: ${notification.id}`);
                }
                return {
                    notificationId: notification.id,
                    channel: this.name,
                    status: 'failed',
                    attempts: 1,
                    lastAttempt: new Date(),
                    error: 'No device token found for recipient'
                };
            }

            if (this.isDebug) {
                console.log(`[FCM] Sending push to ${token.substring(0, 10)}...`);
            }

            const message: admin.messaging.Message = {
                token,
                notification: {
                    title: notification.title,
                    body: notification.body,
                },
                data: notification.data as Record<string, string>,
            };

            const messaging = this.messaging || admin.messaging();
            const response = await messaging.send(message);

            if (this.isDebug) {
                console.log(`[FCM] Push sent successfully: ${response}`);
            }

            return {
                notificationId: notification.id,
                channel: this.name,
                status: 'sent',
                attempts: 1,
                lastAttempt: new Date(),
                metadata: { messageId: response }
            };
        } catch (error) {
            if (this.isDebug) {
                console.error(`[FCM] Failed to send push: ${(error as Error).message}`);
            }
            return this.handleError(notification.id, error as Error);
        }
    }

    async sendBatch(notifications: PushNotification[], preferences: NotificationPreferences): Promise<DeliveryReceipt[]> {
        const messages: admin.messaging.Message[] = [];
        const validNotifications: PushNotification[] = [];
        const receipts: DeliveryReceipt[] = [];

        if (this.isDebug) {
            console.log(`[FCM] Processing batch of ${notifications.length} notifications`);
        }

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
            const messaging = this.messaging || admin.messaging();
            const batchResponse = await messaging.sendEach(messages);

            if (this.isDebug) {
                console.log(`[FCM] Batch sent: ${batchResponse.successCount} success, ${batchResponse.failureCount} failure`);
            }

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
            if (this.isDebug) {
                console.error(`[FCM] Batch call failed: ${(error as Error).message}`);
            }
            validNotifications.forEach(notification => {
                receipts.push(this.handleError(notification.id, error as Error));
            });
        }

        return receipts;
    }

    async sendMulticast(notifications: PushNotification[], preferences: NotificationPreferences): Promise<DeliveryReceipt[]> {
        const receipts: DeliveryReceipt[] = [];
        const contentGroups = new Map<string, { notification: admin.messaging.Notification, data?: Record<string, string>, tokens: string[], originalNotifications: PushNotification[] }>();

        if (this.isDebug) {
            console.log(`[FCM] Processing multicast for ${notifications.length} notifications`);
        }

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

        const messaging = this.messaging || admin.messaging();

        for (const group of contentGroups.values()) {
            try {
                if (this.isDebug) {
                    console.log(`[FCM] Sending multicast group to ${group.tokens.length} tokens`);
                }
                const message: admin.messaging.MulticastMessage = {
                    tokens: group.tokens,
                    notification: group.notification,
                    data: group.data,
                };

                const batchResponse = await messaging.sendEachForMulticast(message);

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
                if (this.isDebug) {
                    console.error(`[FCM] Multicast group failed: ${(error as Error).message}`);
                }
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
            const messaging = this.messaging || admin.messaging();
            return !!messaging;
        } catch (error) {
            if (this.isDebug) {
                console.error(`[FCM] Health check failed: ${(error as Error).message}`);
            }
            return false;
        }
    }

    private handleError(notificationId: string, error: Error | admin.FirebaseError): DeliveryReceipt {
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
        if (notification.data?.deviceToken && typeof notification.data.deviceToken === 'string') {
            return notification.data.deviceToken;
        }

        if (preferences?.data?.deviceToken && typeof preferences.data.deviceToken === 'string') {
            return preferences.data.deviceToken;
        }

        return undefined;
    }
}
