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
    text?: string;
    html?: string;
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
interface EmailNotification extends Notification {
    data: {
        email?: string;
        [key: string]: unknown;
    };
}
interface SmsNotification extends Notification {
    data: {
        phoneNumber?: string;
        [key: string]: unknown;
    };
}
interface PushNotification extends Notification {
    data: {
        deviceToken?: string;
        [key: string]: unknown;
    };
}
interface InAppNotification extends Notification {
    data?: Record<string, unknown>;
}
interface NotificationInput {
    type: string;
    title: string;
    body: string;
    text?: string;
    html?: string;
    userId: string;
    groupId?: string;
    data?: Record<string, unknown>;
    priority?: NotificationPriority;
    category?: string;
    channels?: ChannelType[];
    scheduledFor?: Date;
    expiresAt?: Date;
    actions?: NotificationAction[];
    template?: string;
}
interface NotificationMulticastInput {
    type: string;
    title: string;
    body: string;
    text?: string;
    html?: string;
    userIds: string[];
    data?: Record<string, unknown>;
    priority?: NotificationPriority;
    category?: string;
    channels?: ChannelType[];
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
        text?: string | ((data: any) => string);
        html?: string | ((data: any) => string);
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
    initialize?(): Promise<void>;
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
    sendMulticast?(notifications: Notification[], preferences: NotificationPreferences): Promise<DeliveryReceipt[]>;
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

/**
 * The core NotificationCenter class responsible for dispatching, routing, storing,
 * and managing the lifecycle of notifications across multiple transports.
 */
declare class NotificationCenter {
    /** The configuration object for the NotificationCenter. */
    private config;
    /** The storage adapter used for persisting notifications and preferences. */
    private storage;
    /** A map of available transport adapters, indexed by channel type. */
    private transports;
    /** The queue adapter used for asynchronous delivery and scheduling (optional). */
    private queue?;
    /** A map of registered notification templates. */
    private templates;
    /** A list of middleware functions applied to notifications during their lifecycle. */
    private middleware;
    /** Subscribers listening for raw incoming notifications by user ID. */
    private subscribers;
    /** Subscribers listening for notification lifecycle events (e.g., read, sent) by user ID. */
    private eventSubscribers;
    /** Subscribers listening to unread count changes by user ID. */
    private unreadSubscribers;
    /** Indicates whether the NotificationCenter background processes are currently running. */
    private isRunning;
    /** The interval handle for the queue worker. */
    private workerInterval?;
    /**
     * Initializes a new NotificationCenter with the provided configuration.
     * @param config - The configuration options including adapters and transports.
     */
    constructor(config: NotificationConfig);
    /**
     * Dispatches a single notification based on the provided input.
     * If a queue is configured, the delivery takes place asynchronously.
     *
     * @param input - The notification payload and routing instructions.
     * @returns A promise that resolves to the processed Notification object.
     */
    send(input: NotificationInput): Promise<Notification>;
    /**
     * Dispatches an array of notifications sequentially or concurrently.
     *
     * @param inputs - An array of notification inputs.
     * @returns A promise resolving to an array of generated Notification objects.
     */
    sendBatch(inputs: NotificationInput[]): Promise<Notification[]>;
    /**
     * Sends an identical notification to a list of users (multicast).
     * Automatically optimizes push/sms transport delivery if transport supports bulk send.
     *
     * @param input - Multicast payload including the target `userIds`.
     * @returns A promise resolving to the dispatched notifications.
     */
    sendMulticast(input: NotificationMulticastInput): Promise<Notification[]>;
    /**
     * Schedules a notification to be sent at a specific future date/time.
     * Automatically enqueues it if the queue adapter supports delayed jobs.
     *
     * @param input - The notification input.
     * @param when - The Date at which the notification should be delivered.
     * @returns A promise resolving to the generated Notification ID.
     */
    schedule(input: NotificationInput, when: Date): Promise<string>;
    /**
     * Retrieves notifications intended for a specific user ID.
     *
     * @param userId - The target user's ID.
     * @param filters - Optional filters like status, type, limit, offset.
     * @returns A promise resolving to the list of matched notifications.
     */
    getForUser(userId: string, filters?: NotificationFilters): Promise<Notification[]>;
    /**
     * Retrieves the current number of unread notifications for a specified user.
     *
     * @param userId - The target user's ID.
     * @returns The count of unread notifications.
     */
    getUnreadCount(userId: string): Promise<number>;
    /**
     * Retrieves a specific notification by its unique ID.
     *
     * @param id - The Notification ID.
     * @returns The notification object if found, otherwise null.
     */
    getById(id: string): Promise<Notification | null>;
    /**
     * Aggregates notification statistics for a specified user (e.g., total, unread, counts by channel).
     *
     * @param userId - The user's ID to fetch stats for.
     * @returns An object containing grouped statistics.
     */
    getStats(userId: string): Promise<NotificationStats>;
    /**
     * Marks a specific notification as "read" and triggers real-time updates for listeners.
     *
     * @param notificationId - The unique ID of the notification.
     */
    markAsRead(notificationId: string): Promise<void>;
    /**
     * Marks all notifications belonging to a user as "read".
     *
     * @param userId - The user's ID.
     */
    markAllAsRead(userId: string): Promise<void>;
    /**
     * Reverts a notification status back to "unread".
     *
     * @param notificationId - The unique ID of the notification.
     */
    markAsUnread(notificationId: string): Promise<void>;
    /**
     * Marks all notifications belonging to a user as "unread".
     *
     * @param userId - The target user's ID.
     */
    markAllAsUnread(userId: string): Promise<void>;
    /**
     * Deletes a specific notification from storage.
     *
     * @param notificationId - The Notification ID to delete.
     */
    delete(notificationId: string): Promise<void>;
    /**
     * Deletes all notifications for a specific user.
     *
     * @param userId - The user's ID.
     */
    deleteAll(userId: string): Promise<void>;
    /**
     * Retrieves the notification opt-in/opt-out routing preferences for a given user.
     *
     * @param userId - The user's ID.
     * @returns A promise resolving to the user's NotificationPreferences.
     */
    getPreferences(userId: string): Promise<NotificationPreferences>;
    /**
     * Updates the notification routing and delivery preferences for an user.
     *
     * @param userId - The user's ID.
     * @param prefs - A partial object containing the updated preferences.
     */
    updatePreferences(userId: string, prefs: Partial<NotificationPreferences>): Promise<void>;
    /**
     * Registers a notification template, mapping a named key to dynamic defaults/formatting.
     *
     * @param template - The NotificationTemplate definitions.
     */
    registerTemplate(template: NotificationTemplate): void;
    /**
     * Looks up a registered template by its ID.
     *
     * @param id - The ID of the template.
     * @returns The template object, or undefined if not found.
     */
    getTemplate(id: string): NotificationTemplate | undefined;
    /**
     * Unregisters a template from the NotificationCenter.
     *
     * @param id - The template ID to remove.
     */
    unregisterTemplate(id: string): void;
    /**
     * Enables batch notification "digests" for a specific user to prevent notification fatigue.
     *
     * @param userId - The user's ID.
     * @param config - The timeframe and configuration for the user's digest.
     */
    enableDigest(userId: string, config: DigestConfig): Promise<void>;
    /**
     * Disables the digest feature for a user, reverting to immediate delivery.
     *
     * @param userId - The target user's ID.
     */
    disableDigest(userId: string): Promise<void>;
    /**
     * Fetches the current digest rules configured for a user.
     *
     * @param userId - The user's ID.
     * @returns The digest configuration, or null if disabled.
     */
    getDigestConfig(userId: string): Promise<DigestConfig | null>;
    /**
     * Retrieves all delivery receipts generated from transports for a specific notification.
     * Useful to see which channels succeeded and which failed.
     *
     * @param notificationId - The notification's ID.
     * @returns An array of delivery receipts.
     */
    getDeliveryStatus(notificationId: string): Promise<DeliveryReceipt[]>;
    /**
     * Attempts to resend a notification for any channels that previously marked it as "failed".
     *
     * @param notificationId - The target notification ID.
     * @param channel - Optional channel scope. If provided, retries only on this specific transport.
     */
    retryFailed(notificationId: string, channel?: ChannelType): Promise<void>;
    /**
     * Registers a callback to be invoked whenever a notification is sent to a specific user.
     *
     * @param userId - The target user's ID.
     * @param callback - Function to handle the raw notification map.
     * @returns A cleanup function to unsubscribe from this event.
     */
    subscribe(userId: string, callback: (notification: Notification) => void): Unsubscribe;
    /**
     * Registers a callback for state changes (e.g. read/unread status updates) for a user's notifications.
     *
     * @param userId - The target user's ID.
     * @param callback - Lifecycle event listener.
     * @returns A cleanup function to unsubscribe.
     */
    subscribeToEvents(userId: string, callback: (event: NotificationEvent) => void): Unsubscribe;
    /**
     * Registers a listener to react to changes in the unread notification count for a user.
     *
     * @param userId - The user's ID.
     * @param callback - Handlers receiving the current unread count.
     * @returns Unsubscribe function.
     */
    onUnreadCountChange(userId: string, callback: (count: number, userId: string) => void): Unsubscribe;
    /**
     * Injects a middleware interceptor to apply custom logic before or after notifications are sent.
     *
     * @param middleware - The middleware object conforming to `NotificationMiddleware`.
     */
    use(middleware: NotificationMiddleware): void;
    /**
     * Removes a previously configured middleware globally.
     *
     * @param name - The name identifier of the middleware to remove.
     */
    removeMiddleware(name: string): void;
    /**
     * Boots up the NotificationCenter, initializing storage, queues, and worker loops if enabled.
     */
    start(): Promise<void>;
    /**
     * Gracefully shuts down the NotificationCenter, terminating background queues and workers.
     */
    stop(): Promise<void>;
    /**
     * Pings all registered transports to report on their current health and active status.
     *
     * @returns A map representing the readiness boolean state of each registered transport.
     */
    healthCheck(): Promise<Record<string, boolean>>;
    /**
     * Applies metadata, templates, and defaults to construct the internal Notification shape.
     */
    private buildNotification;
    /**
     * Internal mechanism sending payload out across desired transports without queue delay.
     */
    private sendNow;
    private castNotification;
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

export { ChannelFrequency, ChannelPreferences, ChannelType, ConsoleTransportAdapter, DeliveryReceipt, DeliveryStatus, DigestConfig, DigestFrequency, EmailNotification, InAppNotification, MemoryQueueAdapter, MemoryStorageAdapter, Notification, NotificationAction, NotificationCenter, NotificationConfig, NotificationEvent, NotificationFilters, NotificationInput, NotificationMiddleware, NotificationMulticastInput, NotificationPreferences, NotificationPriority, NotificationStats, NotificationStatus, NotificationTemplate, PushNotification, QueueAdapter, QuietHours, SmsNotification, StorageAdapter, TransportAdapter, Unsubscribe };
