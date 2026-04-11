import { NotificationConfig, NotificationInput, NotificationFilters, NotificationPreferences, Unsubscribe, ChannelType, DeliveryReceipt, DigestConfig, NotificationEvent, NotificationMiddleware, NotificationPriority, NotificationStats, NotificationStatus, NotificationTemplate, QueueAdapter, StorageAdapter, TransportAdapter, Notification, NotificationMulticastInput, EmailNotification, SmsNotification, PushNotification, InAppNotification } from "./types";
// ============================================================================
// NOTIFICATION CENTER IMPLEMENTATION
// ============================================================================

/**
 * The core NotificationCenter class responsible for dispatching, routing, storing,
 * and managing the lifecycle of notifications across multiple transports.
 */
export class NotificationCenter {
  /** The configuration object for the NotificationCenter. */
  private config: NotificationConfig;
  /** The storage adapter used for persisting notifications and preferences. */
  private storage: StorageAdapter;
  /** A map of available transport adapters, indexed by channel type. */
  private transports: Map<ChannelType, TransportAdapter>;
  /** The queue adapter used for asynchronous delivery and scheduling (optional). */
  private queue?: QueueAdapter;
  /** A map of registered notification templates. */
  private templates: Map<string, NotificationTemplate>;
  /** A list of middleware functions applied to notifications during their lifecycle. */
  private middleware: NotificationMiddleware[];
  /** Subscribers listening for raw incoming notifications by user ID. */
  private subscribers: Map<string, Set<(notification: Notification) => void>>;
  /** Subscribers listening for notification lifecycle events (e.g., read, sent) by user ID. */
  private eventSubscribers: Map<string, Set<(event: NotificationEvent) => void>>;
  /** Subscribers listening to unread count changes by user ID. */
  private unreadSubscribers: Map<string, Set<(count: number, userId: string) => void>>;
  /** Indicates whether the NotificationCenter background processes are currently running. */
  private isRunning: boolean;
  /** The interval handle for the queue worker. */
  private workerInterval?: NodeJS.Timeout;

  /**
   * Initializes a new NotificationCenter with the provided configuration.
   * @param config - The configuration options including adapters and transports.
   */
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

