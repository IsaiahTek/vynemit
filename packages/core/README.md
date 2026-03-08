# @synq/notifications-core

> A framework-agnostic notification system with unified dispatch, storage, and transport layers.

## Features

✨ **Unified Notification Model** - Single interface for in-app, push, email, SMS, and webhooks  
🎯 **Event-Based Dispatch** - Reactive system with real-time subscriptions  
📊 **Read/Unread Tracking** - Built-in state management  
🎛️ **Channel Filters** - User preferences for notification channels  
⚡ **Queue Support** - Redis, BullMQ, or in-memory queues  
🔌 **Pluggable Architecture** - Swap storage and transport adapters  
🎨 **Template System** - Reusable notification templates  
🔄 **Middleware Support** - Rate limiting, deduplication, analytics  
📦 **Zero Dependencies** - Lightweight core with optional adapters  

## Installation

```bash
npm install @synq/notifications-core
```

## Quick Start

```typescript
import {
  NotificationCenter,
  MemoryStorageAdapter,
  ConsoleTransportAdapter
} from '@synq/notifications-core';

// Initialize
const center = new NotificationCenter({
  storage: new MemoryStorageAdapter(),
  transports: [
    new ConsoleTransportAdapter('inapp'),
    new ConsoleTransportAdapter('push')
  ]
});

await center.start();

// Send notification
await center.send({
  userId: 'user:123',
  type: 'comment',
  title: 'New Comment',
  body: 'Someone replied to your post',
  channels: ['inapp', 'push'],
  priority: 'normal'
});

// Subscribe to real-time updates
center.subscribe('user:123', (notification) => {
  console.log('New notification:', notification);
});

// Get notifications
const notifications = await center.getForUser('user:123', {
  status: 'unread',
  limit: 10
});

// Mark as read
await center.markAsRead(notifications[0].id);
```

## Core Concepts

### 1. Notification Model

Every notification has a consistent structure:

```typescript
interface Notification {
  id: string;
  type: string;              // 'comment', 'like', 'system', etc.
  title: string;
  body: string;
  data?: Record<string, unknown>;
  
  userId: string;            // Who receives it
  groupId?: string;          // Optional grouping
  
  priority: 'low' | 'normal' | 'high' | 'urgent';
  category?: string;         // For filtering
  
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'read';
  channels: ChannelType[];   // ['inapp', 'push', 'email']
  
  createdAt: Date;
  readAt?: Date;
  scheduledFor?: Date;
  expiresAt?: Date;
}
```

### 2. Storage Adapters

Storage adapters handle persistence:

- `MemoryStorageAdapter` - In-memory (development/testing)
- `PostgresStorageAdapter` - PostgreSQL (production)
- `MongoStorageAdapter` - MongoDB
- `FirestoreStorageAdapter` - Google Firestore
- `RestStorageAdapter` - External API

### 3. Transport Adapters

Transport adapters handle delivery:

- `ConsoleTransportAdapter` - Console logging (development)
- `EmailTransportAdapter` - Email via SMTP/SendGrid
- `PushTransportAdapter` - Push via Firebase/OneSignal
- `SmsTransportAdapter` - SMS via Twilio
- `WebhookTransportAdapter` - Custom webhooks

### 4. Templates

Templates make notifications reusable:

```typescript
center.registerTemplate({
  id: 'new-comment',
  type: 'comment',
  defaults: {
    title: (data) => `${data.author} commented on your post`,
    body: (data) => data.text,
    channels: ['inapp', 'push'],
    priority: 'normal'
  }
});

// Use template
await center.send({
  template: 'new-comment',
  userId: 'user:123',
  data: { author: 'Alice', text: 'Great post!' }
});
```

### 5. User Preferences

Users control which notifications they receive:

```typescript
await center.updatePreferences('user:123', {
  userId: 'user:123',
  channels: {
    email: {
      enabled: true,
      categories: ['important', 'security'],
      quietHours: {
        start: '22:00',
        end: '08:00'
      }
    },
    push: {
      enabled: true,
      frequency: 'realtime'
    }
  },
  globalMute: false
});
```

### 6. Middleware

Extend functionality with middleware:

```typescript
center.use({
  name: 'rate-limit',
  async beforeSend(notification) {
    // Check rate limits
    const allowed = await checkRateLimit(notification.userId);
    return allowed ? notification : null; // null = skip
  },
  async afterSend(notification) {
    // Track analytics
    await analytics.track('notification_sent', notification);
  },
  async onError(error, notification) {
    // Log errors
    console.error('Failed:', error);
  }
});
```

## Advanced Usage

### Scheduled Notifications

