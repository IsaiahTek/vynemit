// ============================================================================
// CORE TYPES
// ============================================================================

export type ChannelType = 'inapp' | 'push' | 'email' | 'sms' | 'webhook';

export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'read';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';

export type DigestFrequency = 'hourly' | 'daily' | 'weekly';

export type ChannelFrequency = 'realtime' | 'batched' | 'digest';

// ============================================================================
// NOTIFICATION MODELS
// ============================================================================

export interface NotificationAction {
  id: string;
  label: string;
  url?: string;
  handler?: string; // Reference to handler function
}

export interface Notification {
  id: string;
  type: string; // 'comment', 'like', 'system', etc.
  title: string;
  body: string;
  data?: Record<string, unknown>; // Custom payload
  
  // Targeting
  userId: string;
  groupId?: string; // For batch notifications
  
  // Metadata
  priority: NotificationPriority;
  category?: string; // Grouping/filtering
  
  // State
  status: NotificationStatus;
  readAt?: Date;
  createdAt: Date;
  scheduledFor?: Date; // Delayed delivery
  expiresAt?: Date; // TTL
  
  // Channels
  channels: ChannelType[];
  
  // Actions (for interactive notifications)
  actions?: NotificationAction[];
}

export interface NotificationInput {
  type: string;
  title: string;
  body: string;
  userId: string;
  groupId?: string;
  data?: Record<string, unknown>;
  priority?: NotificationPriority;
  category?: string;
  channels: ChannelType[];
  scheduledFor?: Date;
  expiresAt?: Date;
  actions?: NotificationAction[];
  
  // Template support
  template?: string;
}

export interface NotificationMulticastInput {
  type: string;
  title: string;
  body: string;
  userIds: string[];
  data?: Record<string, unknown>;
  priority?: NotificationPriority;
  category?: string;
  channels: ChannelType[];
  scheduledFor?: Date;
  expiresAt?: Date;
  actions?: NotificationAction[];
  
  // Template support
  template?: string;
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

// ============================================================================
// PREFERENCES
// ============================================================================

export interface ChannelPreferences {
  enabled: boolean;
  categories?: string[]; // Which categories to receive
  quietHours?: QuietHours;
  frequency?: ChannelFrequency;
}

export interface QuietHours {
  start: string; // "22:00"
  end: string;   // "08:00"
  timezone?: string; // "America/New York"
}

export interface NotificationPreferences {
  userId: string;
  channels: {
    [key in ChannelType]?: ChannelPreferences;
  };
  globalMute?: boolean;
  updatedAt?: Date;
  data?: Record<string, unknown>;
}

// ============================================================================
// DELIVERY & RECEIPTS
// ============================================================================

export interface DeliveryReceipt {
  notificationId: string;
  channel: ChannelType;
  status: DeliveryStatus;
  attempts: number;
  lastAttempt: Date;
  nextRetry?: Date;
  error?: string;
  metadata?: Record<string, unknown>; // Channel-specific data
}

// ============================================================================
// TEMPLATES
// ============================================================================

export interface NotificationTemplate {
  id: string;
  type: string;
  defaults: {
    title: string | ((data: any) => string);
    body: string | ((data: any) => string);
    channels: ChannelType[];
    priority: NotificationPriority;
    category?: string;
    expiresIn?: number; // TTL in milliseconds
  };
}

// ============================================================================
// DIGEST
// ============================================================================

export interface DigestConfig {
  userId: string;
  frequency: DigestFrequency;
  channels: ChannelType[];
  categories?: string[];
  enabled: boolean;
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

export interface NotificationMiddleware {
  name: string;
  
  // Lifecycle hooks
  beforeSend?(notification: Notification): Promise<Notification | null>; // null = skip
  afterSend?(notification: Notification): Promise<void>;
  onError?(error: Error, notification: Notification): Promise<void>;
}

// ============================================================================
// ADAPTERS
// ============================================================================

export interface StorageAdapter {
  // CRUD
  save(notification: Notification): Promise<void>;
  saveBatch(notifications: Notification[]): Promise<void>;
  findById(id: string): Promise<Notification | null>;
  
  // Queries
  findByUser(userId: string, filters?: NotificationFilters): Promise<Notification[]>;
  countUnread(userId: string): Promise<number>;
  
  // Updates
  markAsRead(id: string): Promise<void>;
  markAllAsRead(userId: string): Promise<void>;
  markAsUnread(id: string): Promise<void>;
  markAllAsUnread(userId: string): Promise<void>;
  delete(id: string): Promise<void>;
  
  // Preferences
  getPreferences(userId: string): Promise<NotificationPreferences>;
  savePreferences(userId: string, prefs: NotificationPreferences): Promise<void>;
  
  // Cleanup
  deleteExpired(): Promise<number>;
  
  // Delivery receipts
  saveReceipt?(receipt: DeliveryReceipt): Promise<void>;
  getReceipts?(notificationId: string): Promise<DeliveryReceipt[]>;
}

export interface TransportAdapter {
  name: ChannelType;
  
  // Core delivery
  send(notification: Notification, preferences: NotificationPreferences): Promise<DeliveryReceipt>;
  
  // Optional: batch support
  sendBatch?(notifications: Notification[], preferences: NotificationPreferences): Promise<DeliveryReceipt[]>;
  
  // Validation
  canSend(notification: Notification, preferences: NotificationPreferences): boolean;
  
  // Health check
  healthCheck?(): Promise<boolean>;
}

export interface QueueAdapter {
  // Enqueue
  enqueue(notification: Notification): Promise<void>;
  enqueueBatch(notifications: Notification[]): Promise<void>;
  enqueueDelayed(notification: Notification, delay: number): Promise<void>;
  
  // Dequeue
  dequeue(): Promise<Notification | null>;
  dequeueBatch(count: number): Promise<Notification[]>;
  
  // Management
  getQueueSize(): Promise<number>;
  clear(): Promise<void>;
  
  // Lifecycle
  start(): Promise<void>;
  stop(): Promise<void>;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface NotificationConfig {
  storage: StorageAdapter;
  transports: TransportAdapter[];
  queue?: QueueAdapter;
  
  // Worker settings
  workers?: {
    enabled?: boolean;
    concurrency?: number;
    pollInterval?: number; // ms
  };
  
  // Retry settings
  retry?: {
    maxAttempts?: number;
    backoff?: 'linear' | 'exponential';
    initialDelay?: number; // ms
    maxDelay?: number; // ms
  };
  
  // Cleanup settings
  cleanup?: {
    enabled?: boolean;
    interval?: number; // ms
    retentionDays?: number;
  };
  
  // Middleware
  middleware?: NotificationMiddleware[];
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type Unsubscribe = () => void;

export interface NotificationEvent {
  type: 'sent' | 'delivered' | 'read' | 'unread' | 'failed';
  notification: Notification;
  timestamp: Date;
}

export interface NotificationStats {
  total: number;
  unread: number;
  byStatus: Record<NotificationStatus, number>;
  byChannel: Record<ChannelType, number>;
  byPriority: Record<NotificationPriority, number>;
}
