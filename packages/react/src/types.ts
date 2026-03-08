// ============================================================================
// TYPES
// ============================================================================
export type ChannelType = 'inapp' | 'push' | 'email' | 'sms' | 'webhook';
export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'read';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';
export type RealtimeTransport = 'sse' | 'websocket' | 'polling' | 'none';
export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'fallback' | 'error';

export interface NotificationAction {
  id: string;
  label: string;
  url?: string;
  handler?: string;
}

export interface NotificationEvent {
  type: 'sent' | 'delivered' | 'read' | 'failed';
  notification: Notification;
  timestamp: Date;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  userId: string;
  groupId?: string;
  priority: NotificationPriority;
  category?: string;
  status: NotificationStatus;
  readAt?: string | Date; // API returns string, we parse to Date
  createdAt: string | Date;
  scheduledFor?: string | Date;
  expiresAt?: string | Date;
  channels: ChannelType[];
  actions?: NotificationAction[];
}

export interface NotificationFilters {
  status?: NotificationStatus | NotificationStatus[];
  type?: string | string[];
  category?: string | string[];
  channels?: ChannelType | ChannelType[];
  priority?: NotificationPriority | NotificationPriority[];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'priority' | 'readAt';
  sortOrder?: 'asc' | 'desc';
}

export interface QuietHours {
  start: string;
  end: string;
  timezone?: string;
}

export interface ChannelPreferences {
  enabled: boolean;
  categories?: string[];
  quietHours?: QuietHours;
  frequency?: 'realtime' | 'batched' | 'digest';
}

export interface NotificationPreferences {
  userId: string;
  channels: {
    [key in ChannelType]?: ChannelPreferences;
  };
  globalMute?: boolean;
  updatedAt?: string | Date;
  data?: Record<string, unknown>;
}

export interface NotificationStats {
  total: number;
  unread: number;
  byStatus: Record<NotificationStatus, number>;
  byChannel: Record<ChannelType, number>;
  byPriority: Record<NotificationPriority, number>;
}

export interface NotificationRealtimeState {
  transport: RealtimeTransport | null;
  status: RealtimeStatus;
  lastEvent: string | null;
  lastError: string | null;
  updatedAt: Date | null;
}

export interface NotificationDebugEvent {
  source: 'initialize' | 'sse' | 'websocket' | 'polling';
  event: string;
  level: 'info' | 'warn' | 'error';
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  stats: NotificationStats | null;
  preferences: NotificationPreferences | null;
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  lastSync: Date | null;
  realtime: NotificationRealtimeState;
  key: string
}

export interface NotificationConfig {
  apiUrl: string;
  userId: string;
  realtimeTransport?: RealtimeTransport;
  sseUrl?: string;
  ssePath?: string;
  sseAuthQueryParam?: string;
  sseConnectTimeoutMs?: number;
  wsUrl?: string;
  pollInterval?: number;
  debug?: boolean;
  onDebugEvent?: (event: NotificationDebugEvent) => void;
  getAuthToken?: () => Promise<string | null>;
  onRefreshAuth?: () => Promise<void>;
  dataLocator?: (response: any) => any
}