```typescript
// Send in 1 hour
await center.schedule({
  userId: 'user:123',
  type: 'reminder',
  title: 'Meeting Soon',
  body: 'Your meeting starts in 15 minutes',
  channels: ['push'],
  priority: 'urgent'
}, new Date(Date.now() + 3600000));
```

### Batch Operations

```typescript
await center.sendBatch([
  { userId: 'user:1', type: 'update', title: 'A', body: 'B', channels: ['inapp'] },
  { userId: 'user:2', type: 'update', title: 'C', body: 'D', channels: ['inapp'] }
]);
```

### Real-time Subscriptions

```typescript
// Subscribe to new notifications
const unsubscribe = center.subscribe('user:123', (notification) => {
  console.log('New:', notification);
});

// Subscribe to unread count changes
center.onUnreadCountChange('user:123', (count) => {
  updateBadge(count);
});

// Subscribe to all events
center.subscribeToEvents('user:123', (event) => {
  console.log(event.type); // 'sent', 'delivered', 'read', 'failed'
});

// Cleanup
unsubscribe();
```

### Digest Mode

Batch notifications into digests:

```typescript
await center.enableDigest('user:123', {
  userId: 'user:123',
  frequency: 'daily',
  channels: ['email'],
  categories: ['social', 'updates']
});
```

### Delivery Status

Track delivery across channels:

```typescript
const receipts = await center.getDeliveryStatus('notif_123');
receipts.forEach(receipt => {
  console.log(`${receipt.channel}: ${receipt.status}`);
  // inapp: delivered
  // push: delivered
  // email: failed
});

// Retry failed
await center.retryFailed('notif_123', 'email');
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│         NotificationCenter (Core)               │
├─────────────────────────────────────────────────┤
│  • Event Dispatch                               │
│  • Template Management                          │
│  • Middleware Pipeline                          │
│  • Subscription System                          │
└─────────────────────────────────────────────────┘
         │              │              │
    ┌────┴────┐    ┌────┴────┐   ┌────┴────┐
    │ Storage │    │  Queue  │   │Transport│
    │ Adapter │    │ Adapter │   │ Adapter │
    └─────────┘    └─────────┘   └─────────┘
         │              │              │
    ┌────┴────┐    ┌────┴────┐   ┌────┴────┐
    │Postgres │    │  Redis  │   │ Firebase│
    │ MongoDB │    │ BullMQ  │   │ SendGrid│
    │Firestore│    │ Memory  │   │  Twilio │
    └─────────┘    └─────────┘   └─────────┘
```

## Framework Bindings

Use framework-specific bindings for seamless integration:

### React

```bash
npm install @synq/notifications-react
```

```tsx
import { NotificationProvider, useNotifications } from '@synq/notifications-react';

function App() {
  return (
    <NotificationProvider apiUrl="/api/notifications" userId="user:123">
      <NotificationBell />
    </NotificationProvider>
  );
}

function NotificationBell() {
  const { notifications, unreadCount, markAsRead } = useNotifications();
  
  return (
    <Badge count={unreadCount}>
      <Bell />
    </Badge>
  );
}
```

### NestJS

```bash
npm install @synq/notifications-nestjs
```

```typescript
import { NotificationsModule } from '@synq/notifications-nestjs';

@Module({
  imports: [
    NotificationsModule.forRoot({
      storage: new PostgresStorageAdapter(),
      transports: [new EmailTransportAdapter(), new PushTransportAdapter()]
    })
  ]
})
export class AppModule {}

@Injectable()
export class UserService {
  constructor(private notifications: NotificationCenter) {}
  
  async welcomeUser(userId: string) {
    await this.notifications.send({
      userId,
      type: 'welcome',
      title: 'Welcome!',
      body: 'Thanks for joining',
      channels: ['inapp', 'email']
    });
  }
}
```

### Flutter

```bash
flutter pub add synq_notifications
```

```dart
import 'package:synq_notifications/synq_notifications.dart';

final notificationCenter = NotificationCenter(
  storage: MemoryStorageAdapter(),
  transports: [ConsoleTransportAdapter()]
);

// Subscribe
notificationCenter.subscribe('user:123', (notification) {
  print('New: ${notification.title}');
});

// Send
await notificationCenter.send(
  userId: 'user:123',
  type: 'comment',
  title: 'New Comment',
  body: 'Someone replied',
  channels: ['inapp']
);
```

## License

MIT © [Your Name]

## Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

## Support

- 📧 Email: support@synq.dev
- 💬 Discord: [Join our community](https://discord.gg/synq)
- 📖 Docs: [docs.synq.dev](https://docs.synq.dev)
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/synq-notifications/issues)
