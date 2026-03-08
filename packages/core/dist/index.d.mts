type ChannelType = 'inapp' | 'push' | 'email' | 'sms' | 'webhook';
type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'read';
type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';
type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
type DigestFrequency = 'hourly' | 'daily' | 'weekly';
type ChannelFrequency = 'realtime' | 'batched' | 'digest';
interface NotificationAction {
    id: string;
    label: string;
    url?: string;
    handler?: string;
}
interface Notification {
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
    readAt?: Date;
    createdAt: Date;
    scheduledFor?: Date;
    expiresAt?: Date;
    channels: ChannelType[];
    actions?: NotificationAction[];
}
interface NotificationInput {
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
    template?: string;
}
interface NotificationMulticastInput {
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
    template?: string;
}
interface NotificationFilters {
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
interface ChannelPreferences {
    enabled: boolean;
    categories?: string[];
    quietHours?: QuietHours;
    frequency?: ChannelFrequency;
}
interface QuietHours {
    start: string;
    end: string;
    timezone?: string;
}
interface NotificationPreferences {
    userId: string;
    channels: {
        [key in ChannelType]?: ChannelPreferences;
    };
    globalMute?: boolean;
    updatedAt?: Date;
    data?: Record<string, unknown>;
}
interface DeliveryReceipt {
    notificationId: string;
    channel: ChannelType;
    status: DeliveryStatus;
    attempts: number;
    lastAttempt: Date;
    nextRetry?: Date;
    error?: string;
    metadata?: Record<string, unknown>;
}
interface NotificationTemplate {
    id: string;
    type: string;
    defaults: {
        title: string | ((data: any) => string);
        body: string | ((data: any) => string);
        channels: ChannelType[];
        priority: NotificationPriority;
        category?: string;
        expiresIn?: number;
    };
}
interface DigestConfig {
    userId: string;
    frequency: DigestFrequency;
    channels: ChannelType[];
    categories?: string[];
    enabled: boolean;
}
interface NotificationMiddleware {
    name: string;
    beforeSend?(notification: Notification): Promise<Notification | null>;
    afterSend?(notification: Notification): Promise<void>;
    onError?(error: Error, notification: Notification): Promise<void>;
}
interface StorageAdapter {
    save(notification: Notification): Promise<void>;
    saveBatch(notifications: Notification[]): Promise<void>;
    findById(id: string): Promise<Notification | null>;
    findByUser(userId: string, filters?: NotificationFilters): Promise<Notification[]>;
    countUnread(userId: string): Promise<number>;
    markAsRead(id: string): Promise<void>;
    markAllAsRead(userId: string): Promise<void>;
    markAsUnread(id: string): Promise<void>;
    markAllAsUnread(userId: string): Promise<void>;
    delete(id: string): Promise<void>;
    getPreferences(userId: string): Promise<NotificationPreferences>;
    savePreferences(userId: string, prefs: NotificationPreferences): Promise<void>;
    deleteExpired(): Promise<number>;
    saveReceipt?(receipt: DeliveryReceipt): Promise<void>;
    getReceipts?(notificationId: string): Promise<DeliveryReceipt[]>;
}
interface TransportAdapter {
    name: ChannelType;
    send(notification: Notification, preferences: NotificationPreferences): Promise<DeliveryReceipt>;
    sendBatch?(notifications: Notification[], preferences: NotificationPreferences): Promise<DeliveryReceipt[]>;
    canSend(notification: Notification, preferences: NotificationPreferences): boolean;
    healthCheck?(): Promise<boolean>;
}
interface QueueAdapter {
    enqueue(notification: Notification): Promise<void>;
    enqueueBatch(notifications: Notification[]): Promise<void>;
    enqueueDelayed(notification: Notification, delay: number): Promise<void>;
    dequeue(): Promise<Notification | null>;
    dequeueBatch(count: number): Promise<Notification[]>;
    getQueueSize(): Promise<number>;
    clear(): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
}
interface NotificationConfig {
    storage: StorageAdapter;
    transports: TransportAdapter[];
    queue?: QueueAdapter;
    workers?: {
        enabled?: boolean;
        concurrency?: number;
        pollInterval?: number;
    };
    retry?: {
        maxAttempts?: number;
        backoff?: 'linear' | 'exponential';
        initialDelay?: number;
        maxDelay?: number;
    };
    cleanup?: {
        enabled?: boolean;
        interval?: number;
        retentionDays?: number;
    };
    middleware?: NotificationMiddleware[];
}
type Unsubscribe = () => void;
interface NotificationEvent {
    type: 'sent' | 'delivered' | 'read' | 'unread' | 'failed';
    notification: Notification;
    timestamp: Date;
}
interface NotificationStats {
    total: number;
    unread: number;
    byStatus: Record<NotificationStatus, number>;
    byChannel: Record<ChannelType, number>;
    byPriority: Record<NotificationPriority, number>;
}

declare class NotificationCenter {
    private config;
    private storage;
    private transports;
    private queue?;
    private templates;
    private middleware;
    private subscribers;
    private eventSubscribers;
    private unreadSubscribers;
    private isRunning;
    private workerInterval?;
    constructor(config: NotificationConfig);
    send(input: NotificationInput): Promise<Notification>;
    sendBatch(inputs: NotificationInput[]): Promise<Notification[]>;
    sendMulticast(input: NotificationMulticastInput): Promise<Notification[]>;
    schedule(input: NotificationInput, when: Date): Promise<string>;
    getForUser(userId: string, filters?: NotificationFilters): Promise<Notification[]>;
    getUnreadCount(userId: string): Promise<number>;
    getById(id: string): Promise<Notification | null>;
    getStats(userId: string): Promise<NotificationStats>;
    markAsRead(notificationId: string): Promise<void>;
    markAllAsRead(userId: string): Promise<void>;
    markAsUnread(notificationId: string): Promise<void>;
    markAllAsUnread(userId: string): Promise<void>;
    delete(notificationId: string): Promise<void>;
    deleteAll(userId: string): Promise<void>;
    getPreferences(userId: string): Promise<NotificationPreferences>;
    updatePreferences(userId: string, prefs: Partial<NotificationPreferences>): Promise<void>;
    registerTemplate(template: NotificationTemplate): void;
    getTemplate(id: string): NotificationTemplate | undefined;
    unregisterTemplate(id: string): void;
    enableDigest(userId: string, config: DigestConfig): Promise<void>;
    disableDigest(userId: string): Promise<void>;
    getDigestConfig(userId: string): Promise<DigestConfig | null>;
    getDeliveryStatus(notificationId: string): Promise<DeliveryReceipt[]>;
    retryFailed(notificationId: string, channel?: ChannelType): Promise<void>;
    subscribe(userId: string, callback: (notification: Notification) => void): Unsubscribe;
    subscribeToEvents(userId: string, callback: (event: NotificationEvent) => void): Unsubscribe;
    onUnreadCountChange(userId: string, callback: (count: number, userId: string) => void): Unsubscribe;
    use(middleware: NotificationMiddleware): void;
    removeMiddleware(name: string): void;
    start(): Promise<void>;
    stop(): Promise<void>;
    healthCheck(): Promise<Record<string, boolean>>;
    private buildNotification;
    private sendNow;
    private startWorker;
    private startCleanup;
    private applyBeforeSendMiddleware;
    private applyAfterSendMiddleware;
    private applyErrorMiddleware;
    private notifySubscribers;
    private notifyEventSubscribers;
    private notifyUnreadSubscribers;
    private generateId;
}

declare class ConsoleTransportAdapter implements TransportAdapter {
    name: ChannelType;
    constructor(name?: ChannelType);
    send(notification: Notification): Promise<DeliveryReceipt>;
    canSend(notification: Notification, preferences: NotificationPreferences): boolean;
    healthCheck(): Promise<boolean>;
}

declare class MemoryQueueAdapter implements QueueAdapter {
    private queue;
    private delayedQueue;
    protected isRunning: boolean;
    private checkInterval?;
    enqueue(notification: Notification): Promise<void>;
    enqueueBatch(notifications: Notification[]): Promise<void>;
    enqueueDelayed(notification: Notification, delay: number): Promise<void>;
    dequeue(): Promise<Notification | null>;
    dequeueBatch(count: number): Promise<Notification[]>;
    getQueueSize(): Promise<number>;
    clear(): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    private processDelayed;
}

declare class MemoryStorageAdapter implements StorageAdapter {
    private notifications;
    private preferences;
    private receipts;
    save(notification: Notification): Promise<void>;
    saveBatch(notifications: Notification[]): Promise<void>;
    findById(id: string): Promise<Notification | null>;
    findByUser(userId: string, filters?: NotificationFilters): Promise<Notification[]>;
    countUnread(userId: string): Promise<number>;
    markAsRead(id: string): Promise<void>;
    markAllAsRead(userId: string): Promise<void>;
    markAsUnread(id: string): Promise<void>;
    markAllAsUnread(userId: string): Promise<void>;
    delete(id: string): Promise<void>;
    getPreferences(userId: string): Promise<NotificationPreferences>;
    savePreferences(userId: string, prefs: NotificationPreferences): Promise<void>;
    deleteExpired(): Promise<number>;
    saveReceipt(receipt: DeliveryReceipt): Promise<void>;
    getReceipts(notificationId: string): Promise<DeliveryReceipt[]>;
}

export { ChannelFrequency, ChannelPreferences, ChannelType, ConsoleTransportAdapter, DeliveryReceipt, DeliveryStatus, DigestConfig, DigestFrequency, MemoryQueueAdapter, MemoryStorageAdapter, Notification, NotificationAction, NotificationCenter, NotificationConfig, NotificationEvent, NotificationFilters, NotificationInput, NotificationMiddleware, NotificationMulticastInput, NotificationPreferences, NotificationPriority, NotificationStats, NotificationStatus, NotificationTemplate, QueueAdapter, QuietHours, StorageAdapter, TransportAdapter, Unsubscribe };
