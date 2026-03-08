"use strict";
// ============================================================================
// REACT HOOKS (No Provider!)
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.useNotifications = useNotifications;
exports.useUnreadCount = useUnreadCount;
exports.useNotificationStats = useNotificationStats;
exports.useNotificationPreferences = useNotificationPreferences;
exports.useNotification = useNotification;
exports.useNotificationConnection = useNotificationConnection;
exports.useNotificationRealtime = useNotificationRealtime;
var react_synq_store_1 = require("react-synq-store");
var actions_1 = require("../actions");
var store_1 = require("../store");
var react_1 = require("react");
/**
 * Main hook for notifications with optional filtering
 */
function useNotifications(filters) {
    var _a, _b;
    var state = (0, react_synq_store_1.useStore)(store_1.notificationStore);
    // Filter notifications client-side if filters provided
    var filteredNotifications = filters
        ? (_a = state.notifications) === null || _a === void 0 ? void 0 : _a.filter(function (n) {
            if (filters.status && n.status !== filters.status)
                return false;
            if (filters.type && n.type !== filters.type)
                return false;
            if (filters.category && n.category !== filters.category)
                return false;
            if (filters.priority && n.priority !== filters.priority)
                return false;
            return true;
        })
        : state.notifications;
    return {
        notifications: filteredNotifications !== null && filteredNotifications !== void 0 ? filteredNotifications : [],
        unreadCount: (_b = state.unreadCount) !== null && _b !== void 0 ? _b : 0,
        loading: state.loading,
        error: state.error,
        isConnected: state.isConnected,
        // Actions
        markAsRead: actions_1.markAsRead,
        markAllAsRead: actions_1.markAllAsRead,
        markAsUnread: actions_1.markAsUnread,
        markAllAsUnread: actions_1.markAllAsUnread,
        deleteNotification: actions_1.deleteNotification,
        deleteAll: actions_1.deleteAll,
        refresh: actions_1.fetchNotifications
    };
}
/**
 * Optimized hook for just unread count (only re-renders when count changes)
 */
function useUnreadCount() {
    var data = (0, react_synq_store_1.useStore)(store_1.notificationStore);
    // console.log("GOT UNREAD COUNT IN HOOK: ", data.unreadCount);
    return data.unreadCount;
}
/**
 * Hook for notification stats
 */
function useNotificationStats() {
    var data = (0, react_synq_store_1.useStore)(store_1.notificationStore);
    var stats = data.stats;
    (0, react_1.useEffect)(function () {
        (0, actions_1.fetchStats)();
    }, []);
    return stats;
}
/**
 * Hook for user preferences
 */
function useNotificationPreferences() {
    var preferences = (0, react_synq_store_1.useStore)(store_1.notificationStore).preferences;
    return {
        preferences: preferences,
        updatePreferences: actions_1.updatePreferences
    };
}
/**
 * Hook for a single notification by ID
 */
function useNotification(notificationId) {
    var notification = (0, react_synq_store_1.useStore)(store_1.notificationStore);
    return {
        // notification: notification.notifications.find(n => n.id === notificationId) as Notification,
        notification: notification,
        markAsRead: function () { return (0, actions_1.markAsRead)(notificationId); },
        delete: function () { return (0, actions_1.deleteNotification)(notificationId); }
    };
}
/**
 * Hook for connection status
 */
function useNotificationConnection() {
    return (0, react_synq_store_1.useStore)(store_1.notificationStore).isConnected;
}
/**
 * Hook for realtime transport diagnostics
 */
function useNotificationRealtime() {
    return (0, react_synq_store_1.useStore)(store_1.notificationStore).realtime;
}
