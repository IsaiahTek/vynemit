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
import { io, Socket } from "socket.io-client";


export class NotificationApiClient {
  private config: NotificationConfig;

  private ws?: Socket;
  private sse?: EventSource;

  private wsPromise?: Promise<boolean>;
  private ssePromise?: Promise<boolean>;

  private pollingIntervalId?: ReturnType<typeof setInterval>;

  constructor(config: NotificationConfig) {
    this.config = config;
  }

  /* ============================================================
     HTTP REQUESTS
  ============================================================ */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    isRetry: boolean = false
  ): Promise<T> {
    const token = this.config.getAuthToken
      ? await this.config.getAuthToken()
      : null;

    // Normalize headers safely
    const baseHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      baseHeaders['Authorization'] = `Bearer ${token}`;
    }

    let optionsHeaders: Record<string, string> = {};
    if (options.headers instanceof Headers) {
      options.headers.forEach((value, key) => {
        optionsHeaders[key] = value;
      });
    } else if (Array.isArray(options.headers)) {
      optionsHeaders = Object.fromEntries(options.headers);
    } else if (options.headers) {
      optionsHeaders = options.headers as Record<string, string>;
    }

    const mergedHeaders: Record<string, string> = {
      ...baseHeaders,
      ...optionsHeaders,
    };

    const response = await fetch(`${this.config.apiUrl}${endpoint}`, {
      ...options,
      credentials: 'include',
      headers: mergedHeaders,
    });

    // 🔁 Handle 401 retry
    if (response.status === 401 && !isRetry) {
      await this.config.onRefreshAuth?.();

      const newToken = this.config.getAuthToken
        ? await this.config.getAuthToken()
        : null;

      const retryHeaders: Record<string, string> = {
        ...mergedHeaders,
      };

      if (newToken) {
        retryHeaders['Authorization'] = `Bearer ${newToken}`;
      } else {
        delete retryHeaders['Authorization'];
      }

      return this.request<T>(
        endpoint,
        {
          ...options,
          headers: retryHeaders,
        },
        true
      );
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(
        `API Error ${response.status}: ${errorText || response.statusText}`
      );
    }

    // ✅ Handle empty responses safely
    if (response.status === 204) {
      return undefined as T;
    }

    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      return response.json();
    }

    // fallback (text, etc.)
    return (await response.text()) as unknown as T;
  }

  /* ============================================================
     DATE PARSER
  ============================================================ */
  private parseNotificationDates(notification: Notification): Notification {
    return {
      ...notification,
      createdAt: notification.createdAt ? new Date(notification.createdAt) : new Date(),
      readAt: notification.readAt ? new Date(notification.readAt) : undefined,
      scheduledFor: notification.scheduledFor ? new Date(notification.scheduledFor) : undefined,
      expiresAt: notification.expiresAt ? new Date(notification.expiresAt) : undefined,
    };
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
    await this.request(`/notifications/${this.config.userId}/${notificationId}/read`, { method: 'PATCH' });
  }

  async markAllAsRead(): Promise<void> {
    await this.request(`/notifications/${this.config.userId}/read-all`, { method: 'PATCH' });
  }

  async markAsUnread(notificationId: string): Promise<void> {
    await this.request(`/notifications/${this.config.userId}/${notificationId}/unread`, { method: 'PATCH' });
  }

  async markAllAsUnread(): Promise<void> {
    await this.request(`/notifications/${this.config.userId}/unread-all`, { method: 'PATCH' });
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


  /* ============================================================
     REALTIME CONNECTOR
  ============================================================ */

  async connectRealtime(onMessage: (data: any) => void): Promise<boolean> {
    this.disconnectRealtime();

    const wsConnected = await this.connectWebSocket(onMessage);
    if (wsConnected) return true;

    const sseConnected = await this.connectSSE(onMessage);
    if (sseConnected) return true;

    return false;
  }

  /* ============================================================
     WEBSOCKET
  ============================================================ */

  async connectWebSocket(onMessage: (data: any) => void): Promise<boolean> {
    if (this.wsPromise) return this.wsPromise;

    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }

    this.wsPromise = new Promise<boolean>(async (resolve) => {
      let settled = false;

      const settle = (value: boolean) => {
        if (settled) return;
        settled = true;
        this.wsPromise = undefined;
        resolve(value);
      };

      try {
        const base = (this.config.wsUrl ?? this.config.apiUrl).replace(/\/+$/, '');
        const token = this.config.getAuthToken
          ? await this.config.getAuthToken()
          : null;

        this.ws = io(`${base}/notifications`, {
          auth: {
            token,
          },
          query: {
            userId: this.config.userId,
          },
          withCredentials: true,
          transports: ['websocket'], // optional but recommended
        });

        console.log('WS Connecting to:', base);

        this.ws.on('connect', () => {
          console.log('WS Connected');
          settle(true);
        });

        this.ws.onAny((eventName, payload) => {
          console.log('WS Event:', eventName, payload);
          onMessage(payload);
        });

        this.ws.on('connect_error', (err) => {
          console.error('WS Connect Error:', err);
          if (!settled) settle(false);
        });

        this.ws.on('disconnect', (reason) => {
          console.log('WS Disconnected:', reason);
        });

      } catch (err) {
        console.error('WS Error:', err);
        settle(false);
      }
    });

    return this.wsPromise;
  }

  /* ============================================================
     SERVER-SENT EVENTS
  ============================================================ */

  async connectSSE(onMessage: (data: any, isSSE: boolean) => void): Promise<boolean> {
    if (typeof EventSource === 'undefined') return false;
    if (this.ssePromise) return this.ssePromise;

    if (this.sse) {
      this.sse.close();
      this.sse = undefined;
    }

    this.ssePromise = new Promise<boolean>(async (resolve) => {
      let settled = false;
      let opened = false;
      const timeoutMs = this.config.sseConnectTimeoutMs ?? 5000;

      const settle = (value: boolean) => {
        if (settled) return;
        settled = true;
        this.ssePromise = undefined;
        resolve(value);
      };

      const base = (this.config.sseUrl ?? this.config.apiUrl).replace(/\/+$/, '');
      const path = (this.config.ssePath ?? '/notifications/:userId/stream')
        .replace(':userId', encodeURIComponent(this.config.userId));

      const url = new URL(`${base}${path}`);

      const token = this.config.getAuthToken
        ? await this.config.getAuthToken()
        : null;

      if (token) {
        url.searchParams.set(
          this.config.sseAuthQueryParam ?? 'token',
          token
        );
      }

      this.sse = new EventSource(url.toString(), {
        withCredentials: true
      });

      const timeout = setTimeout(() => {
        if (!opened) {
          this.sse?.close();
          this.sse = undefined;
          settle(false);
        }
      }, timeoutMs);

      this.sse.onopen = () => {
        clearTimeout(timeout);
        opened = true;
        settle(true);
      };

      this.sse.onmessage = (event) => {
        try {
          onMessage(JSON.parse(event.data), true);
        } catch {
          onMessage(event.data, true);
        }
      };

      this.sse.onerror = () => {
        if (!opened) {
          clearTimeout(timeout);
          this.sse?.close();
          this.sse = undefined;
          settle(false);
        }
      };
    });

    return this.ssePromise;
  }

  /* ============================================================
     POLLING
  ============================================================ */

  startPolling(callback: () => Promise<void> | void) {
    if (!this.config.pollInterval) return;

    // Prevent duplicate polling loops
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
    }

    this.pollingIntervalId = setInterval(async () => {
      try {
        await callback();
      } catch (err) {
        // console.error('[notifyc] Polling error:', err);
      }
    }, this.config.pollInterval);
  }

  stopPolling() {
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = undefined;
    }
  }

  /* ============================================================
     CLEANUP
  ============================================================ */

  disconnectRealtime(): void {
    if (this.sse) {
      this.sse.close();
      this.sse = undefined;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }

    this.stopPolling();

    this.wsPromise = undefined;
    this.ssePromise = undefined;
  }
}