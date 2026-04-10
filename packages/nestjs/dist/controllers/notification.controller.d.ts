import { MessageEvent } from "@nestjs/common";
import { Observable } from "rxjs";
type RequestLike = {
    once(event: 'close', listener: () => void): void;
    removeListener(event: 'close', listener: () => void): void;
};
import { NotificationsService } from "../services/notification.service";
import { NotificationInput, NotificationPreferences } from '@vynelix/vynemit-core/';
export declare class NotificationsController {
    private readonly notificationsService;
    constructor(notificationsService: NotificationsService);
    health(): Promise<Record<string, boolean>>;
    streamNotifications(userId: string, req: RequestLike): Observable<MessageEvent>;
    getNotifications(userId: string, status?: string, type?: string, category?: string, limit?: string, offset?: string): Promise<import("@vynelix/vynemit-core/").Notification[]>;
    getUnreadCount(userId: string): Promise<{
        count: number;
    }>;
    getStats(userId: string): Promise<import("@vynelix/vynemit-core/").NotificationStats>;
    getPreferences(userId: string): Promise<NotificationPreferences>;
    updatePreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<{
        success: boolean;
    }>;
    sendNotification(input: NotificationInput): Promise<import("@vynelix/vynemit-core/").Notification>;
    sendBatch(inputs: NotificationInput[]): Promise<import("@vynelix/vynemit-core/").Notification[]>;
    markAsRead(userId: string, id: string): Promise<{
        success: boolean;
    }>;
    markAllAsRead(userId: string): Promise<{
        success: boolean;
    }>;
    markAsUnread(userId: string, id: string): Promise<{
        success: boolean;
    }>;
    markAllAsUnread(userId: string): Promise<{
        success: boolean;
    }>;
    deleteAll(userId: string): Promise<{
        success: boolean;
    }>;
    deleteNotification(userId: string, id: string): Promise<{
        success: boolean;
    }>;
}
export {};
