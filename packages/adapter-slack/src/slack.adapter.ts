import { WebClient } from '@slack/web-api';
import {
    DeliveryReceipt,
    TransportAdapter,
    ChannelType,
    NotificationPreferences,
    Notification
} from '@vynelix/vynemit-core';

export interface SlackConfig {
    token: string;
    defaultChannel?: string;
    debug?: boolean;
}

export class SlackProvider implements TransportAdapter {
    name: ChannelType = 'chat';
    private client: WebClient;

    constructor(private config: SlackConfig) {
        if (!config.token) {
            throw new Error('Slack Bot Token is required');
        }
        this.client = new WebClient(config.token);
    }

    async send(notification: Notification, preferences: NotificationPreferences): Promise<DeliveryReceipt> {
        try {
            const channel = this.resolveChannel(notification, preferences);
            if (!channel) {
                throw new Error('No Slack channel found for recipient');
            }

            if (this.config.debug) {
                console.log(`[Slack] Sending message to ${channel}`);
            }

            const response = await this.client.chat.postMessage({
                channel: channel,
                text: notification.body,
                blocks: (notification.data?.blocks as any[]) || [
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `*${notification.title}*\n${notification.body}`
                        }
                    }
                ],
                thread_ts: (notification.data?.threadTs as string) || undefined
            });

            if (!response.ok) {
                throw new Error(response.error || 'Unknown Slack error');
            }

            return {
                notificationId: notification.id,
                channel: this.name,
                status: 'sent',
                attempts: 1,
                lastAttempt: new Date(),
                metadata: { 
                    channel: response.channel,
                    ts: response.ts
                }
            };
        } catch (error: any) {
            const errorMessage = error.message || 'Unknown Slack error';

            if (this.config.debug) {
                console.error(`[Slack] Failed to send: ${errorMessage}`);
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

    canSend(notification: Notification, preferences: NotificationPreferences): boolean {
        const channel = this.resolveChannel(notification, preferences);
        return !!channel;
    }

    async healthCheck(): Promise<boolean> {
        try {
            await this.client.auth.test();
            return true;
        } catch (error) {
            if (this.config.debug) {
                console.error('[Slack] Health check failed', error);
            }
            return false;
        }
    }

    private resolveChannel(notification: Notification, preferences?: NotificationPreferences): string | undefined {
        if (notification.data?.slackChannel && typeof notification.data.slackChannel === 'string') {
            return notification.data.slackChannel;
        }
        if (preferences?.data?.slackChannel && typeof preferences.data.slackChannel === 'string') {
            return preferences.data.slackChannel;
        }
        // Fallback to userId if it looks like a channel ID (starts with C, D, or G)
        if (/^[CDG][A-Z0-9]{8,}$/.test(notification.userId)) {
            return notification.userId;
        }
        return this.config.defaultChannel;
    }
}
