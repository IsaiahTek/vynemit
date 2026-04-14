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
  public config: NotificationConfig;

  private ws?: Socket;
  private sse?: EventSource;

  private wsPromise?: Promise<boolean>;
  private ssePromise?: Promise<boolean>;

  private pollingIntervalId?: ReturnType<typeof setInterval>;
  private refreshPromise?: Promise<void>;

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
      if (this.config.onRefreshAuth) {
        if (!this.refreshPromise) {
          this.refreshPromise = this.config.onRefreshAuth().finally(() => {
            this.refreshPromise = undefined;
          });
        }
        await this.refreshPromise;
      }

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

  async connectWebSocket(onMessage: (data: any) => void, isRetry = false): Promise<boolean> {
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

        if (this.config.debug) {
          console.log('WS Connecting to:', base);
        }

        this.ws.on('connect', () => {
          if (this.config.debug) console.log('WS Connected');
          settle(true);
        });

        this.ws.onAny((eventName, payload) => {
          // If the payload is already an object, add the eventName so it can be handled properly, else wrap it
          let messageData = payload;
          if (typeof payload === 'object' && payload !== null) {
             messageData = { ...payload, type: payload.type || eventName };
          } else {
             messageData = { data: payload, type: eventName };
          }
          if (this.config.debug) console.log('WS Event:', eventName, messageData);
          onMessage(messageData);
        });

        this.ws.on('connect_error', async (err) => {
          if (this.config.debug) console.error('WS Connect Error:', err);
          
          const errStr = String(err).toLowerCase();
          if ((errStr.includes('401') || errStr.includes('unauthorized') || errStr.includes('authentication')) && !isRetry && this.config.onRefreshAuth) {
             if (this.config.debug) console.log('WS 401: Refreshing token...');
             await this.config.onRefreshAuth();
             
             this.ws?.close();
             this.ws = undefined;
             this.wsPromise = undefined;
             const reconnected = await this.connectWebSocket(onMessage, true);
             if (!settled) settle(reconnected);
             return;
          }
          
          if (!settled) settle(false);
        });

        this.ws.on('disconnect', async (reason) => {
          if (this.config.debug) console.log('WS Disconnected:', reason);
          const reasonStr = String(reason).toLowerCase();
          if ((reasonStr === 'io server disconnect' || reasonStr.includes('unauthorized')) && !isRetry && this.config.onRefreshAuth) {
             if (this.config.debug) console.log('WS Disconnected by server (unauthorized), attempting reconnect...');
             await this.config.onRefreshAuth();
             this.connectWebSocket(onMessage, true);
          }
        });

      } catch (err) {
        if (this.config.debug) console.error('WS Error:', err);
        settle(false);
      }
    });

    return this.wsPromise;
  }

  /* ============================================================
     SERVER-SENT EVENTS
  ============================================================ */

  async connectSSE(onMessage: (data: any, isSSE: boolean) => void, isRetry = false): Promise<boolean> {
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
          const parsedData = JSON.parse(event.data);
          // Standardize payload format to include event type if available (EventSource sets event.type to 'message' by default unless custom event name is sent)
          const messageData = (typeof parsedData === 'object' && parsedData !== null) ? { ...parsedData, type: parsedData.type || event.type } : { data: parsedData, type: event.type };
          onMessage(messageData, true);
        } catch {
          onMessage({ data: event.data, type: event.type }, true);
        }
      };

      this.sse.onerror = async (err) => {
        if (this.config.debug) console.error('SSE Error:', err);
        // EventSource API doesn't expose HTTP status codes on errors.
        // If it closes immediately or we haven't opened yet and we fail, we might assume auth error if auth is configured.
        // It's safer to try a refresh if we haven't retried yet and there's a refresh handler.
        if (!opened && !isRetry && this.config.onRefreshAuth) {
           if (this.config.debug) console.log('SSE connection failed to open, assuming 401 and attempting refresh...');
           
           if (!this.refreshPromise) {
              this.refreshPromise = this.config.onRefreshAuth().finally(() => {
                this.refreshPromise = undefined;
              });
           }
           await this.refreshPromise;
           
           clearTimeout(timeout);
           this.sse?.close();
           this.sse = undefined;
           this.ssePromise = undefined;
           
           const reconnected = await this.connectSSE(onMessage, true);
           if (!settled) settle(reconnected);
           return;
        }

        if (!opened) {
          clearTimeout(timeout);
          this.sse?.close();
          this.sse = undefined;
          settle(false);
        } else {
          // If the connection was previously opened but now errored (e.g. disconnected)
          // EventSource automatically attempts to reconnect, so we close it here and manage it manually if token refresh needed
          if (!isRetry && this.config.onRefreshAuth) {
             if (this.config.debug) console.log('SSE Disconnected by server, attempting token refresh...');
             this.sse?.close();
             this.sse = undefined;
             this.ssePromise = undefined;
             
             if (!this.refreshPromise) {
                this.refreshPromise = this.config.onRefreshAuth().finally(() => {
                  this.refreshPromise = undefined;
                });
             }
             await this.refreshPromise;
             
             this.connectSSE(onMessage, true);
          }
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
        // console.error('[vynemit] Polling error:', err);
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