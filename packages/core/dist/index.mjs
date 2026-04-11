// src/notification_center.ts
var NotificationCenter = class {
  /**
   * Initializes a new NotificationCenter with the provided configuration.
   * @param config - The configuration options including adapters and transports.
   */
  constructor(config) {
    this.config = config;
    this.storage = config.storage;
    this.queue = config.queue;
    this.middleware = config.middleware || [];
    this.transports = /* @__PURE__ */ new Map();
    config.transports.forEach((transport) => {
      this.transports.set(transport.name, transport);
    });
    this.templates = /* @__PURE__ */ new Map();
    this.subscribers = /* @__PURE__ */ new Map();
    this.eventSubscribers = /* @__PURE__ */ new Map();
    this.unreadSubscribers = /* @__PURE__ */ new Map();
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
  async send(input) {
    let notification = this.buildNotification(input);
    notification = await this.applyBeforeSendMiddleware(notification);
    if (!notification) {
      throw new Error("Notification was filtered out by middleware");
    }
    await this.storage.save(notification);
    try {
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
      await this.applyErrorMiddleware(error, notification);
      throw error;
    }
  }
  /**
   * Dispatches an array of notifications sequentially or concurrently.
   * 
   * @param inputs - An array of notification inputs.
   * @returns A promise resolving to an array of generated Notification objects.
   */
  async sendBatch(inputs) {
    const notifications = await Promise.all(
      inputs.map((input) => this.send(input))
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
  async sendMulticast(input) {
    const notifications = await Promise.all(input.userIds.map(async (userId) => {
      const notificationInput = { ...input, userId };
      let notification = this.buildNotification(notificationInput);
      notification = await this.applyBeforeSendMiddleware(notification);
      return notification;
    }));
    const validNotifications = notifications.filter((n) => n !== null);
    if (validNotifications.length === 0)
      return [];
    await this.storage.saveBatch(validNotifications);
    const channels = input.channels !== void 0 ? input.channels : Array.from(this.transports.keys());
    for (const channel of channels) {
      const transport = this.transports.get(channel);
      if (!transport)
        continue;
      try {
        if (transport.sendMulticast) {
          if (channel === "push" || channel === "sms") {
            await Promise.all(validNotifications.map(async (n) => {
              const field = channel === "push" ? "deviceToken" : "phoneNumber";
              if (!n.data?.[field]) {
                const prefs = await this.storage.getPreferences(n.userId);
                if (prefs.data?.[field]) {
                  n.data = { ...n.data || {}, [field]: prefs.data[field] };
                }
              }
            }));
          }
          const receipts = await transport.sendMulticast(validNotifications, {});
          if (this.storage.saveReceipt) {
            await Promise.all(receipts.map((r) => this.storage.saveReceipt(r)));
          }
        } else {
          await Promise.all(validNotifications.map(async (n) => {
            const prefs = await this.storage.getPreferences(n.userId);
            if (transport.canSend(n, prefs)) {
              try {
                const receipt = await transport.send(n, prefs);
                if (this.storage.saveReceipt)
                  await this.storage.saveReceipt(receipt);
              } catch (error) {
                const receipt = {
                  notificationId: n.id,
                  channel,
                  status: "failed",
                  attempts: 1,
                  lastAttempt: /* @__PURE__ */ new Date(),
                  error: error.message
                };
                if (this.storage.saveReceipt)
                  await this.storage.saveReceipt(receipt);
              }
            }
          }));
        }
      } catch (error) {
        console.error(`Multicast failed for channel ${channel}:`, error);
        await Promise.all(validNotifications.map((n) => this.applyErrorMiddleware(error, n)));
      }
    }
    await Promise.all(validNotifications.map(async (notification) => {
      notification.status = "sent";
      await this.applyAfterSendMiddleware(notification);
      if (notification.channels.includes("inapp") || channels.includes("inapp")) {
        this.notifySubscribers(notification);
      }
      this.notifyEventSubscribers({
        type: "sent",
        notification,
        timestamp: /* @__PURE__ */ new Date()
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
  async schedule(input, when) {
    let notification = this.buildNotification({ ...input, scheduledFor: when });
    let _notification = await this.applyBeforeSendMiddleware(notification);
    if (!_notification) {
      throw new Error("Notification was filtered out by middleware");
    }
    await this.storage.save(_notification);
    if (this.queue) {
      const delay = when.getTime() - Date.now();
      if (delay > 0) {
        await this.queue.enqueueDelayed(_notification, delay);
      } else {
        await this.queue.enqueue(_notification);
      }
    }
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
  async getForUser(userId, filters) {
    return this.storage.findByUser(userId, filters);
  }
  /**
   * Retrieves the current number of unread notifications for a specified user.
   * 
   * @param userId - The target user's ID.
   * @returns The count of unread notifications.
   */
  async getUnreadCount(userId) {
    return this.storage.countUnread(userId);
  }
  /**
   * Retrieves a specific notification by its unique ID.
   * 
   * @param id - The Notification ID.
   * @returns The notification object if found, otherwise null.
   */
  async getById(id) {
    return this.storage.findById(id);
  }
  /**
   * Aggregates notification statistics for a specified user (e.g., total, unread, counts by channel).
   * 
   * @param userId - The user's ID to fetch stats for.
   * @returns An object containing grouped statistics.
   */
  async getStats(userId) {
    const all = await this.storage.findByUser(userId, {});
    const unread = await this.storage.countUnread(userId);
    const stats = {
      total: all.length,
      unread,
      byStatus: {},
      byChannel: {},
      byPriority: {}
    };
    all.forEach((notif) => {
      stats.byStatus[notif.status] = (stats.byStatus[notif.status] || 0) + 1;
      stats.byPriority[notif.priority] = (stats.byPriority[notif.priority] || 0) + 1;
      notif.channels.forEach((channel) => {
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
  async markAsRead(notificationId) {
    await this.storage.markAsRead(notificationId);
    const notification = await this.storage.findById(notificationId);
    if (notification) {
      this.notifyEventSubscribers({
        type: "read",
        notification,
        timestamp: /* @__PURE__ */ new Date()
      });
      const count = await this.storage.countUnread(notification.userId);
      this.notifyUnreadSubscribers(notification.userId, count);
    }
  }
  /**
   * Marks all notifications belonging to a user as "read".
   * 
   * @param userId - The user's ID.
   */
  async markAllAsRead(userId) {
    await this.storage.markAllAsRead(userId);
    this.notifyUnreadSubscribers(userId, 0);
  }
  /**
   * Reverts a notification status back to "unread".
   * 
   * @param notificationId - The unique ID of the notification.
   */
  async markAsUnread(notificationId) {
    await this.storage.markAsUnread(notificationId);
    const notification = await this.storage.findById(notificationId);
    if (notification) {
      this.notifyEventSubscribers({
        type: "unread",
        notification,
        timestamp: /* @__PURE__ */ new Date()
      });
      const count = await this.storage.countUnread(notification.userId);
      this.notifyUnreadSubscribers(notification.userId, count);
    }
  }
  /**
   * Marks all notifications belonging to a user as "unread".
   * 
   * @param userId - The target user's ID.
   */
  async markAllAsUnread(userId) {
    await this.storage.markAllAsUnread(userId);
    this.notifyUnreadSubscribers(userId, 0);
  }
  /**
   * Deletes a specific notification from storage.
   * 
   * @param notificationId - The Notification ID to delete.
   */
  async delete(notificationId) {
    const notification = await this.storage.findById(notificationId);
    await this.storage.delete(notificationId);
    if (notification && notification.status !== "read") {
      const count = await this.storage.countUnread(notification.userId);
      this.notifyUnreadSubscribers(notification.userId, count);
    }
  }
  /**
   * Deletes all notifications for a specific user.
   * 
   * @param userId - The user's ID.
   */
  async deleteAll(userId) {
    const notifications = await this.storage.findByUser(userId, {});
    await Promise.all(
      notifications.map((notif) => this.storage.delete(notif.id))
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
  async getPreferences(userId) {
    return this.storage.getPreferences(userId);
  }
  /**
   * Updates the notification routing and delivery preferences for an user.
   * 
   * @param userId - The user's ID.
   * @param prefs - A partial object containing the updated preferences.
   */
  async updatePreferences(userId, prefs) {
    const current = await this.storage.getPreferences(userId);
    const updated = {
      ...current,
      ...prefs,
      userId,
      updatedAt: /* @__PURE__ */ new Date()
    };
    await this.storage.savePreferences(userId, updated);
  }
  // ========== TEMPLATES ==========
  /**
   * Registers a notification template, mapping a named key to dynamic defaults/formatting.
   * 
   * @param template - The NotificationTemplate definitions.
   */
  registerTemplate(template) {
    this.templates.set(template.id, template);
  }
  /**
   * Looks up a registered template by its ID.
   * 
   * @param id - The ID of the template.
   * @returns The template object, or undefined if not found.
   */
  getTemplate(id) {
    return this.templates.get(id);
  }
  /**
   * Unregisters a template from the NotificationCenter.
   * 
   * @param id - The template ID to remove.
   */
  unregisterTemplate(id) {
    this.templates.delete(id);
  }
  // ========== DIGEST ==========
  /**
   * Enables batch notification "digests" for a specific user to prevent notification fatigue.
   * 
   * @param userId - The user's ID.
   * @param config - The timeframe and configuration for the user's digest.
   */
  async enableDigest(userId, config) {
    const prefs = await this.getPreferences(userId);
    await this.updatePreferences(userId, {
      ...prefs,
      data: {
        ...prefs.data || {},
        digestConfig: config
      }
    });
  }
  /**
   * Disables the digest feature for a user, reverting to immediate delivery.
   * 
   * @param userId - The target user's ID.
   */
  async disableDigest(userId) {
    const prefs = await this.getPreferences(userId);
    const newData = { ...prefs.data || {} };
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
  async getDigestConfig(userId) {
    const prefs = await this.getPreferences(userId);
    return prefs.data?.digestConfig || null;
  }
  // ========== DELIVERY STATUS ==========
  /**
   * Retrieves all delivery receipts generated from transports for a specific notification.
   * Useful to see which channels succeeded and which failed.
   * 
   * @param notificationId - The notification's ID.
   * @returns An array of delivery receipts.
   */
  async getDeliveryStatus(notificationId) {
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
  async retryFailed(notificationId, channel) {
    const notification = await this.storage.findById(notificationId);
    if (!notification) {
      throw new Error(`Notification ${notificationId} not found`);
    }
    const receipts = await this.getDeliveryStatus(notificationId);
    const failedReceipts = receipts.filter(
      (r) => r.status === "failed" && (!channel || r.channel === channel)
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
  subscribe(userId, callback) {
    const sid = String(userId);
    if (!this.subscribers.has(sid)) {
      this.subscribers.set(sid, /* @__PURE__ */ new Set());
    }
    this.subscribers.get(sid).add(callback);
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
  subscribeToEvents(userId, callback) {
    const sid = String(userId);
    if (!this.eventSubscribers.has(sid)) {
      this.eventSubscribers.set(sid, /* @__PURE__ */ new Set());
    }
    this.eventSubscribers.get(sid).add(callback);
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
  onUnreadCountChange(userId, callback) {
    const sid = String(userId);
    if (!this.unreadSubscribers.has(sid)) {
      this.unreadSubscribers.set(sid, /* @__PURE__ */ new Set());
    }
    this.unreadSubscribers.get(sid).add(callback);
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
  use(middleware) {
    this.middleware.push(middleware);
  }
  /**
   * Removes a previously configured middleware globally.
   * 
   * @param name - The name identifier of the middleware to remove.
   */
  removeMiddleware(name) {
    this.middleware = this.middleware.filter((m) => m.name !== name);
  }
  // ========== LIFECYCLE ==========
  /**
   * Boots up the NotificationCenter, initializing storage, queues, and worker loops if enabled.
   */
  async start() {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;
    if (this.storage.initialize) {
      await this.storage.initialize();
    }
    if (this.queue) {
      await this.queue.start();
      if (this.config.workers?.enabled !== false) {
        this.startWorker();
      }
    }
    if (this.config.cleanup?.enabled) {
      this.startCleanup();
    }
  }
  /**
   * Gracefully shuts down the NotificationCenter, terminating background queues and workers.
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }
    this.isRunning = false;
    if (this.workerInterval) {
      clearInterval(this.workerInterval);
      this.workerInterval = void 0;
    }
    if (this.queue) {
      await this.queue.stop();
    }
  }
  /**
   * Pings all registered transports to report on their current health and active status.
   * 
   * @returns A map representing the readiness boolean state of each registered transport.
   */
  async healthCheck() {
    const results = {};
    for (const [name, transport] of this.transports) {
      if (transport.healthCheck) {
        try {
          results[name] = await transport.healthCheck();
        } catch {
          results[name] = false;
        }
      } else {
        results[name] = true;
      }
    }
    return results;
  }
  // ========== PRIVATE METHODS ==========
  /** 
   * Applies metadata, templates, and defaults to construct the internal Notification shape.
   */
  buildNotification(input) {
    const allChannels = Array.from(this.transports.keys());
    if (input.template) {
      const template = this.templates.get(input.template);
      if (!template) {
        throw new Error(`Template ${input.template} not found`);
      }
      const title = typeof template.defaults.title === "function" ? template.defaults.title(input.data) : template.defaults.title;
      const body = typeof template.defaults.body === "function" ? template.defaults.body(input.data) : template.defaults.body;
      const text = input.text || (typeof template.defaults.text === "function" ? template.defaults.text(input.data) : template.defaults.text);
      const html = input.html || (typeof template.defaults.html === "function" ? template.defaults.html(input.data) : template.defaults.html);
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
        status: "pending",
        createdAt: /* @__PURE__ */ new Date(),
        scheduledFor: input.scheduledFor,
        expiresAt: input.expiresAt || (template.defaults.expiresIn ? new Date(Date.now() + template.defaults.expiresIn) : void 0),
        // If channels are explicitly provided (even if empty), use them. 
        // Otherwise use template defaults.
        channels: input.channels !== void 0 ? input.channels : template.defaults.channels,
        actions: input.actions
      };
    }
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
      priority: input.priority || "normal",
      category: input.category,
      status: "pending",
      createdAt: /* @__PURE__ */ new Date(),
      scheduledFor: input.scheduledFor,
      expiresAt: input.expiresAt,
      // If channels are explicitly provided (even if empty), use them. 
      // Otherwise default to all registered transports.
      channels: input.channels !== void 0 ? input.channels : allChannels,
      actions: input.actions
    };
  }
  /**
   * Internal mechanism sending payload out across desired transports without queue delay.
   */
  async sendNow(notification) {
    const prefs = await this.getPreferences(notification.userId);
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
          const receipt = {
            notificationId: notification.id,
            channel,
            status: "failed",
            attempts: 1,
            lastAttempt: /* @__PURE__ */ new Date(),
            error: error.message
          };
          if (this.storage.saveReceipt) {
            await this.storage.saveReceipt(receipt);
          }
          return receipt;
        }
      })
    );
    const allFailed = receipts.every((r) => !r || r.status === "failed");
    const anyDelivered = receipts.some((r) => r && r.status === "delivered");
    if (receipts.length) {
      notification.status = allFailed ? "failed" : anyDelivered ? "delivered" : "sent";
    } else {
      notification.status = "sent";
    }
    await this.applyAfterSendMiddleware(notification);
    if (notification.channels.includes("inapp")) {
      this.notifySubscribers(notification);
    }
    this.notifyEventSubscribers({
      type: "sent",
      notification,
      timestamp: /* @__PURE__ */ new Date()
    });
    await this.storage.save(notification);
  }
  castNotification(notification, channel) {
    switch (channel) {
      case "email":
        return notification;
      case "sms":
        return notification;
      case "push":
        return notification;
      case "inapp":
        return notification;
      default:
        return notification;
    }
  }
  startWorker() {
    const pollInterval = this.config.workers?.pollInterval || 1e3;
    const concurrency = this.config.workers?.concurrency || 1;
    this.workerInterval = setInterval(async () => {
      if (!this.queue)
        return;
      const notifications = await this.queue.dequeueBatch(concurrency);
      await Promise.all(
        notifications.map((notif) => this.sendNow(notif))
      );
    }, pollInterval);
  }
  startCleanup() {
    const interval = this.config.cleanup?.interval || 36e5;
    setInterval(async () => {
      await this.storage.deleteExpired();
    }, interval);
  }
  async applyBeforeSendMiddleware(notification) {
    let current = notification;
    for (const middleware of this.middleware) {
      if (middleware.beforeSend) {
        current = await middleware.beforeSend(current);
        if (!current)
          break;
      }
    }
    return current;
  }
  async applyAfterSendMiddleware(notification) {
    for (const middleware of this.middleware) {
      if (middleware.afterSend) {
        await middleware.afterSend(notification);
      }
    }
  }
  async applyErrorMiddleware(error, notification) {
    for (const middleware of this.middleware) {
      if (middleware.onError) {
        await middleware.onError(error, notification);
      }
    }
  }
  notifySubscribers(notification) {
    const subs = this.subscribers.get(String(notification.userId));
    if (subs) {
      subs.forEach((callback) => callback(notification));
    }
  }
  notifyEventSubscribers(event) {
    const subs = this.eventSubscribers.get(String(event.notification.userId));
    if (subs) {
      subs.forEach((callback) => callback(event));
    }
  }
  notifyUnreadSubscribers(userId, count) {
    const subs = this.unreadSubscribers.get(String(userId));
    if (subs) {
      subs.forEach((callback) => callback(count, userId));
    }
  }
  generateId() {
    return `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
};

// src/adapters/console_transport_adapter.ts
var ConsoleTransportAdapter = class {
  constructor(name = "inapp") {
    this.name = "inapp";
    this.name = name;
  }
  async send(notification) {
    console.log(`[${this.name.toUpperCase()}] Notification sent:`, {
      id: notification.id,
      title: notification.title,
      body: notification.body,
      userId: notification.userId,
      type: notification.type,
      priority: notification.priority
    });
    return {
      notificationId: notification.id,
      channel: this.name,
      status: "delivered",
      attempts: 1,
      lastAttempt: /* @__PURE__ */ new Date()
    };
  }
  canSend(notification, preferences) {
    if (preferences.globalMute) {
      return false;
    }
    const channelPref = preferences.channels[this.name];
    if (channelPref && !channelPref.enabled) {
      return false;
    }
    if (channelPref?.categories && notification.category) {
      if (!channelPref.categories.includes(notification.category)) {
        return false;
      }
    }
    if (channelPref?.quietHours) {
      const now = /* @__PURE__ */ new Date();
      const currentHour = now.getHours();
      const [startHour] = channelPref.quietHours.start.split(":").map(Number);
      const [endHour] = channelPref.quietHours.end.split(":").map(Number);
      if (startHour > endHour) {
        if (currentHour >= startHour || currentHour < endHour) {
          return false;
        }
      } else {
        if (currentHour >= startHour && currentHour < endHour) {
          return false;
        }
      }
    }
    return true;
  }
  async healthCheck() {
    return true;
  }
};

// src/adapters/memory_queue_adapter.ts
var MemoryQueueAdapter = class {
  constructor() {
    this.queue = [];
    this.delayedQueue = [];
    this.isRunning = false;
  }
  async enqueue(notification) {
    this.queue.push(notification);
  }
  async enqueueBatch(notifications) {
    this.queue.push(...notifications);
  }
  async enqueueDelayed(notification, delay) {
    this.delayedQueue.push({
      notification,
      executeAt: new Date(Date.now() + delay)
    });
  }
  async dequeue() {
    return this.queue.shift() || null;
  }
  async dequeueBatch(count) {
    return this.queue.splice(0, count);
  }
  async getQueueSize() {
    return this.queue.length + this.delayedQueue.length;
  }
  async clear() {
    this.queue = [];
    this.delayedQueue = [];
  }
  async start() {
    this.isRunning = true;
    this.checkInterval = setInterval(() => {
      this.processDelayed();
    }, 1e3);
  }
  async stop() {
    this.isRunning = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
  processDelayed() {
    const now = /* @__PURE__ */ new Date();
    const ready = this.delayedQueue.filter((item) => item.executeAt <= now);
    ready.forEach((item) => {
      this.queue.push(item.notification);
    });
    this.delayedQueue = this.delayedQueue.filter((item) => item.executeAt > now);
  }
};

// src/adapters/memory_storage_adapter.ts
var MemoryStorageAdapter = class {
  constructor() {
    this.notifications = /* @__PURE__ */ new Map();
    this.preferences = /* @__PURE__ */ new Map();
    this.receipts = /* @__PURE__ */ new Map();
  }
  async save(notification) {
    this.notifications.set(notification.id, notification);
  }
  async saveBatch(notifications) {
    notifications.forEach((n) => this.notifications.set(n.id, n));
  }
  async findById(id) {
    return this.notifications.get(id) || null;
  }
  async findByUser(userId, filters) {
    let results = Array.from(this.notifications.values()).filter((n) => n.userId === userId);
    if (filters) {
      if (filters.status) {
        const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
        results = results.filter((n) => statuses.includes(n.status));
      }
      if (filters.type) {
        const types = Array.isArray(filters.type) ? filters.type : [filters.type];
        results = results.filter((n) => types.includes(n.type));
      }
      if (filters.category) {
        const categories = Array.isArray(filters.category) ? filters.category : [filters.category];
        results = results.filter((n) => n.category && categories.includes(n.category));
      }
      if (filters.startDate) {
        results = results.filter((n) => n.createdAt >= filters.startDate);
      }
      if (filters.endDate) {
        results = results.filter((n) => n.createdAt <= filters.endDate);
      }
      const sortBy = filters.sortBy || "createdAt";
      const sortOrder = filters.sortOrder || "desc";
      results.sort((a, b) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];
        if (!aVal || !bVal)
          return 0;
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortOrder === "asc" ? comparison : -comparison;
      });
      if (filters.offset) {
        results = results.slice(filters.offset);
      }
      if (filters.limit) {
        results = results.slice(0, filters.limit);
      }
    }
    return results;
  }
  async countUnread(userId) {
    return Array.from(this.notifications.values()).filter((n) => n.userId === userId && n.status !== "read").length;
  }
  async markAsRead(id) {
    const notification = this.notifications.get(id);
    if (notification) {
      notification.status = "read";
      notification.readAt = /* @__PURE__ */ new Date();
      this.notifications.set(id, notification);
    }
  }
  async markAllAsRead(userId) {
    Array.from(this.notifications.values()).filter((n) => n.userId === userId && n.status !== "read").forEach((n) => {
      n.status = "read";
      n.readAt = /* @__PURE__ */ new Date();
      this.notifications.set(n.id, n);
    });
  }
  async markAsUnread(id) {
    const notification = this.notifications.get(id);
    if (notification) {
      notification.status = "delivered";
      notification.readAt = void 0;
      this.notifications.set(id, notification);
    }
  }
  async markAllAsUnread(userId) {
    Array.from(this.notifications.values()).filter((n) => n.userId === userId && n.status !== "delivered").forEach((n) => {
      n.status = "delivered";
      n.readAt = void 0;
      this.notifications.set(n.id, n);
    });
  }
  async delete(id) {
    this.notifications.delete(id);
    this.receipts.delete(id);
  }
  async getPreferences(userId) {
    return this.preferences.get(userId) || {
      userId,
      channels: {},
      globalMute: false
    };
  }
  async savePreferences(userId, prefs) {
    this.preferences.set(userId, prefs);
  }
  async deleteExpired() {
    const now = /* @__PURE__ */ new Date();
    let count = 0;
    Array.from(this.notifications.values()).filter((n) => n.expiresAt && n.expiresAt < now).forEach((n) => {
      this.notifications.delete(n.id);
      count++;
    });
    return count;
  }
  async saveReceipt(receipt) {
    const existing = this.receipts.get(receipt.notificationId) || [];
    existing.push(receipt);
    this.receipts.set(receipt.notificationId, existing);
  }
  async getReceipts(notificationId) {
    return this.receipts.get(notificationId) || [];
  }
};
export {
  ConsoleTransportAdapter,
  MemoryQueueAdapter,
  MemoryStorageAdapter,
  NotificationCenter
};
