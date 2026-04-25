import { SESClient, SendEmailCommand, GetIdentityVerificationAttributesCommand } from "@aws-sdk/client-ses";
import {
    DeliveryReceipt,
    TransportAdapter,
    ChannelType,
    NotificationPreferences,
    EmailNotification
} from '@vynelix/vynemit-core';

export interface SESConfig {
    region: string;
    credentials?: {
        accessKeyId: string;
        secretAccessKey: string;
    };
    fromEmail: string;
    debug?: boolean;
}

export class SESProvider implements TransportAdapter {
    name: ChannelType = 'email';
    private client: SESClient;

    constructor(private config: SESConfig) {
        if (!config.region) {
            throw new Error('AWS Region is required for SES');
        }
        
        this.client = new SESClient({
            region: config.region,
            credentials: config.credentials
        });
    }

    async send(notification: EmailNotification, preferences: NotificationPreferences): Promise<DeliveryReceipt> {
        try {
            const email = this.resolveEmail(notification, preferences);
            if (!email) {
                throw new Error('No email found for recipient');
            }

            if (this.config.debug) {
                console.log(`[SES] Sending email to ${email}`);
            }

            const command = new SendEmailCommand({
                Source: this.config.fromEmail,
                Destination: {
                    ToAddresses: [email]
                },
                Message: {
                    Subject: {
                        Data: notification.title,
                        Charset: 'UTF-8'
                    },
                    Body: {
                        Html: notification.html ? {
                            Data: notification.html,
                            Charset: 'UTF-8'
                        } : undefined,
                        Text: {
                            Data: notification.text || notification.body,
                            Charset: 'UTF-8'
                        }
                    }
                },
                ConfigurationSetName: (notification.data?.configurationSetName as string) || undefined
            });

            const response = await this.client.send(command);

            return {
                notificationId: notification.id,
                channel: this.name,
                status: 'sent',
                attempts: 1,
                lastAttempt: new Date(),
                metadata: { 
                    messageId: response.MessageId
                }
            };
        } catch (error: any) {
            const errorMessage = error.message || 'Unknown AWS SES error';

            if (this.config.debug) {
                console.error(`[SES] Failed to send: ${errorMessage}`);
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
            // Check if fromEmail is verified
            const command = new GetIdentityVerificationAttributesCommand({
                Identities: [this.config.fromEmail]
            });
            const response = await this.client.send(command);
            const status = response.VerificationAttributes?.[this.config.fromEmail]?.VerificationStatus;
            
            return status === 'Success';
        } catch (error) {
            if (this.config.debug) {
                console.error('[SES] Health check failed', error);
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
