
// ============================================================================
// CONSOLE TRANSPORT ADAPTER
// ============================================================================

import { TransportAdapter, ChannelType, NotificationPreferences, DeliveryReceipt, Notification } from "../types";

export class ConsoleTransportAdapter implements TransportAdapter {
  name: ChannelType = 'inapp';

  constructor(name: ChannelType = 'inapp') {
    this.name = name;
  }

  async send(
    notification: Notification, 
    // preferences: NotificationPreferences
  ): Promise<DeliveryReceipt> {
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
      status: 'delivered',
      attempts: 1,
      lastAttempt: new Date()
    };
  }

  canSend(notification: Notification, preferences: NotificationPreferences): boolean {
    // Check global mute
    if (preferences.globalMute) {
      return false;
    }

    // Check channel preferences
    const channelPref = preferences.channels[this.name];
    if (channelPref && !channelPref.enabled) {
      return false;
    }

    // Check category preferences
    if (channelPref?.categories && notification.category) {
      if (!channelPref.categories.includes(notification.category)) {
        return false;
      }
    }

    // Check quiet hours (simplified - just check if we're in quiet hours)
    if (channelPref?.quietHours) {
      const now = new Date();
      const currentHour = now.getHours();
      const [startHour] = channelPref.quietHours.start.split(':').map(Number);
      const [endHour] = channelPref.quietHours.end.split(':').map(Number);
      
      if (startHour > endHour) {
        // Overnight quiet hours (e.g., 22:00 - 08:00)
        if (currentHour >= startHour || currentHour < endHour) {
          return false;
        }
      } else {
        // Same day quiet hours
        if (currentHour >= startHour && currentHour < endHour) {
          return false;
        }
      }
    }

    return true;
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
