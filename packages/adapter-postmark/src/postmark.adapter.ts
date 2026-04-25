import * as postmark from 'postmark';
import {
    DeliveryReceipt,
    TransportAdapter,
    ChannelType,
    NotificationPreferences,
    EmailNotification
} from '@vynelix/vynemit-core';

export interface PostmarkConfig {
    serverToken: string;
    fromEmail: string;
    debug?: boolean;
}

export class PostmarkProvider implements TransportAdapter {
    name: ChannelType = 'email';
    private client: postmark.ServerClient;

    constructor(private config: PostmarkConfig) {
        if (!config.serverToken) {
            throw new Error('Postmark Server Token is required');
        }
        this.client = new postmark.ServerClient(config.serverToken);
    }

    async send(notification: EmailNotification, preferences: NotificationPreferences): Promise<DeliveryReceipt> {
        try {
            const email = this.resolveEmail(notification, preferences);
            if (!email) {
                throw new Error('No email found for recipient');
            }

            if (this.config.debug) {
                console.log(`[Postmark] Sending email to ${email}`);
            }

            const response = await this.client.sendEmail({
                From: this.config.fromEmail,
                To: email,
                Subject: notification.title,
                HtmlBody: notification.html || notification.body,
                TextBody: notification.text || notification.body,
                Metadata: (notification.data?.metadata as Record<string, string>) || {},
                Tag: (notification.data?.tag as string) || undefined
            });

            return {
                notificationId: notification.id,
                channel: this.name,
                status: 'sent',
                attempts: 1,
                lastAttempt: new Date(),
                metadata: { 
                    messageId: response.MessageID,
                    errorCode: response.ErrorCode
                }
            };
        } catch (error: any) {
            const errorMessage = error.message || 'Unknown Postmark error';

            if (this.config.debug) {
                console.error(`[Postmark] Failed to send: ${errorMessage}`);
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
            // Check if we can fetch server info
            await this.client.getServer();
            return true;
        } catch (error) {
            if (this.config.debug) {
                console.error('[Postmark] Health check failed', error);
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
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notification.userId)) {
            return notification.userId;
        }
        return undefined;
    }
}
