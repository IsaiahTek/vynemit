import * as plivo from 'plivo';
import {
    DeliveryReceipt,
    TransportAdapter,
    ChannelType,
    NotificationPreferences,
    SmsNotification
} from '@vynelix/vynemit-core';

export interface PlivoConfig {
    authId: string;
    authToken: string;
    fromNumber: string;
    debug?: boolean;
}

export class PlivoProvider implements TransportAdapter {
    name: ChannelType = 'sms';
    private client: plivo.Client;

    constructor(private config: PlivoConfig) {
        if (!config.authId || !config.authToken) {
            throw new Error('Plivo Auth ID and Auth Token are required');
        }
        this.client = new plivo.Client(config.authId, config.authToken);
    }

    async send(notification: SmsNotification, preferences: NotificationPreferences): Promise<DeliveryReceipt> {
        try {
            const phoneNumber = this.resolvePhoneNumber(notification, preferences);
            if (!phoneNumber) {
                throw new Error('No phone number found for recipient');
            }

            // Clean phone number (remove +, spaces, etc.)
            const recipient = phoneNumber.replace(/\D/g, '');

            if (this.config.debug) {
                console.log(`[Plivo] Sending SMS to ${recipient}`);
            }

            const response = await this.client.messages.create(
                this.config.fromNumber,
                recipient,
                notification.body,
                {
                    method: 'POST',
                    url: (notification.data?.webhookUrl as string) || undefined
                }
            );

            return {
                notificationId: notification.id,
                channel: this.name,
                status: 'sent',
                attempts: 1,
                lastAttempt: new Date(),
                metadata: { 
                    messageUuid: response.messageUuid,
                    apiId: response.apiId
                }
            };
        } catch (error: any) {
            const errorMessage = error.message || 'Unknown Plivo error';

            if (this.config.debug) {
                console.error(`[Plivo] Failed to send: ${errorMessage}`);
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
            // Check if we can fetch account details
            await this.client.account.get();
            return true;
        } catch (error) {
            if (this.config.debug) {
                console.error('[Plivo] Health check failed', error);
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
