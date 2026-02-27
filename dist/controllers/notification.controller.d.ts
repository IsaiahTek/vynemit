import { NotificationsService } from "../services/notification.service";
import { NotificationInput, NotificationPreferences } from '@synq/notifications-core/';
export declare class NotificationsController {
    private readonly notificationsService;
    constructor(notificationsService: NotificationsService);
    health(): Promise<Record<string, boolean>>;
    getNotifications(userId: string, status?: string, type?: string, category?: string, limit?: string, offset?: string): Promise<import("@synq/notifications-core/").Notification[]>;
    getUnreadCount(userId: string): Promise<{
        count: number;
    }>;
    getStats(userId: string): Promise<import("@synq/notifications-core/").NotificationStats>;
    getPreferences(userId: string): Promise<NotificationPreferences>;
    updatePreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<{
        success: boolean;
    }>;
    sendNotification(input: NotificationInput): Promise<import("@synq/notifications-core/").Notification>;
    sendBatch(inputs: NotificationInput[]): Promise<import("@synq/notifications-core/").Notification[]>;
    markAsRead(userId: string, id: string): Promise<{
        success: boolean;
    }>;
    markAllAsRead(userId: string): Promise<{
        success: boolean;
    }>;
    deleteAll(userId: string): Promise<{
        success: boolean;
    }>;
    deleteNotification(userId: string, id: string): Promise<{
        success: boolean;
    }>;
}
