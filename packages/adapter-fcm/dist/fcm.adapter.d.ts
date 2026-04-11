import * as admin from 'firebase-admin';
import { DeliveryReceipt, TransportAdapter, ChannelType, NotificationPreferences, PushNotification } from '@vynelix/vynemit-core';
export declare class FcmProvider implements TransportAdapter {
    private app?;
    name: ChannelType;
    constructor(app?: admin.app.App | undefined);
    send(notification: PushNotification, preferences: NotificationPreferences): Promise<DeliveryReceipt>;
    sendBatch(notifications: PushNotification[], preferences: NotificationPreferences): Promise<DeliveryReceipt[]>;
    sendMulticast(notifications: PushNotification[], preferences: NotificationPreferences): Promise<DeliveryReceipt[]>;
    canSend(notification: PushNotification, preferences: NotificationPreferences): boolean;
    healthCheck(): Promise<boolean>;
    private handleError;
    private resolveDeviceToken;
}
