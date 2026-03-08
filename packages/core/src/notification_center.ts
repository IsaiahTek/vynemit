import { NotificationConfig, NotificationInput, NotificationFilters, NotificationPreferences, Unsubscribe, ChannelType, DeliveryReceipt, DigestConfig, NotificationEvent, NotificationMiddleware, NotificationPriority, NotificationStats, NotificationStatus, NotificationTemplate, QueueAdapter, StorageAdapter, TransportAdapter, Notification, NotificationMulticastInput } from "./types";
// ============================================================================
// NOTIFICATION CENTER IMPLEMENTATION
// ============================================================================

export class NotificationCenter {
  private config: NotificationConfig;
  private storage: StorageAdapter;
  private transports: Map<ChannelType, TransportAdapter>;
  private queue?: QueueAdapter;
  private templates: Map<string, NotificationTemplate>;
  private middleware: NotificationMiddleware[];
  private subscribers: Map<string, Set<(notification: Notification) => void>>;
  private eventSubscribers: Map<string, Set<(event: NotificationEvent) => void>>;
  private unreadSubscribers: Map<string, Set<(count: number, userId: string) => void>>;
  private isRunning: boolean;
  private workerInterval?: NodeJS.Timeout;

  constructor(config: NotificationConfig) {
    this.config = config;
    this.storage = config.storage;
    this.queue = config.queue;
    this.middleware = config.middleware || [];

    // Initialize transports map
    this.transports = new Map();
    config.transports.forEach(transport => {
      this.transports.set(transport.name, transport);
    });

    // Initialize collections
    this.templates = new Map();
    this.subscribers = new Map();
    this.eventSubscribers = new Map();
    this.unreadSubscribers = new Map();
    this.isRunning = false;
  }

  // ========== DISPATCH ==========

  async send(input: NotificationInput): Promise<Notification> {
    // Build notification from input
    let notification: Notification | null = this.buildNotification(input);

    // Apply middleware (beforeSend)
    notification = await this.applyBeforeSendMiddleware(notification);
    if (!notification) {
      throw new Error('Notification was filtered out by middleware');
    }

    // Save to storage
    await this.storage.save(notification);

    try {
      // If queue is available, enqueue. Otherwise send directly
      if (this.queue) {
        console.log("📦 Notification queued");
        if (notification.scheduledFor) {
          console.log("📦 Notification scheduled for: " + notification.scheduledFor.toLocaleDateString());
          const delay = notification.scheduledFor.getTime() - Date.now();
          console.log("📦 Notification delay: " + delay + "ms");
          await this.queue.enqueueDelayed(notification, delay);
        } else {
          console.log("📦 Notification sent directly after enqueue");
          await this.queue.enqueue(notification);
        }
      } else {
        console.log("📦 Notification sent directly in sendNow");
        await this.sendNow(notification);
      }

      return notification;
    } catch (error) {
      // Apply middleware (onError)
      await this.applyErrorMiddleware(error as Error, notification);
      throw error;
    }
  }

  async sendBatch(inputs: NotificationInput[]): Promise<Notification[]> {
    const notifications = await Promise.all(
      inputs.map(input => this.send(input))
    );
    return notifications;
  }

  async sendMulticast(input: NotificationMulticastInput): Promise<Notification[]> {
    const notificationInputs: NotificationInput[] = [];
    for (const userId of input.userIds) {
      notificationInputs.push({
        ...input,
        userId
      });
    }
    return this.sendBatch(notificationInputs);
  }

  async schedule(input: NotificationInput, when: Date): Promise<string> {
    // Build notification with scheduled time
    let notification = this.buildNotification({ ...input, scheduledFor: when });
    // Apply beforeSend middleware
    let _notification = await this.applyBeforeSendMiddleware(notification);
    if (!_notification) {
      throw new Error('Notification was filtered out by middleware');
    }
    // Save to storage
    await this.storage.save(_notification);
    // Enqueue if queue is available, otherwise leave as pending
    if (this.queue) {
      const delay = when.getTime() - Date.now();
      if (delay > 0) {
        await this.queue.enqueueDelayed(_notification, delay);
      } else {
        await this.queue.enqueue(_notification);
      }
    }
    // Return the notification id
    return _notification.id;
  }

  // ========== QUERYING ==========

  async getForUser(userId: string, filters?: NotificationFilters): Promise<Notification[]> {
    return this.storage.findByUser(userId, filters);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.storage.countUnread(userId);
  }

