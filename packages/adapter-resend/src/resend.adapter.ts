import { Resend } from 'resend';
import {
    DeliveryReceipt,
    TransportAdapter,
    ChannelType,
    NotificationPreferences,
    EmailNotification
} from '@vynelix/vynemit-core';

export interface ResendConfig {
    apiKey: string;
    fromEmail: string;
    fromName?: string;
    debug?: boolean;
}

export class ResendProvider implements TransportAdapter {
    name: ChannelType = 'email';
    private resend: Resend;

    constructor(private config: ResendConfig) {
        if (!config.apiKey) {
            throw new Error('Resend API Key is required');
        }
        this.resend = new Resend(config.apiKey);
    }

    async send(notification: EmailNotification, preferences: NotificationPreferences): Promise<DeliveryReceipt> {
        try {
            const email = this.resolveEmail(notification, preferences);
            if (!email) {
                throw new Error('No email found for recipient');
            }

            if (this.config.debug) {
                console.log(`[Resend] Sending email to ${email}`);
            }

            const from = this.config.fromName 
                ? `${this.config.fromName} <${this.config.fromEmail}>` 
                : this.config.fromEmail;

            const response = await this.resend.emails.send({
                from: from,
                to: email,
                subject: notification.title,
                html: notification.html || notification.body,
                text: notification.text || notification.body,
                headers: (notification.data?.headers as Record<string, string>) || {},
                tags: (notification.data?.tags as any[]) || []
            });

            return {
                notificationId: notification.id,
                channel: this.name,
                status: 'sent',
                attempts: 1,
                lastAttempt: new Date(),
                metadata: { 
                    messageId: response.id
                }
            };
        } catch (error: any) {
            const errorMessage = error.message || 'Unknown Resend error';

            if (this.config.debug) {
                console.error(`[Resend] Failed to send: ${errorMessage}`);
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

    canSend(notification: EmailNotification, preferences: NotificationPreferences): boolean {
        const email = this.resolveEmail(notification, preferences);
        return !!email;
    }

    async healthCheck(): Promise<boolean> {
        try {
            // Resend doesn't have a simple health check, but we can try to list domains
            // to verify API key validity.
            await this.resend.domains.list();
            return true;
        } catch (error) {
            if (this.config.debug) {
                console.error('[Resend] Health check failed', error);
            }
            return false;
        }
    }

    private resolveEmail(notification: EmailNotification, preferences?: NotificationPreferences): string | undefined {
        if (notification.data?.email && typeof notification.data.email === 'string') {
            return notification.data.email;
        }
        if (preferences?.data?.email && typeof preferences.data.email === 'string') {
            return preferences.data.email;
        }
        // Fallback to userId if it looks like an email
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notification.userId)) {
            return notification.userId;
        }
        return undefined;
    }
}
