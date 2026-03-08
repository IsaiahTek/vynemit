// ============================================================================
// REACT HOOKS (No Provider!)
// ============================================================================

import { useStore } from 'react-synq-store';

import { markAsRead, markAllAsRead, deleteNotification, deleteAll, fetchNotifications, fetchStats, updatePreferences, markAsUnread, markAllAsUnread } from '../actions';

import { notificationStore } from '../store';

import {
  NotificationFilters,
  NotificationState
} from '../types';

import { useEffect } from 'react';

/**
 * Main hook for notifications with optional filtering
 */
export function useNotifications(filters?: NotificationFilters) {
  const state = useStore(notificationStore) as NotificationState;
  
  // Filter notifications client-side if filters provided
  const filteredNotifications = filters
    ? state.notifications?.filter(n => {
        if (filters.status && n.status !== filters.status) return false;
        if (filters.type && n.type !== filters.type) return false;
        if (filters.category && n.category !== filters.category) return false;
        if (filters.priority && n.priority !== filters.priority) return false;
        return true;
      })
    : state.notifications;

  return {
    notifications: filteredNotifications??[],
    unreadCount: state.unreadCount??0,
    loading: state.loading,
    error: state.error,
    isConnected: state.isConnected,
    
    // Actions
    markAsRead,
    markAllAsRead,
    markAsUnread,
    markAllAsUnread,
    deleteNotification,
    deleteAll,
    refresh: fetchNotifications
  };
}

/**
 * Optimized hook for just unread count (only re-renders when count changes)
 */
export function useUnreadCount() {
  const data = useStore(notificationStore) as NotificationState;
  // console.log("GOT UNREAD COUNT IN HOOK: ", data.unreadCount);
  return data.unreadCount
}

/**
 * Hook for notification stats
 */
export function useNotificationStats() {

  const data = useStore(notificationStore) as NotificationState;
  const stats = data.stats;
  
  useEffect(() => {
    fetchStats();
  }, []);
  
  return stats;
}

/**
 * Hook for user preferences
 */
export function useNotificationPreferences() {
  const preferences = (useStore(notificationStore) as NotificationState).preferences;
  
  return {
    preferences,
    updatePreferences
  };
}

/**
 * Hook for a single notification by ID
 */
export function useNotification(notificationId: string) {
  const notification = useStore(notificationStore) as NotificationState;
  
  return {
    // notification: notification.notifications.find(n => n.id === notificationId) as Notification,
    notification,
    markAsRead: () => markAsRead(notificationId),
    delete: () => deleteNotification(notificationId)
  };
}

/**
 * Hook for connection status
 */
export function useNotificationConnection() {
  return (useStore(notificationStore) as NotificationState).isConnected;
}

/**
 * Hook for realtime transport diagnostics
 */
export function useNotificationRealtime() {
  return (useStore(notificationStore) as NotificationState).realtime;
}