  async getById(id: string): Promise<Notification | null> {
    return this.storage.findById(id);
  }

  async getStats(userId: string): Promise<NotificationStats> {
    const all = await this.storage.findByUser(userId, {});
    const unread = await this.storage.countUnread(userId);

    const stats: NotificationStats = {
      total: all.length,
      unread,
      byStatus: {} as Record<NotificationStatus, number>,
      byChannel: {} as Record<ChannelType, number>,
      byPriority: {} as Record<NotificationPriority, number>
    };

    // Count by status, channel, and priority
    all.forEach(notif => {
      stats.byStatus[notif.status] = (stats.byStatus[notif.status] || 0) + 1;
      stats.byPriority[notif.priority] = (stats.byPriority[notif.priority] || 0) + 1;
      notif.channels.forEach(channel => {
        stats.byChannel[channel] = (stats.byChannel[channel] || 0) + 1;
      });
    });

    return stats;
  }

  // ========== STATE MANAGEMENT ==========

  async markAsRead(notificationId: string): Promise<void> {
    await this.storage.markAsRead(notificationId);

    // Get notification and notify subscribers
    const notification = await this.storage.findById(notificationId);
    if (notification) {
      this.notifyEventSubscribers({
        type: 'read',
        notification,
        timestamp: new Date()
      });

      // Update unread count
      const count = await this.storage.countUnread(notification.userId);
      this.notifyUnreadSubscribers(notification.userId, count);
    }
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.storage.markAllAsRead(userId);

    // Update unread count
    this.notifyUnreadSubscribers(userId, 0);
  }

  async markAsUnread(notificationId: string): Promise<void> {
    await this.storage.markAsUnread(notificationId);

    // Get notification and notify subscribers
    const notification = await this.storage.findById(notificationId);
    if (notification) {
      this.notifyEventSubscribers({
        type: 'unread',
        notification,
        timestamp: new Date()
      });

      // Update unread count
      const count = await this.storage.countUnread(notification.userId);
      this.notifyUnreadSubscribers(notification.userId, count);
    }
  }

  async markAllAsUnread(userId: string): Promise<void> {
    await this.storage.markAllAsUnread(userId);

    // Update unread count
    this.notifyUnreadSubscribers(userId, 0);
  }

  async delete(notificationId: string): Promise<void> {
    const notification = await this.storage.findById(notificationId);
    await this.storage.delete(notificationId);

    // Update unread count if it was unread
    if (notification && notification.status !== 'read') {
      const count = await this.storage.countUnread(notification.userId);
      this.notifyUnreadSubscribers(notification.userId, count);
    }
  }

  async deleteAll(userId: string): Promise<void> {
    const notifications = await this.storage.findByUser(userId, {});
    await Promise.all(
      notifications.map(notif => this.storage.delete(notif.id))
    );

    this.notifyUnreadSubscribers(userId, 0);
  }

  // ========== PREFERENCES ==========

  async getPreferences(userId: string): Promise<NotificationPreferences> {
    return this.storage.getPreferences(userId);
  }

  async updatePreferences(
    userId: string,
    prefs: Partial<NotificationPreferences>
  ): Promise<void> {
    const current = await this.storage.getPreferences(userId);
    const updated: NotificationPreferences = {
      ...current,
      ...prefs,
      userId,
      updatedAt: new Date()
    };
    await this.storage.savePreferences(userId, updated);
  }

  // ========== TEMPLATES ==========

  registerTemplate(template: NotificationTemplate): void {
    this.templates.set(template.id, template);
  }

  getTemplate(id: string): NotificationTemplate | undefined {
    return this.templates.get(id);
  }

  unregisterTemplate(id: string): void {
    this.templates.delete(id);
  }

  // ========== DIGEST ==========

  async enableDigest(userId: string, config: DigestConfig): Promise<void> {
    // Store digest config in preferences metadata
    const prefs = await this.getPreferences(userId);
    await this.updatePreferences(userId, {
      ...prefs,
      data: {
        ...(prefs.data || {}),
        digestConfig: config
      }
    } as any);
  }

  async disableDigest(userId: string): Promise<void> {
    const prefs = await this.getPreferences(userId);
    const newData = { ...(prefs.data || {}) };
    delete newData.digestConfig;

    await this.updatePreferences(userId, {
      ...prefs,
      data: newData
    });
  }

