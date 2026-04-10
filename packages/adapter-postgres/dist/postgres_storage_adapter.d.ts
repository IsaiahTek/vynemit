import { Pool, PoolConfig } from 'pg';
import { StorageAdapter, Notification, NotificationFilters, NotificationPreferences, DeliveryReceipt } from '@vynelix/vynemit-core';
export interface PostgresStorageConfig {
    pool?: Pool;
    connectionString?: string;
    poolConfig?: PoolConfig;
    schema?: string;
    tablePrefix?: string;
}
export declare class PostgresStorageAdapter implements StorageAdapter {
    private pool;
    private schema;
    private tablePrefix;
    constructor(config: PostgresStorageConfig);
    initialize(): Promise<void>;
    close(): Promise<void>;
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
    private rowToNotification;
    getNotificationsByGroup(groupId: string): Promise<Notification[]>;
    getScheduledNotifications(before?: Date): Promise<Notification[]>;
    getStatsByUser(userId: string): Promise<any>;
}
