import { NotificationConfig } from "./types";
import { Notification, NotificationFilters, NotificationPreferences, NotificationStats } from './types';
export declare class NotificationApiClient {
    private config;
    private ws?;
    private sse?;
    private wsPromise?;
    private ssePromise?;
    private pollingIntervalId?;
    constructor(config: NotificationConfig);
    private request;
    private parseNotificationDates;
    getNotifications(filters?: NotificationFilters): Promise<Notification[]>;
    getUnreadCount(): Promise<number>;
    getStats(): Promise<NotificationStats>;
    getPreferences(): Promise<NotificationPreferences>;
    markAsRead(notificationId: string): Promise<void>;
    markAllAsRead(): Promise<void>;
    deleteNotification(notificationId: string): Promise<void>;
    deleteAll(): Promise<void>;
    updatePreferences(prefs: Partial<NotificationPreferences>): Promise<void>;
    connectRealtime(onMessage: (data: any) => void): Promise<boolean>;
    connectWebSocket(onMessage: (data: any) => void): Promise<boolean>;
    connectSSE(onMessage: (data: any, isSSE: boolean) => void): Promise<boolean>;
    startPolling(callback: () => Promise<void> | void): void;
    stopPolling(): void;
    disconnectRealtime(): void;
}