  async getDigestConfig(userId: string): Promise<DigestConfig | null> {
    const prefs = await this.getPreferences(userId);
    return (prefs.data?.digestConfig as DigestConfig) || null;
  }

  // ========== DELIVERY STATUS ==========

  async getDeliveryStatus(notificationId: string): Promise<DeliveryReceipt[]> {
    if (!this.storage.getReceipts) {
      return [];
    }
    return this.storage.getReceipts(notificationId);
  }

  async retryFailed(notificationId: string, channel?: ChannelType): Promise<void> {
    const notification = await this.storage.findById(notificationId);
    if (!notification) {
      throw new Error(`Notification ${notificationId} not found`);
    }

    const receipts = await this.getDeliveryStatus(notificationId);
    const failedReceipts = receipts.filter(r =>
      r.status === 'failed' && (!channel || r.channel === channel)
    );

    for (const receipt of failedReceipts) {
      const transport = this.transports.get(receipt.channel);
      if (transport) {
        const prefs = await this.getPreferences(notification.userId);
        await transport.send(notification, prefs);
      }
    }
  }

  // ========== SUBSCRIPTIONS (Reactive) ==========

  subscribe(
    userId: string,
    callback: (notification: Notification) => void
  ): Unsubscribe {
    const sid = String(userId);
    if (!this.subscribers.has(sid)) {
      this.subscribers.set(sid, new Set());
    }
    this.subscribers.get(sid)!.add(callback);

    return () => {
      const subs = this.subscribers.get(sid);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscribers.delete(sid);
        }
      }
    };
  }

  subscribeToEvents(
    userId: string,
    callback: (event: NotificationEvent) => void
  ): Unsubscribe {
    const sid = String(userId);
    if (!this.eventSubscribers.has(sid)) {
      this.eventSubscribers.set(sid, new Set());
    }
    this.eventSubscribers.get(sid)!.add(callback);

    return () => {
      const subs = this.eventSubscribers.get(sid);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.eventSubscribers.delete(sid);
        }
      }
    };
  }

  onUnreadCountChange(
    userId: string,
    callback: (count: number, userId: string) => void
  ): Unsubscribe {
    const sid = String(userId);
    if (!this.unreadSubscribers.has(sid)) {
      this.unreadSubscribers.set(sid, new Set());
    }
    this.unreadSubscribers.get(sid)!.add(callback);

    return () => {
      const subs = this.unreadSubscribers.get(sid);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.unreadSubscribers.delete(sid);
        }
      }
    };
  }


  // ========== MIDDLEWARE ==========

  use(middleware: NotificationMiddleware): void {
    this.middleware.push(middleware);
  }

  removeMiddleware(name: string): void {
    this.middleware = this.middleware.filter(m => m.name !== name);
  }

  // ========== LIFECYCLE ==========

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // Start queue if available
    if (this.queue) {
      await this.queue.start();

      // Start worker
      if (this.config.workers?.enabled !== false) {
        this.startWorker();
      }
    }

    // Start cleanup job if enabled
    if (this.config.cleanup?.enabled) {
      this.startCleanup();
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Stop worker
    if (this.workerInterval) {
      clearInterval(this.workerInterval);
      this.workerInterval = undefined;
    }

    // Stop queue if available
    if (this.queue) {
      await this.queue.stop();
    }
  }

  async healthCheck(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const [name, transport] of this.transports) {
      if (transport.healthCheck) {
        try {
          results[name] = await transport.healthCheck();
        } catch {
          results[name] = false;
        }
      } else {
        results[name] = true; // Assume healthy if no health check
      }
    }

    return results;
  }

  // ========== PRIVATE METHODS ==========

  private buildNotification(input: NotificationInput): Notification {
    // If using template, merge with template defaults
    if (input.template) {
      const template = this.templates.get(input.template);
      if (!template) {
        throw new Error(`Template ${input.template} not found`);
      }

      const title = typeof template.defaults.title === 'function'
        ? template.defaults.title(input.data)
        : template.defaults.title;

      const body = typeof template.defaults.body === 'function'
        ? template.defaults.body(input.data)
        : template.defaults.body;

      return {
        id: this.generateId(),
        type: input.type || template.type,
        title: input.title || title,
        body: input.body || body,
        data: input.data,
        userId: input.userId,
        groupId: input.groupId,
        priority: input.priority || template.defaults.priority,
        category: input.category || template.defaults.category,
        status: 'pending',
        createdAt: new Date(),
        scheduledFor: input.scheduledFor,
        expiresAt: input.expiresAt || (
          template.defaults.expiresIn
            ? new Date(Date.now() + template.defaults.expiresIn)
            : undefined
        ),
        channels: input.channels.length ? input.channels : template.defaults.channels,
        actions: input.actions
      };
    }

    // Build from input directly
    return {
      id: this.generateId(),
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data,
      userId: input.userId,
      groupId: input.groupId,
      priority: input.priority || 'normal',
      category: input.category,
      status: 'pending',
      createdAt: new Date(),
      scheduledFor: input.scheduledFor,
      expiresAt: input.expiresAt,
      channels: input.channels,
      actions: input.actions
    };
  }

  private async sendNow(notification: Notification): Promise<void> {
    const prefs = await this.getPreferences(notification.userId);

    // Send to each channel
    const receipts = await Promise.all(
      notification.channels.map(async (channel) => {
        const transport = this.transports.get(channel);
        if (!transport) {
          return null;
        }

        if (!transport.canSend(notification, prefs)) {
          return null;
        }

        try {
          const receipt = await transport.send(notification, prefs);
          if (this.storage.saveReceipt) {
            await this.storage.saveReceipt(receipt);
          }
          return receipt;
        } catch (error) {
          const receipt: DeliveryReceipt = {
            notificationId: notification.id,
            channel,
            status: 'failed',
            attempts: 1,
            lastAttempt: new Date(),
            error: (error as Error).message
          };
          if (this.storage.saveReceipt) {
            await this.storage.saveReceipt(receipt);
          }
          return receipt;
        }
      })
    );

    // Update notification status based on receipts
    const allFailed = receipts.every(r => !r || r.status === 'failed');
    const anyDelivered = receipts.some(r => r && r.status === 'delivered');

    if (receipts.length) {
      notification.status = allFailed ? 'failed' : (anyDelivered ? 'delivered' : 'sent');
    } else {
      // No external transports ran. Assume internal (WebSocket/DB) delivery is successful.
      notification.status = 'sent';
    }

    // Apply middleware (afterSend)
    await this.applyAfterSendMiddleware(notification);

    // Notify subscribers
    this.notifySubscribers(notification);
    this.notifyEventSubscribers({
      type: 'sent',
      notification,
      timestamp: new Date()
    });

    await this.storage.save(notification);
  }

  private startWorker(): void {
    const pollInterval = this.config.workers?.pollInterval || 1000;
    const concurrency = this.config.workers?.concurrency || 1;

    this.workerInterval = setInterval(async () => {
      if (!this.queue) return;

      const notifications = await this.queue.dequeueBatch(concurrency);

      await Promise.all(
        notifications.map(notif => this.sendNow(notif))
      );
    }, pollInterval);
  }

  private startCleanup(): void {
    const interval = this.config.cleanup?.interval || 3600000; // 1 hour

    setInterval(async () => {
      await this.storage.deleteExpired();
    }, interval);
  }

  private async applyBeforeSendMiddleware(
    notification: Notification
  ): Promise<Notification | null> {
    let current: Notification | null = notification;

    for (const middleware of this.middleware) {
      if (middleware.beforeSend) {
        current = await middleware.beforeSend(current);
        if (!current) break;
      }
    }

    return current;
  }

  private async applyAfterSendMiddleware(notification: Notification): Promise<void> {
    for (const middleware of this.middleware) {
      if (middleware.afterSend) {
        await middleware.afterSend(notification);
      }
    }
  }

  private async applyErrorMiddleware(
    error: Error,
    notification: Notification
  ): Promise<void> {
    for (const middleware of this.middleware) {
      if (middleware.onError) {
        await middleware.onError(error, notification);
      }
    }
  }

  private notifySubscribers(notification: Notification): void {
    const subs = this.subscribers.get(String(notification.userId));
    if (subs) {
      subs.forEach(callback => callback(notification));
    }
  }

  private notifyEventSubscribers(event: NotificationEvent): void {
    const subs = this.eventSubscribers.get(String(event.notification.userId));
    if (subs) {
      subs.forEach(callback => callback(event));
    }
  }

  private notifyUnreadSubscribers(userId: string, count: number): void {
    const subs = this.unreadSubscribers.get(String(userId));
    if (subs) {
      subs.forEach(callback => callback(count, userId));
    }
  }

  private generateId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}