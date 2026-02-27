import { fetchNotifications, fetchUnreadCount, fetchPreferences } from './actions';
import { NotificationApiClient } from './api_client';
import { addNotification } from './handlers'
import { NotificationConfig, NotificationRealtimeState, NotificationState, RealtimeStatus, RealtimeTransport } from './types';
import { notificationStore } from './store'
// ============================================================================
// INITIALIZATION (Call once in your app)
// ============================================================================
export let apiClient: NotificationApiClient | null = null;

export function initializeNotifications(config: NotificationConfig, onInitialized?: () => void) {
  apiClient = new NotificationApiClient(config);

  const getState = (): NotificationState => {
    const snapshot = notificationStore.snapshot as unknown as NotificationState | NotificationState[];
    return Array.isArray(snapshot) ? snapshot[0] : snapshot;
  };

  const emitDebug = (
    source: 'initialize' | 'sse' | 'websocket' | 'polling',
    event: string,
    level: 'info' | 'warn' | 'error' = 'info',
    details?: Record<string, unknown>
  ) => {
    const payload = {
      source,
      event,
      level,
      timestamp: new Date().toISOString(),
      ...(details ? { details } : {})
    };
    if (config.debug) {
      const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
      console[method]('[notifyc-react]', payload);
    }
    config.onDebugEvent?.(payload);
  };

  const updateRealtime = (
    transport: RealtimeTransport | null,
    status: RealtimeStatus,
    event: string,
    error: string | null = null
  ) => {
    const state = getState();
    const realtime: NotificationRealtimeState = {
      transport,
      status,
      lastEvent: event,
      lastError: error,
      updatedAt: new Date(),
    };
    notificationStore.update({ ...state, realtime }, "key");
  };

  const onMessage = (data: any, isSSE: boolean = false) => {
    console.log(`GOT NEW "${data.type}" NOTIFICATION: `, data)
    if (data.type === 'notification') {
      addNotification(isSSE ? data.data : data.notification);
    } else if (data.type === 'unread-count') {
      const state = getState();
      notificationStore.update({ ...state, unreadCount: isSSE ? data.data : data.count }, "key");
    } else if (data.type === 'initial-data') {
      const state = getState();
      notificationStore.update({
        ...state,
        notifications: isSSE ? data.data.notifications : data.notifications,
        unreadCount: isSSE ? data.data.unreadCount : data.unreadCount,
        isConnected: true
      }, "key");
    }
  };

  const connectRealtime = async () => {
    const preferredTransport = config.realtimeTransport ?? 'sse';
    let connected = false;
    let connectedTransport: RealtimeTransport | null = null;

    updateRealtime(preferredTransport, 'connecting', 'connect-start');
    emitDebug('initialize', 'connect-start', 'info', { preferredTransport });

    if (preferredTransport === 'sse') {
      connected = await apiClient!.connectSSE(onMessage);
      if (connected) connectedTransport = 'sse';
      if (!connected && config.wsUrl) {
        updateRealtime('websocket', 'fallback', 'fallback-to-websocket');
        emitDebug('initialize', 'fallback-to-websocket', 'warn');
        connected = await apiClient!.connectWebSocket(onMessage);
        if (connected) connectedTransport = 'websocket';
      }
    } else if (preferredTransport === 'websocket') {
      connected = await apiClient!.connectWebSocket(onMessage);
      if (connected) connectedTransport = 'websocket';
      if (!connected) {
        try {
          updateRealtime('sse', 'fallback', 'fallback-to-sse');
          emitDebug('initialize', 'fallback-to-sse', 'warn');
          connected = await apiClient!.connectSSE(onMessage);
          if (connected) connectedTransport = 'sse';
        } catch (error) {

        }
      }
    } else if (preferredTransport === 'polling') {
      connected = false;
      connectedTransport = 'polling';
    } else if (preferredTransport === 'none') {
      connected = false;
      connectedTransport = 'none';
    }

    if (!connected && preferredTransport !== 'none' && config.pollInterval) {
      apiClient!.startPolling(async () => {
        await fetchNotifications();
        await fetchUnreadCount();
      });
      connected = true;
      connectedTransport = 'polling';
      updateRealtime('polling', 'fallback', 'fallback-to-polling');
      emitDebug('initialize', 'fallback-to-polling', 'warn');
    }

    if (connected) {
      const state = getState();
      notificationStore.update({ ...state, isConnected: true }, "key");
      updateRealtime(connectedTransport, 'connected', 'connected');
      emitDebug('initialize', 'connected', 'info', { transport: connectedTransport });
    } else if (preferredTransport === 'none') {
      updateRealtime('none', 'idle', 'realtime-disabled');
      emitDebug('initialize', 'realtime-disabled');
    } else {
      const state = getState();
      notificationStore.update({ ...state, isConnected: false }, "key");
      updateRealtime(connectedTransport ?? preferredTransport, 'error', 'connect-failed', 'No realtime transport available');
      emitDebug('initialize', 'connect-failed', 'error');
    }
  };

  void connectRealtime();

  console.log("ABOUT TO CALL NOTIFICATION ACTIONS");
  // Initial fetch
  fetchNotifications();
  fetchUnreadCount();
  fetchPreferences();

  // Call onInitialized callback
  onInitialized && onInitialized();
}

export function disconnectNotifications() {
  if (apiClient) {
    apiClient.disconnectRealtime();
    const snapshot = notificationStore.snapshot as unknown as NotificationState | NotificationState[];
    const state = Array.isArray(snapshot) ? snapshot[0] : snapshot;
    notificationStore.update({
      ...state,
      isConnected: false,
      realtime: {
        ...state.realtime,
        status: 'idle',
        lastEvent: 'disconnected',
        updatedAt: new Date(),
      }
    }, "key");
  }
}
