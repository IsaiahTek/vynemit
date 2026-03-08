// ============================================================================
// STORE ACTIONS (Pure functions)
// ============================================================================
import {
  NotificationFilters,
  NotificationPreferences,
  NotificationState
} from './types';
import { NotificationApiClient } from './api_client';
import { notificationStore } from './store';
import { apiClient } from './initialize';


// const apiClient = new let apiClient: NotificationApiClient | null = null;


export async function fetchNotifications(filters?: NotificationFilters) {
  // console.log("ENTERED FETCHING NOTIFICATIONS...");
  if (!apiClient) throw new Error('Call initializeNotifications() first');

  // console.log("FETCHING NOTIFICATIONS WITH FILTERS: ", filters);

  notificationStore.update((state: NotificationState) => ({ ...state, loading: true, error: null }), "key");

  try {
    const notifications = await apiClient.getNotifications(filters);
    // console.log("FETCHED NOTIFICATIONS: ", notifications, " CURRENT STATE: ", notificationStore.snapshot);
    notificationStore.update((state) => ({
      ...state,
      notifications,
      loading: false,
      lastSync: new Date()
    }), "key");
  } catch (error) {
    // console.error('Failed to fetch notifications:', error);
    notificationStore.update((state) => ({
      ...state,
      loading: false,
      error: (error as Error).message
    }), "key");
  }
}

export async function fetchUnreadCount() {
  if (!apiClient) return;

  try {
    const unreadCount = await apiClient.getUnreadCount();
    // console.log("GOT UNREAD COUNT IN FETCH: ", unreadCount);
    notificationStore.update((state) => ({ ...state, unreadCount }), "key");
  } catch (error) {
    // console.error('Failed to fetch unread count:', error);
  }
}

export async function fetchStats() {
  if (!apiClient) return;

  try {
    const stats = await apiClient.getStats();
    notificationStore.update((state) => ({ ...state, stats }), "key");
  } catch (error) {
    // console.error('Failed to fetch stats:', error);
  }
}

export async function fetchPreferences() {
  if (!apiClient) return;

  try {
    const preferences = await apiClient.getPreferences();
    notificationStore.update((state) => ({ ...state, preferences }), "key");
  } catch (error) {
    // console.error('Failed to fetch preferences:', error);
  }
}

export async function markAsRead(notificationId: string) {
  if (!apiClient) return;

  try {
    await apiClient.markAsRead(notificationId);

    notificationStore.update((state) => ({
      ...state,
      notifications: state.notifications.map(n =>
        n.id === notificationId
          ? { ...n, status: 'read' as const, readAt: new Date() }
          : n
      )
    }), "key");

    await fetchUnreadCount();
  } catch (error) {
    // console.error('Failed to mark as read:', error);
  }
}

export async function markAllAsRead() {
  if (!apiClient) return;

  try {
    await apiClient.markAllAsRead();

    notificationStore.update((state) => ({
      ...state,
      notifications: state.notifications.map(n => ({
        ...n,
        status: 'read' as const,
        readAt: new Date()
      })),
      unreadCount: 0
    }), "key");
  } catch (error) {
    // console.error('Failed to mark all as read:', error);
  }
}

export async function markAsUnread(notificationId: string) {
  if (!apiClient) return;

  try {
    await apiClient.markAsUnread(notificationId);

    notificationStore.update((state) => ({
      ...state,
      notifications: state.notifications.map(n =>
        n.id === notificationId
          ? { ...n, status: 'delivered' as const, readAt: undefined }
          : n
      )
    }), "key");

    await fetchUnreadCount();
  } catch (error) {
    // console.error('Failed to mark as unread:', error);
  }
}

export async function markAllAsUnread() {
  if (!apiClient) return;

  try {
    await apiClient.markAllAsUnread();

    notificationStore.update((state) => ({
      ...state,
      notifications: state.notifications.map(n => ({
        ...n,
        status: 'delivered' as const,
        readAt: undefined
      })),
      unreadCount: state.notifications.length
    }), "key");
  } catch (error) {
    // console.error('Failed to mark all as unread:', error);
  }
}

export async function deleteNotification(notificationId: string) {
  if (!apiClient) return;

  try {
    await apiClient.deleteNotification(notificationId);

    notificationStore.update((state) => ({
      ...state,
      notifications: state.notifications.filter(n => n.id !== notificationId)
    }), "key");

    await fetchUnreadCount();
  } catch (error) {
    // console.error('Failed to delete notification:', error);
  }
}

export async function deleteAll() {
  if (!apiClient) return;

  try {
    await apiClient.deleteAll();

    notificationStore.update((state) => ({
      ...state,
      notifications: [],
      unreadCount: 0
    }), "key");
  } catch (error) {
    // console.error('Failed to delete all:', error);
  }
}

export async function updatePreferences(prefs: Partial<NotificationPreferences>) {
  if (!apiClient) return;

  try {
    await apiClient.updatePreferences(prefs);

    notificationStore.update((state) => ({
      ...state,
      preferences: state.preferences ? { ...state.preferences, ...prefs } : null
    }), "key");
  } catch (error) {
    // console.error('Failed to update preferences:', error);
  }
}
