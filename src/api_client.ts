// ============================================================================
// API CLIENT
// ============================================================================

import { NotificationConfig } from "./types";
import {
  NotificationDebugEvent,
  Notification,
  NotificationFilters,
  NotificationPreferences,
  NotificationStats
} from './types';



export class NotificationApiClient {
  private config: NotificationConfig;
  private ws?: any;
  private sse?: EventSource;
  private pollInterval?: any;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(config: NotificationConfig) {
    this.config = config;
  }

  private emitDebug(
    source: NotificationDebugEvent['source'],
    event: string,
    level: NotificationDebugEvent['level'] = 'info',
    details?: Record<string, unknown>
  ): void {
    const payload: NotificationDebugEvent = {
      source,
      event,
      level,
      timestamp: new Date().toISOString(),
      ...(details ? { details } : {})
    };

    if (this.config.debug) {
      const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
      console[method]('[notifyc-react]', payload);
    }

    this.config.onDebugEvent?.(payload);
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.config.getAuthToken ? await this.config.getAuthToken() : null;

    const response = await fetch(`${this.config.apiUrl}${endpoint}`, {
      ...options,
      credentials: 'include', // Ensure cookies are sent for session-based auth
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  async getNotifications(filters?: NotificationFilters): Promise<Notification[]> {
    const params = new URLSearchParams();
    if (filters?.status) {
      params.append('status', Array.isArray(filters.status) ? filters.status.join(',') : filters.status);
    }
    if (filters?.type) {
      params.append('type', Array.isArray(filters.type) ? filters.type.join(',') : filters.type);
    }
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());

    const query = params.toString() ? `?${params.toString()}` : '';
    const rawNotifications = await this.request(`/notifications/${this.config.userId}${query}`);

    const notifications: Notification[] = this.config.dataLocator ? this.config.dataLocator(rawNotifications) : rawNotifications;

    // Parse date strings to Date objects
    return Array.isArray(notifications) ? notifications.map(this.parseNotificationDates) : [this.parseNotificationDates(notifications)];
  }

  async getUnreadCount(): Promise<number> {
    const rawResult = await this.request<{ count: number }>(`/notifications/${this.config.userId}/unread-count`);
    const result = this.config.dataLocator ? this.config.dataLocator(rawResult) : rawResult;
    console.log("GOT UNREAD COUNT IN API: ", result.count, result);
    return result.count;
  }

  async getStats(): Promise<NotificationStats> {
    return this.request<NotificationStats>(`/notifications/${this.config.userId}/stats`);
  }

  async getPreferences(): Promise<NotificationPreferences> {
    const prefs = await this.request<NotificationPreferences>(`/notifications/${this.config.userId}/preferences`);
    return prefs;
  }

  async markAsRead(notificationId: string): Promise<void> {
    await this.request(`/notifications/${this.config.userId}/${notificationId}/read`, { method: 'POST' });
  }

  async markAllAsRead(): Promise<void> {
    await this.request(`/notifications/${this.config.userId}/read-all`, { method: 'POST' });
  }

  async deleteNotification(notificationId: string): Promise<void> {
    await this.request(`/notifications/${this.config.userId}/${notificationId}`, { method: 'DELETE' });
  }

  async deleteAll(): Promise<void> {
    await this.request(`/notifications/${this.config.userId}/all`, { method: 'DELETE' });
  }

  async updatePreferences(prefs: Partial<NotificationPreferences>): Promise<void> {
    await this.request(`/notifications/${this.config.userId}/preferences`, {
      method: 'PUT',
      body: JSON.stringify(prefs)
    });
  }

  async connectSSE(onMessage: (data: any) => void): Promise<boolean> {
    if (typeof EventSource === 'undefined') return false;

    const base = (this.config.sseUrl ?? this.config.apiUrl).replace(/\/+$/, '');
    const configuredPath = this.config.ssePath ?? '/notifications/:userId/stream';
    const normalizedPath = configuredPath.startsWith('/') ? configuredPath : `/${configuredPath}`;
    const resolvedPath = normalizedPath.replace(':userId', encodeURIComponent(this.config.userId));
    const streamUrl = new URL(`${base}${resolvedPath}`);
    const token = this.config.getAuthToken ? await this.config.getAuthToken() : null;
    if (token) {
      streamUrl.searchParams.set(this.config.sseAuthQueryParam ?? 'token', token);
    }
    this.emitDebug('sse', 'connect-attempt', 'info', { url: streamUrl.origin + streamUrl.pathname });

    return new Promise<boolean>((resolve) => {
      let settled = false;
      let opened = false;
      const connectTimeoutMs = this.config.sseConnectTimeoutMs ?? 5000;

      const settle = (value: boolean) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      this.sse = new EventSource(streamUrl.toString(), { withCredentials: true });
      this.sse.addEventListener('initial-data', this.handleSSEMessage('initial-data', onMessage));
      this.sse.addEventListener('notification', this.handleSSEMessage('notification', onMessage));
      this.sse.addEventListener('unread-count', this.handleSSEMessage('unread-count', onMessage));

      const timeout = setTimeout(() => {
        if (!opened) {
          this.sse?.close();
          this.sse = undefined;
          settle(false);
        }
      }, connectTimeoutMs);

      this.sse.onopen = () => {
        clearTimeout(timeout);
        opened = true;
        this.reconnectAttempts = 0;
        console.log('🔌 SSE connected');
        this.emitDebug('sse', 'connected');
        settle(true);
      };

      this.sse.onerror = (error) => {
        console.error('❌ SSE error:', error);
        this.emitDebug('sse', 'error', 'error', { opened });
        if (!opened) {
          clearTimeout(timeout);
          this.sse?.close();
          this.sse = undefined;
          settle(false);
        }
      };
    });
  }

  async connectWebSocket(onMessage: (data: any) => void): Promise<boolean> {
    if (!this.config.wsUrl) return false;

    try {
      const { io } = await import('socket.io-client');
      const token = this.config.getAuthToken ? await this.config.getAuthToken() : null;

      this.emitDebug('websocket', 'connect-attempt', 'info', {
        url: this.config.wsUrl
      });

      console.log("ABOUT TO CONNECT TO WEBSOCKET");

      return new Promise<boolean>((resolve) => {
        let settled = false;

        const settle = (value: boolean) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };

        this.ws = io(this.config.wsUrl, {
          query: { userId: this.config.userId },
          ...(token && { auth: { token } }),
          withCredentials: true,
          transports: ['websocket', 'polling'],
          reconnectionAttempts: this.maxReconnectAttempts,
          timeout: 5000,
        });

        this.ws.on('connect', () => {
          console.log('🔌 WebSocket connected');
          this.emitDebug('websocket', 'connected');
          this.reconnectAttempts = 0;
          settle(true);
        });

        this.ws.on('connect_error', (err: any) => {
          console.error('❌ connect_error:', err.message);
          this.emitDebug('websocket', 'connect-error', 'error', {
            message: err.message
          });
          settle(false);
        });

        this.ws.on('disconnect', (reason: string) => {
          console.log('🔌 Socket.IO disconnected:', reason);
          this.emitDebug('websocket', 'disconnected', 'warn', { reason });
        });

        this.ws.on('initial-data', (data: any) => this.handleMessage(data, onMessage));
        this.ws.on('notification', (data: any) => this.handleMessage(data, onMessage));
        this.ws.on('unread-count', (data: any) => this.handleMessage(data, onMessage));
      });

    } catch (error) {
      console.error('Failed to initialize socket.io-client:', error);
      this.emitDebug('websocket', 'connect-failed', 'error');
      return false;
    }
  }

  private handleSSEMessage = (eventType: string, onMessage: (data: any) => void) => (event: MessageEvent) => {
    let parsedData: any = event.data;
    if (typeof event.data === 'string') {
      try {
        parsedData = JSON.parse(event.data);
      } catch {
        parsedData = { data: event.data };
      }
    }

    const normalized =
      parsedData && typeof parsedData === 'object'
        ? { ...parsedData, type: parsedData.type ?? eventType }
        : { type: eventType, data: parsedData };

    this.handleMessage(normalized, onMessage);
  }

  // Helper function to process messages (optional, based on your original logic)
  private handleMessage = (data: any, onMessage: (data: any) => void) => {
    if (data.notification) {
      data.notification = this.parseNotificationDates(data.notification);
    }
    if (Array.isArray(data.notifications)) {
      data.notifications = data.notifications.map((notification: Notification) => this.parseNotificationDates(notification));
    }
    onMessage(data);
  }

  disconnectWebSocket(): void {
    if (this.sse) {
      this.sse.close();
      this.sse = undefined;
      this.emitDebug('sse', 'closed', 'warn');
    }

    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
      this.emitDebug('websocket', 'closed', 'warn');
    }
  }

  startPolling(onPoll: () => Promise<void>): void {
    if (!this.config.pollInterval) return;
    this.emitDebug('polling', 'started', 'info', { intervalMs: this.config.pollInterval });

    this.pollInterval = setInterval(async () => {
      try {
        await onPoll();
      } catch (error) {
        console.error('Polling error:', error);
        this.emitDebug('polling', 'error', 'error');
      }
    }, this.config.pollInterval);
  }

  stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = undefined;
      this.emitDebug('polling', 'stopped', 'warn');
    }
  }

  private parseNotificationDates(notification: Notification): Notification {
    return {
      ...notification,
      createdAt: notification.createdAt ? new Date(notification.createdAt) : new Date(),
      readAt: notification.readAt ? new Date(notification.readAt) : undefined,
      scheduledFor: notification.scheduledFor ? new Date(notification.scheduledFor) : undefined,
      expiresAt: notification.expiresAt ? new Date(notification.expiresAt) : undefined,
    };
  }
}
