import { DeliveryReceipt, NotificationFilters, NotificationPreferences, Notification } from "../types";

export interface StorageAdapter {
  save(notification: Notification): Promise<void>;
  saveBatch(notifications: Notification[]): Promise<void>;
  findById(id: string): Promise<Notification | null>;
  findByUser(userId: string, filters?: NotificationFilters): Promise<Notification[]>;
  countUnread(userId: string): Promise<number>;
  markAsRead(id: string): Promise<void>;
  markAllAsRead(userId: string): Promise<void>;
  delete(id: string): Promise<void>;
  getPreferences(userId: string): Promise<NotificationPreferences>;
  savePreferences(userId: string, prefs: NotificationPreferences): Promise<void>;
  deleteExpired(): Promise<number>;
  saveReceipt?(receipt: DeliveryReceipt): Promise<void>;
  getReceipts?(notificationId: string): Promise<DeliveryReceipt[]>;
}