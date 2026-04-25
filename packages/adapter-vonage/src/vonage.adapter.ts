import { Vonage } from '@vonage/server-sdk';
import {
    DeliveryReceipt,
    TransportAdapter,
    ChannelType,
    NotificationPreferences,
    SmsNotification
} from '@vynelix/vynemit-core';

export interface VonageConfig {
    apiKey: string;
    apiSecret: string;
    fromNumber: string;
    debug?: boolean;
}

export class VonageProvider implements TransportAdapter {
    name: ChannelType = 'sms';
    private vonage: Vonage;

    constructor(private config: VonageConfig) {
        if (!config.apiKey || !config.apiSecret) {
            throw new Error('Vonage API Key and Secret are required');
        }
        this.vonage = new Vonage({
            apiKey: config.apiKey,
            apiSecret: config.apiSecret
        } as any);
    }

    async send(notification: SmsNotification, preferences: NotificationPreferences): Promise<DeliveryReceipt> {
        try {
            const phoneNumber = this.resolvePhoneNumber(notification, preferences);
            if (!phoneNumber) {
                throw new Error('No phone number found for recipient');
            }

            // Clean phone number (remove + for Vonage)
            const recipient = phoneNumber.replace(/\+/g, '');

            if (this.config.debug) {
                console.log(`[Vonage] Sending SMS to ${recipient}`);
            }

            const response: any = await this.vonage.sms.send({
                to: recipient,
                from: this.config.fromNumber,
                text: notification.body
            });

            const message = response.messages[0];

            if (message.status !== '0') {
                throw new Error(message['error-text'] || `Vonage error status: ${message.status}`);
            }

            return {
                notificationId: notification.id,
                channel: this.name,
                status: 'sent',
                attempts: 1,
                lastAttempt: new Date(),
                metadata: { 
                    messageId: message['message-id'],
                    remainingBalance: message['remaining-balance']
                }
            };
        } catch (error: any) {
            const errorMessage = error.message || 'Unknown Vonage error';

            if (this.config.debug) {
                console.error(`[Vonage] Failed to send: ${errorMessage}`);
            }

            return {
                notificationId: notification.id,
                channel: this.name,
                status: 'failed',
                attempts: 1,
                lastAttempt: new Date(),
                error: errorMessage
            };
        }
    }

    canSend(notification: SmsNotification, preferences: NotificationPreferences): boolean {
        const phoneNumber = this.resolvePhoneNumber(notification, preferences);
        return !!phoneNumber;
    }

    async healthCheck(): Promise<boolean> {
        try {
            // Check balance as a health check
            await this.vonage.accounts.getBalance();
            return true;
        } catch (error) {
            if (this.config.debug) {
                console.error('[Vonage] Health check failed', error);
            }
            return false;
        }
    }

    private resolvePhoneNumber(notification: SmsNotification, preferences?: NotificationPreferences): string | undefined {
        if (notification.data?.phoneNumber && typeof notification.data.phoneNumber === 'string') {
            return notification.data.phoneNumber;
        }
        if (preferences?.data?.phoneNumber && typeof preferences.data.phoneNumber === 'string') {
            return preferences.data.phoneNumber;
        }
        if (/^\+?[1-9]\d{1,14}$/.test(notification.userId)) {
            return notification.userId;
        }
        return undefined;
    }
}
