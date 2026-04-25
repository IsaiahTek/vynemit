import { DeliveryReceipt, TransportAdapter, ChannelType, NotificationPreferences, EmailNotification } from '@vynelix/vynemit-core';
export interface SendGridConfig {
    apiKey: string;
    fromEmail: string;
    debug?: boolean;
}
export declare class SendGridProvider implements TransportAdapter {
    private config;
    name: ChannelType;
    constructor(config: SendGridConfig);
    send(notification: EmailNotification, preferences: NotificationPreferences): Promise<DeliveryReceipt>;
    sendBatch(notifications: EmailNotification[], preferences: NotificationPreferences): Promise<DeliveryReceipt[]>;
    canSend(notification: EmailNotification, preferences: NotificationPreferences): boolean;
    private resolveEmail;
    private isValidEmail;
    healthCheck(): Promise<boolean>;
}
