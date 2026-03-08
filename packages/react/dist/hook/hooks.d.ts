import { markAsRead, markAllAsRead, deleteNotification, deleteAll, fetchNotifications, updatePreferences, markAsUnread, markAllAsUnread } from '../actions';
import { NotificationFilters, NotificationState } from '../types';
/**
 * Main hook for notifications with optional filtering
 */
export declare function useNotifications(filters?: NotificationFilters): {
    notifications: import("../types").Notification[];
    unreadCount: number;
    loading: boolean;
    error: string;
    isConnected: boolean;
    markAsRead: typeof markAsRead;
    markAllAsRead: typeof markAllAsRead;
    markAsUnread: typeof markAsUnread;
    markAllAsUnread: typeof markAllAsUnread;
    deleteNotification: typeof deleteNotification;
    deleteAll: typeof deleteAll;
    refresh: typeof fetchNotifications;
};
/**
 * Optimized hook for just unread count (only re-renders when count changes)
 */
export declare function useUnreadCount(): number;
/**
 * Hook for notification stats
 */
export declare function useNotificationStats(): import("../types").NotificationStats;
/**
 * Hook for user preferences
 */
export declare function useNotificationPreferences(): {
    preferences: import("../types").NotificationPreferences;
    updatePreferences: typeof updatePreferences;
};
/**
 * Hook for a single notification by ID
 */
export declare function useNotification(notificationId: string): {
    notification: NotificationState;
    markAsRead: () => Promise<void>;
    delete: () => Promise<void>;
};
/**
 * Hook for connection status
 */
export declare function useNotificationConnection(): boolean;
/**
 * Hook for realtime transport diagnostics
 */
export declare function useNotificationRealtime(): import("../types").NotificationRealtimeState;
