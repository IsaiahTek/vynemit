import axios from 'axios';
import {
    DeliveryReceipt,
    TransportAdapter,
    ChannelType,
    NotificationPreferences,
    WhatsAppNotification
} from '@vynelix/vynemit-core';

export interface WhatsAppConfig {
    accessToken: string;
    phoneNumberId: string;
    version?: string;
    debug?: boolean;
}

export class WhatsAppProvider implements TransportAdapter {
    name: ChannelType = 'whatsapp';
    private baseUrl: string;

    constructor(private config: WhatsAppConfig) {
        if (!config.accessToken || !config.phoneNumberId) {
            throw new Error('WhatsApp Access Token and Phone Number ID are required');
        }
        const version = config.version || 'v17.0';
        this.baseUrl = `https://graph.facebook.com/${version}/${config.phoneNumberId}/messages`;
    }

    async send(notification: WhatsAppNotification, preferences: NotificationPreferences): Promise<DeliveryReceipt> {
        try {
            const phoneNumber = this.resolvePhoneNumber(notification, preferences);
            if (!phoneNumber) {
                throw new Error('No phone number found for recipient');
            }

            // Clean phone number (remove +, spaces, etc. - Meta expects digits only)
            const recipient = phoneNumber.replace(/\D/g, '');

            let payload: any;

            // Check if it's a template message
            if (notification.data?.template) {
                payload = {
                    messaging_product: 'whatsapp',
                    to: recipient,
                    type: 'template',
                    template: {
                        name: notification.data.template.name,
                        language: {
                            code: notification.data.template.language || 'en_US'
                        },
                        components: notification.data.template.components || []
                    }
                };
            } else {
                // Default to session/text message
                payload = {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: recipient,
                    type: 'text',
                    text: {
                        preview_url: false,
                        body: notification.body
                    }
                };
            }

            if (this.config.debug) {
                console.log(`[WhatsApp] Sending message to ${recipient}`, JSON.stringify(payload, null, 2));
            }

            const response = await axios.post(this.baseUrl, payload, {
                headers: {
                    'Authorization': `Bearer ${this.config.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            return {
                notificationId: notification.id,
                channel: this.name,
                status: 'sent',
                attempts: 1,
                lastAttempt: new Date(),
                metadata: {
                    messageId: response.data.messages?.[0]?.id,
                    contacts: response.data.contacts
                }
            };
        } catch (error: any) {
            const errorMessage = error.response?.data?.error?.message || error.message || 'Unknown WhatsApp error';
            const errorDetails = error.response?.data?.error || {};

            if (this.config.debug) {
                console.error(`[WhatsApp] Failed to send: ${errorMessage}`, JSON.stringify(errorDetails, null, 2));
            }

            return {
                notificationId: notification.id,
                channel: this.name,
                status: 'failed',
                attempts: 1,
                lastAttempt: new Date(),
                error: errorMessage,
                metadata: { errorDetails }
            };
        }
    }

    canSend(notification: WhatsAppNotification, preferences: NotificationPreferences): boolean {
        const phoneNumber = this.resolvePhoneNumber(notification, preferences);
        return !!phoneNumber;
    }

    async healthCheck(): Promise<boolean> {
        try {
            // We can't easily check auth without sending a message, 
            // but we can try to fetch the phone number details.
            const url = `https://graph.facebook.com/${this.config.version || 'v17.0'}/${this.config.phoneNumberId}`;
            await axios.get(url, {
                headers: { 'Authorization': `Bearer ${this.config.accessToken}` }
            });
            return true;
        } catch (error) {
            if (this.config.debug) {
                console.error('[WhatsApp] Health check failed', error);
            }
            return false;
        }
    }

    private resolvePhoneNumber(notification: WhatsAppNotification, preferences?: NotificationPreferences): string | undefined {
        if (notification.data?.phoneNumber && typeof notification.data.phoneNumber === 'string') {
            return notification.data.phoneNumber;
        }
        if (preferences?.data?.phoneNumber && typeof preferences.data.phoneNumber === 'string') {
            return preferences.data.phoneNumber;
        }
        // Fallback to userId if it looks like a phone number
        if (/^\+?[1-9]\d{1,14}$/.test(notification.userId)) {
            return notification.userId;
        }
        return undefined;
    }
}
