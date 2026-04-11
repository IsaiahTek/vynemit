import { Twilio } from 'twilio';
import {
    DeliveryReceipt,
    TransportAdapter,
    ChannelType,
    NotificationPreferences,
    SmsNotification
} from '@vynelix/vynemit-core';

export interface TwilioConfig {
    accountSid: string;
    authToken: string;
    fromNumber: string;
}

export class TwilioProvider implements TransportAdapter {
    name: ChannelType = 'sms';
    private client: Twilio;

    constructor(private config: TwilioConfig) {
        this.client = new Twilio(config.accountSid, config.authToken);
    }

    async send(notification: SmsNotification, preferences: NotificationPreferences): Promise<DeliveryReceipt> {
        try {
            const phoneNumber = this.resolvePhoneNumber(notification, preferences);
            if (!phoneNumber) {
                return {
                    notificationId: notification.id,
                    channel: this.name,
                    status: 'failed',
                    attempts: 1,
                    lastAttempt: new Date(),
                    error: 'No phone number found for recipient'
                };
            }

            const message = await this.client.messages.create({
                body: notification.body,
                from: this.config.fromNumber,
                to: phoneNumber
            });

            return {
                notificationId: notification.id,
                channel: this.name,
                status: 'sent',
                attempts: 1,
                lastAttempt: new Date(),
                metadata: { messageSid: message.sid }
            };
        } catch (error) {
            return {
                notificationId: notification.id,
                channel: this.name,
                status: 'failed',
                attempts: 1,
                lastAttempt: new Date(),
                error: (error as Error).message
            };
        }
    }

    async sendBatch(notifications: SmsNotification[], preferences: NotificationPreferences): Promise<DeliveryReceipt[]> {
        // Twilio doesn't have a native "batch" API like FCM's sendEach, 
        // but we can parallelize requests.
        return Promise.all(
            notifications.map(notification => this.send(notification, preferences))
        );
    }

    async sendMulticast(notifications: SmsNotification[], preferences: NotificationPreferences): Promise<DeliveryReceipt[]> {
        // For SMS, we'll just use sendBatch as there's no native multicast
        return this.sendBatch(notifications, preferences);
    }

    canSend(notification: SmsNotification, preferences: NotificationPreferences): boolean {
        const phoneNumber = this.resolvePhoneNumber(notification, preferences);
        return !!phoneNumber;
    }

    async healthCheck(): Promise<boolean> {
        try {
            // Simple check to see if we can access the account
            await this.client.api.accounts(this.config.accountSid).fetch();
            return true;
        } catch (error) {
            return false;
        }
    }

    private resolvePhoneNumber(notification: SmsNotification, preferences?: NotificationPreferences): string | undefined {
        // 1. Check notification data
        if (notification.data?.phoneNumber && typeof notification.data.phoneNumber === 'string') {
            return notification.data.phoneNumber;
        }

        // 2. Check preferences data
        if (preferences?.data?.phoneNumber && typeof preferences.data.phoneNumber === 'string') {
            return preferences.data.phoneNumber;
        }

        // 3. Check if userId looks like a phone number
        if (this.isValidPhoneNumber(notification.userId)) {
            return notification.userId;
        }

        return undefined;
    }

    private isValidPhoneNumber(phone: string): boolean {
        // Basic check for E.164-ish format
        return /^\+?[1-9]\d{1,14}$/.test(phone);
    }
}
