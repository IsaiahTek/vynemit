
// ============================================================================
// GLOBAL NOTIFICATION STORE (No Provider Needed!)
// ============================================================================

import { Store } from 'react-synq-store';

import { NotificationState } from "./types";

const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  stats: null,
  preferences: null,
  loading: false,
  error: null,
  isConnected: false,
  lastSync: null,
  realtime: {
    transport: null,
    status: 'idle',
    lastEvent: null,
    lastError: null,
    updatedAt: null,
  },
  key: "notifications"
};
// Create global store instance
export const notificationStore = new Store<NotificationState>(initialState);
