import axios from 'axios';
import {
    DeliveryReceipt,
    TransportAdapter,
    ChannelType,
    NotificationPreferences,
    Notification
} from '@vynelix/vynemit-core';

export interface DiscordConfig {
    webhookUrl?: string; // Global fallback
    username?: string;
    avatarUrl?: string;
    debug?: boolean;
}

export class DiscordProvider implements TransportAdapter {
    name: ChannelType = 'chat';

    constructor(private config: DiscordConfig) {}

    async send(notification: Notification, preferences: NotificationPreferences): Promise<DeliveryReceipt> {
        try {
            const webhookUrl = this.resolveWebhookUrl(notification, preferences);
            if (!webhookUrl) {
                throw new Error('No Discord Webhook URL found for recipient');
            }

            if (this.config.debug) {
                console.log(`[Discord] Sending message to webhook`);
            }

            const payload: any = {
                content: notification.body,
                username: (notification.data?.username as string) || this.config.username,
                avatar_url: (notification.data?.avatarUrl as string) || this.config.avatarUrl,
                embeds: (notification.data?.embeds as any[]) || [
                    {
                        title: notification.title,
                        description: notification.body,
                        color: this.colorToHex(notification.priority)
                    }
                ]
            };

            await axios.post(webhookUrl, payload);

            return {
                notificationId: notification.id,
                channel: this.name,
                status: 'sent',
                attempts: 1,
                lastAttempt: new Date()
            };
        } catch (error: any) {
            const errorMessage = error.message || 'Unknown Discord error';

            if (this.config.debug) {
                console.error(`[Discord] Failed to send: ${errorMessage}`);
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
        const url = this.resolveWebhookUrl(notification, preferences);
        return !!url;
    }

    async healthCheck(): Promise<boolean> {
        if (!this.config.webhookUrl) return true;
        try {
            await axios.get(this.config.webhookUrl);
            return true;
        } catch (error) {
            // Discord webhooks return 200 on GET if they exist
            return false;
        }
    }

    private resolveWebhookUrl(notification: Notification, preferences?: NotificationPreferences): string | undefined {
        if (notification.data?.discordWebhookUrl && typeof notification.data.discordWebhookUrl === 'string') {
            return notification.data.discordWebhookUrl;
        }
        if (preferences?.data?.discordWebhookUrl && typeof preferences.data.discordWebhookUrl === 'string') {
            return preferences.data.discordWebhookUrl;
        }
        // Fallback to userId if it looks like a URL
        if (notification.userId.startsWith('https://discord.com/api/webhooks/')) {
            return notification.userId;
        }
        return this.config.webhookUrl;
    }

    private colorToHex(priority: string): number {
        switch (priority) {
            case 'urgent': return 0xff0000; // Red
            case 'high': return 0xffa500; // Orange
            case 'normal': return 0x00ff00; // Green
            case 'low': return 0x808080; // Gray
            default: return 0x7289da; // Discord Blue
        }
    }
}