  /**
   * Dispatches a single notification based on the provided input.
   * If a queue is configured, the delivery takes place asynchronously.
   * 
   * @param input - The notification payload and routing instructions.
   * @returns A promise that resolves to the processed Notification object.
   */
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
        console.log("Notification queued");
        if (notification.scheduledFor) {
          console.log("Notification scheduled for: " + notification.scheduledFor.toLocaleDateString());
          const delay = notification.scheduledFor.getTime() - Date.now();
          console.log("Notification delay: " + delay + "ms");
          await this.queue.enqueueDelayed(notification, delay);
        } else {
          console.log("Notification sent directly after enqueue");
          await this.queue.enqueue(notification);
        }
      } else {
        console.log("Notification sent directly in sendNow");
        await this.sendNow(notification);
      }

      return notification;
    } catch (error) {
      // Apply middleware (onError)
      await this.applyErrorMiddleware(error as Error, notification);
      throw error;
    }
  }

  /**
   * Dispatches an array of notifications sequentially or concurrently.
   * 
   * @param inputs - An array of notification inputs.
   * @returns A promise resolving to an array of generated Notification objects.
   */
  async sendBatch(inputs: NotificationInput[]): Promise<Notification[]> {
    const notifications = await Promise.all(
      inputs.map(input => this.send(input))
    );
    return notifications;
  }

  /**
   * Sends an identical notification to a list of users (multicast).
   * Automatically optimizes push/sms transport delivery if transport supports bulk send.
   * 
   * @param input - Multicast payload including the target `userIds`.
   * @returns A promise resolving to the dispatched notifications.
   */
  async sendMulticast(input: NotificationMulticastInput): Promise<Notification[]> {
    // 1. Build and process notifications
    const notifications = await Promise.all(input.userIds.map(async (userId) => {
      const notificationInput: NotificationInput = { ...input, userId };
      let notification: Notification | null = this.buildNotification(notificationInput);
      notification = await this.applyBeforeSendMiddleware(notification);
      return notification;
    }));

    const validNotifications = notifications.filter((n): n is Notification => n !== null);
    if (validNotifications.length === 0) return [];

    // 2. Save all to storage
    await this.storage.saveBatch(validNotifications);

    // 3. Dispatch to transports
    const channels = input.channels !== undefined ? input.channels : Array.from(this.transports.keys());
    for (const channel of channels) {
      const transport = this.transports.get(channel);
      if (!transport) continue;

      try {
        if (transport.sendMulticast) {
          // Optimization: Resolve tokens for push/sms notifications if not present
          if (channel === 'push' || channel === 'sms') {
            await Promise.all(validNotifications.map(async (n) => {
              const field = channel === 'push' ? 'deviceToken' : 'phoneNumber';
              if (!(n.data as any)?.[field]) {
                const prefs = await this.storage.getPreferences(n.userId);
                if (prefs.data?.[field]) {
                  n.data = { ...(n.data || {}), [field]: prefs.data[field] };
                }
              }
            }));
          }

          const receipts = await transport.sendMulticast(validNotifications, {} as NotificationPreferences);
          if (this.storage.saveReceipt) {
            await Promise.all(receipts.map(r => this.storage.saveReceipt!(r)));
          }
        } else {
          // Fallback to individual sends ONLY for this transport, so we don't trigger sendNow() infinitely or double-fire
          await Promise.all(validNotifications.map(async (n) => {
             const prefs = await this.storage.getPreferences(n.userId);
             if (transport.canSend(n, prefs)) {
                try {
                  const receipt = await transport.send(n, prefs);
                  if (this.storage.saveReceipt) await this.storage.saveReceipt(receipt);
                } catch (error) {
                  const receipt: DeliveryReceipt = {
                     notificationId: n.id, channel, status: 'failed', attempts: 1, lastAttempt: new Date(), error: (error as Error).message
                  };
                  if (this.storage.saveReceipt) await this.storage.saveReceipt(receipt);
                }
             }
          }));
        }
      } catch (error) {
        // Fallback for this channel if multicast fails or other error
        console.error(`Multicast failed for channel ${channel}:`, error);
        await Promise.all(validNotifications.map(n => this.applyErrorMiddleware(error as Error, n)));
      }
    }

    // 4. Update status, apply middleware, and trigger local subscribers for each notification (crucial for SSE/WebSockets)
    await Promise.all(validNotifications.map(async (notification) => {
      notification.status = 'sent';
      await this.applyAfterSendMiddleware(notification);

      if (notification.channels.includes('inapp') || channels.includes('inapp')) {
        this.notifySubscribers(notification);
      }
      this.notifyEventSubscribers({
        type: 'sent',
        notification,
        timestamp: new Date()
      });

      await this.storage.save(notification);
    }));

    return validNotifications;
  }

  /**
   * Schedules a notification to be sent at a specific future date/time.
   * Automatically enqueues it if the queue adapter supports delayed jobs.
   * 
   * @param input - The notification input.
   * @param when - The Date at which the notification should be delivered.
   * @returns A promise resolving to the generated Notification ID.
   */
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

  /**
   * Retrieves notifications intended for a specific user ID.
   * 
   * @param userId - The target user's ID.
   * @param filters - Optional filters like status, type, limit, offset.
   * @returns A promise resolving to the list of matched notifications.
   */
  async getForUser(userId: string, filters?: NotificationFilters): Promise<Notification[]> {
    return this.storage.findByUser(userId, filters);
  }

  /**
   * Retrieves the current number of unread notifications for a specified user.
   * 
   * @param userId - The target user's ID.
   * @returns The count of unread notifications.
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.storage.countUnread(userId);
  }

  /**
   * Retrieves a specific notification by its unique ID.
   * 
   * @param id - The Notification ID.
   * @returns The notification object if found, otherwise null.
   */
  async getById(id: string): Promise<Notification | null> {
    return this.storage.findById(id);
  }

  /**
   * Aggregates notification statistics for a specified user (e.g., total, unread, counts by channel).
   * 
   * @param userId - The user's ID to fetch stats for.
   * @returns An object containing grouped statistics.
   */
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

  /**
   * Marks a specific notification as "read" and triggers real-time updates for listeners.
   * 
   * @param notificationId - The unique ID of the notification.
   */
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

  /**
   * Marks all notifications belonging to a user as "read".
   * 
   * @param userId - The user's ID.
   */
  async markAllAsRead(userId: string): Promise<void> {
    await this.storage.markAllAsRead(userId);

    // Update unread count
    this.notifyUnreadSubscribers(userId, 0);
  }

  /**
   * Reverts a notification status back to "unread".
   * 
   * @param notificationId - The unique ID of the notification.
   */
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

  /**
   * Marks all notifications belonging to a user as "unread".
   * 
   * @param userId - The target user's ID.
   */
  async markAllAsUnread(userId: string): Promise<void> {
    await this.storage.markAllAsUnread(userId);

    // Update unread count
    this.notifyUnreadSubscribers(userId, 0);
  }

  /**
   * Deletes a specific notification from storage.
   * 
   * @param notificationId - The Notification ID to delete.
   */
  async delete(notificationId: string): Promise<void> {
    const notification = await this.storage.findById(notificationId);
    await this.storage.delete(notificationId);

    // Update unread count if it was unread
    if (notification && notification.status !== 'read') {
      const count = await this.storage.countUnread(notification.userId);
      this.notifyUnreadSubscribers(notification.userId, count);
    }
  }

  /**
   * Deletes all notifications for a specific user.
   * 
   * @param userId - The user's ID.
   */
  async deleteAll(userId: string): Promise<void> {
    const notifications = await this.storage.findByUser(userId, {});
    await Promise.all(
      notifications.map(notif => this.storage.delete(notif.id))
    );

    this.notifyUnreadSubscribers(userId, 0);
  }

  // ========== PREFERENCES ==========

  /**
   * Retrieves the notification opt-in/opt-out routing preferences for a given user.
   * 
   * @param userId - The user's ID.
   * @returns A promise resolving to the user's NotificationPreferences.
   */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    return this.storage.getPreferences(userId);
  }

  /**
   * Updates the notification routing and delivery preferences for an user.
   * 
   * @param userId - The user's ID.
   * @param prefs - A partial object containing the updated preferences.
   */
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

  /**
   * Registers a notification template, mapping a named key to dynamic defaults/formatting.
   * 
   * @param template - The NotificationTemplate definitions.
   */
  registerTemplate(template: NotificationTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Looks up a registered template by its ID.
   * 
   * @param id - The ID of the template.
   * @returns The template object, or undefined if not found.
   */
  getTemplate(id: string): NotificationTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Unregisters a template from the NotificationCenter.
   * 
   * @param id - The template ID to remove.
   */
  unregisterTemplate(id: string): void {
    this.templates.delete(id);
  }

  // ========== DIGEST ==========

  /**
   * Enables batch notification "digests" for a specific user to prevent notification fatigue.
   * 
   * @param userId - The user's ID.
   * @param config - The timeframe and configuration for the user's digest.
   */
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

  /**
   * Disables the digest feature for a user, reverting to immediate delivery.
   * 
   * @param userId - The target user's ID.
   */
  async disableDigest(userId: string): Promise<void> {
    const prefs = await this.getPreferences(userId);
    const newData = { ...(prefs.data || {}) };
    delete newData.digestConfig;

    await this.updatePreferences(userId, {
      ...prefs,
      data: newData
    });
  }

  /**
   * Fetches the current digest rules configured for a user.
   * 
   * @param userId - The user's ID.
   * @returns The digest configuration, or null if disabled.
   */
  async getDigestConfig(userId: string): Promise<DigestConfig | null> {
    const prefs = await this.getPreferences(userId);
    return (prefs.data?.digestConfig as DigestConfig) || null;
  }

  // ========== DELIVERY STATUS ==========

  /**
   * Retrieves all delivery receipts generated from transports for a specific notification.
   * Useful to see which channels succeeded and which failed.
   * 
   * @param notificationId - The notification's ID.
   * @returns An array of delivery receipts.
   */
  async getDeliveryStatus(notificationId: string): Promise<DeliveryReceipt[]> {
    if (!this.storage.getReceipts) {
      return [];
    }
    return this.storage.getReceipts(notificationId);
  }

  /**
   * Attempts to resend a notification for any channels that previously marked it as "failed".
   * 
   * @param notificationId - The target notification ID.
   * @param channel - Optional channel scope. If provided, retries only on this specific transport.
   */
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

  /**
   * Registers a callback to be invoked whenever a notification is sent to a specific user.
   * 
   * @param userId - The target user's ID.
   * @param callback - Function to handle the raw notification map.
   * @returns A cleanup function to unsubscribe from this event.
   */
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

  /**
   * Registers a callback for state changes (e.g. read/unread status updates) for a user's notifications.
   * 
   * @param userId - The target user's ID.
   * @param callback - Lifecycle event listener.
   * @returns A cleanup function to unsubscribe.
   */
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

  /**
   * Registers a listener to react to changes in the unread notification count for a user.
   * 
   * @param userId - The user's ID.
   * @param callback - Handlers receiving the current unread count.
   * @returns Unsubscribe function.
   */
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

  /**
   * Injects a middleware interceptor to apply custom logic before or after notifications are sent.
   * 
   * @param middleware - The middleware object conforming to `NotificationMiddleware`.
   */
  use(middleware: NotificationMiddleware): void {
    this.middleware.push(middleware);
  }

  /**
   * Removes a previously configured middleware globally.
   * 
   * @param name - The name identifier of the middleware to remove.
   */
  removeMiddleware(name: string): void {
    this.middleware = this.middleware.filter(m => m.name !== name);
  }

  // ========== LIFECYCLE ==========

  /**
   * Boots up the NotificationCenter, initializing storage, queues, and worker loops if enabled.
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // Initialize storage if supported
    if (this.storage.initialize) {
      await this.storage.initialize();
    }

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

  /**
   * Gracefully shuts down the NotificationCenter, terminating background queues and workers.
   */
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

  /**
   * Pings all registered transports to report on their current health and active status.
   * 
   * @returns A map representing the readiness boolean state of each registered transport.
   */
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

  /** 
   * Applies metadata, templates, and defaults to construct the internal Notification shape.
   */
  private buildNotification(input: NotificationInput): Notification {
    const allChannels = Array.from(this.transports.keys());

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

      const text = input.text || (typeof template.defaults.text === 'function'
        ? template.defaults.text(input.data)
        : template.defaults.text);

      const html = input.html || (typeof template.defaults.html === 'function'
        ? template.defaults.html(input.data)
        : template.defaults.html);

      return {
        id: this.generateId(),
        type: input.type || template.type,
        title: input.title || title,
        body: input.body || body,
        text,
        html,
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
        // If channels are explicitly provided (even if empty), use them. 
        // Otherwise use template defaults.
        channels: input.channels !== undefined ? input.channels : template.defaults.channels,
        actions: input.actions
      };
    }

    // Build from input directly
    return {
      id: this.generateId(),
      type: input.type,
      title: input.title,
      body: input.body,
      text: input.text,
      html: input.html,
      data: input.data,
      userId: input.userId,
      groupId: input.groupId,
      priority: input.priority || 'normal',
      category: input.category,
      status: 'pending',
      createdAt: new Date(),
      scheduledFor: input.scheduledFor,
      expiresAt: input.expiresAt,
      // If channels are explicitly provided (even if empty), use them. 
      // Otherwise default to all registered transports.
      channels: input.channels !== undefined ? input.channels : allChannels,
      actions: input.actions
    };
  }

  /**
   * Internal mechanism sending payload out across desired transports without queue delay.
   */
  private async sendNow(notification: Notification): Promise<void> {
    const prefs = await this.getPreferences(notification.userId);

    // Send to each channel
    const receipts = await Promise.all(
      notification.channels.map(async (channel) => {
        const transport = this.transports.get(channel);
        if (!transport) {
          console.warn(`[NotificationCenter] No transport found for channel: ${channel}`);
          return null;
        }

        const channelNotification = this.castNotification(notification, channel);

        if (!transport.canSend(channelNotification, prefs)) {
          console.log(`[NotificationCenter] Delivery skipped for ${channel} due to preferences`);
          return null;
        }

        try {
          console.log(`[NotificationCenter] Attempting delivery through transport: ${channel}`);
          const receipt = await transport.send(channelNotification, prefs);
          console.log(`[NotificationCenter] Delivery completed for transport: ${channel}`);
          if (this.storage.saveReceipt) {
            await this.storage.saveReceipt(receipt);
          }
          return receipt;
        } catch (error) {
          console.error(`[NotificationCenter] Delivery failed for channel ${channel}:`, error);
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

    // Notify subscribers (in-app)
    if (notification.channels.includes('inapp')) {
      this.notifySubscribers(notification);
    }
    this.notifyEventSubscribers({
      type: 'sent',
      notification,
      timestamp: new Date()
    });

    await this.storage.save(notification);
  }

  private castNotification(notification: Notification, channel: ChannelType): any {
    switch (channel) {
      case 'email':
        return notification as EmailNotification;
      case 'sms':
        return notification as SmsNotification;
      case 'push':
        return notification as PushNotification;
      case 'inapp':
        return notification as InAppNotification;
      default:
        return notification;
    }
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