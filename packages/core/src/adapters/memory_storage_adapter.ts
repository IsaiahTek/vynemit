
// ============================================================================
// MEMORY STORAGE ADAPTER

import { StorageAdapter, NotificationPreferences, DeliveryReceipt, NotificationFilters, Notification } from "../types";

// ============================================================================
export class MemoryStorageAdapter implements StorageAdapter {
  private notifications: Map<string, Notification> = new Map();
  private preferences: Map<string, NotificationPreferences> = new Map();
  private receipts: Map<string, DeliveryReceipt[]> = new Map();

  async save(notification: Notification): Promise<void> {
    this.notifications.set(notification.id, notification);
  }

  async saveBatch(notifications: Notification[]): Promise<void> {
    notifications.forEach(n => this.notifications.set(n.id, n));
  }

  async findById(id: string): Promise<Notification | null> {
    return this.notifications.get(id) || null;
  }

  async findByUser(userId: string, filters?: NotificationFilters): Promise<Notification[]> {
    let results = Array.from(this.notifications.values())
      .filter(n => n.userId === userId);

    if (filters) {
      if (filters.status) {
        const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
        results = results.filter(n => statuses.includes(n.status));
      }
      if (filters.type) {
        const types = Array.isArray(filters.type) ? filters.type : [filters.type];
        results = results.filter(n => types.includes(n.type));
      }
      if (filters.category) {
        const categories = Array.isArray(filters.category) ? filters.category : [filters.category];
        results = results.filter(n => n.category && categories.includes(n.category));
      }
      if (filters.startDate) {
        results = results.filter(n => n.createdAt >= filters.startDate!);
      }
      if (filters.endDate) {
        results = results.filter(n => n.createdAt <= filters.endDate!);
      }

      // Sort
      const sortBy = filters.sortBy || 'createdAt';
      const sortOrder = filters.sortOrder || 'desc';
      results.sort((a, b) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];
        if (!aVal || !bVal) return 0;
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortOrder === 'asc' ? comparison : -comparison;
      });

      // Pagination
      if (filters.offset) {
        results = results.slice(filters.offset);
      }
      if (filters.limit) {
        results = results.slice(0, filters.limit);
      }
    }

    return results;
  }

  async countUnread(userId: string): Promise<number> {
    return Array.from(this.notifications.values())
      .filter(n => n.userId === userId && n.status !== 'read')
      .length;
  }

  async markAsRead(id: string): Promise<void> {
    const notification = this.notifications.get(id);
    if (notification) {
      notification.status = 'read';
      notification.readAt = new Date();
      this.notifications.set(id, notification);
    }
  }

  async markAllAsRead(userId: string): Promise<void> {
    Array.from(this.notifications.values())
      .filter(n => n.userId === userId && n.status !== 'read')
      .forEach(n => {
        n.status = 'read';
        n.readAt = new Date();
        this.notifications.set(n.id, n);
      });
  }

  async markAsUnread(id: string): Promise<void> {
    const notification = this.notifications.get(id);
    if (notification) {
      notification.status = 'delivered';
      notification.readAt = undefined;
      this.notifications.set(id, notification);
    }
  }

  async markAllAsUnread(userId: string): Promise<void> {
    Array.from(this.notifications.values())
      .filter(n => n.userId === userId && n.status !== 'delivered')
      .forEach(n => {
        n.status = 'delivered';
        n.readAt = undefined;
        this.notifications.set(n.id, n);
      });
  }

  async delete(id: string): Promise<void> {
    this.notifications.delete(id);
    this.receipts.delete(id);
  }

  async getPreferences(userId: string): Promise<NotificationPreferences> {
    return this.preferences.get(userId) || {
      userId,
      channels: {},
      globalMute: false
    };
  }

  async savePreferences(userId: string, prefs: NotificationPreferences): Promise<void> {
    this.preferences.set(userId, prefs);
  }

  async deleteExpired(): Promise<number> {
    const now = new Date();
    let count = 0;

    Array.from(this.notifications.values())
      .filter(n => n.expiresAt && n.expiresAt < now)
      .forEach(n => {
        this.notifications.delete(n.id);
        count++;
      });

    return count;
  }

  async saveReceipt(receipt: DeliveryReceipt): Promise<void> {
    const existing = this.receipts.get(receipt.notificationId) || [];
    existing.push(receipt);
    this.receipts.set(receipt.notificationId, existing);
  }

  async getReceipts(notificationId: string): Promise<DeliveryReceipt[]> {
    return this.receipts.get(notificationId) || [];
  }
}
