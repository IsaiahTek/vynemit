import axios from 'axios';
import {
    DeliveryReceipt,
    TransportAdapter,
    ChannelType,
    NotificationPreferences,
    Notification
} from '@vynelix/vynemit-core';

export interface TelegramConfig {
    token: string;
    defaultChatId?: string | number;
    parseMode?: 'MarkdownV2' | 'HTML' | 'Markdown';
    debug?: boolean;
}

export class TelegramProvider implements TransportAdapter {
    name: ChannelType = 'chat';
    private baseUrl: string;

    constructor(private config: TelegramConfig) {
        if (!config.token) {
            throw new Error('Telegram Bot Token is required');
        }
        this.baseUrl = `https://api.telegram.org/bot${config.token}/sendMessage`;
    }

    async send(notification: Notification, preferences: NotificationPreferences): Promise<DeliveryReceipt> {
        try {
            const chatId = this.resolveChatId(notification, preferences);
            if (!chatId) {
                throw new Error('No Telegram Chat ID found for recipient');
            }

            if (this.config.debug) {
                console.log(`[Telegram] Sending message to ${chatId}`);
            }

            const text = `*${notification.title}*\n\n${notification.body}`;

            const payload: any = {
                chat_id: chatId,
                text: text,
                parse_mode: this.config.parseMode || 'Markdown',
                disable_web_page_preview: notification.data?.disablePreview || false,
                reply_markup: notification.data?.replyMarkup || undefined
            };

            const response = await axios.post(this.baseUrl, payload);

            if (!response.data.ok) {
                throw new Error(response.data.description || 'Unknown Telegram error');
            }

            return {
                notificationId: notification.id,
                channel: this.name,
                status: 'sent',
                attempts: 1,
                lastAttempt: new Date(),
                metadata: { 
                    messageId: response.data.result.message_id,
                    chatId: response.data.result.chat.id
                }
            };
        } catch (error: any) {
            const errorMessage = error.response?.data?.description || error.message || 'Unknown Telegram error';

            if (this.config.debug) {
                console.error(`[Telegram] Failed to send: ${errorMessage}`);
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
        const id = this.resolveChatId(notification, preferences);
        return !!id;
    }

    async healthCheck(): Promise<boolean> {
        try {
            const url = `https://api.telegram.org/bot${this.config.token}/getMe`;
            const response = await axios.get(url);
            return response.data.ok;
        } catch (error) {
            if (this.config.debug) {
                console.error('[Telegram] Health check failed', error);
            }
            return false;
        }
    }

    private resolveChatId(notification: Notification, preferences?: NotificationPreferences): string | number | undefined {
        if (notification.data?.telegramChatId) {
            return notification.data.telegramChatId as string | number;
        }
        if (preferences?.data?.telegramChatId) {
            return preferences.data.telegramChatId as string | number;
        }
        // Fallback to userId if it looks like a numeric ID or a @username
        if (/^-?\d+$/.test(notification.userId) || notification.userId.startsWith('@')) {
            return notification.userId;
        }
        return this.config.defaultChatId;
    }
}
