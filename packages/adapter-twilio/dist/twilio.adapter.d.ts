import { DeliveryReceipt, TransportAdapter, ChannelType, NotificationPreferences, SmsNotification } from '@vynelix/vynemit-core';
export interface TwilioConfig {
    accountSid: string;
    authToken: string;
    fromNumber: string;
}
export declare class TwilioProvider implements TransportAdapter {
    private config;
    name: ChannelType;
    private client;
    constructor(config: TwilioConfig);
    send(notification: SmsNotification, preferences: NotificationPreferences): Promise<DeliveryReceipt>;
    sendBatch(notifications: SmsNotification[], preferences: NotificationPreferences): Promise<DeliveryReceipt[]>;
    sendMulticast(notifications: SmsNotification[], preferences: NotificationPreferences): Promise<DeliveryReceipt[]>;
    canSend(notification: SmsNotification, preferences: NotificationPreferences): boolean;
    healthCheck(): Promise<boolean>;
    private resolvePhoneNumber;
    private isValidPhoneNumber;
}
