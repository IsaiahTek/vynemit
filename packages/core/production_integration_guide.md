# Synq Notifications - Production Setup Guide

This guide shows you how to set up a complete production notification system using all the adapters we've built.

## Installation

```bash
# Core
npm install @notifyc/core

# Storage
npm install @notifyc/adapter-postgres pg

# Transports
npm install @notifyc/adapter-fcm firebase-admin
npm install @notifyc/adapter-sendgrid @sendgrid/mail

# Queue
npm install @notifyc/queue-redis bullmq ioredis
```

## 🔧 Environment Setup

Create a `.env` file:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/myapp

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# SendGrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxx
SENDGRID_FROM_EMAIL=notifications@yourapp.com
SENDGRID_FROM_NAME=YourApp

# Firebase
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json

# App
APP_URL=https://yourapp.com
NODE_ENV=production
```

## 🏗️ Project Structure

```
src/
├── notifications/
│   ├── index.ts                    # Main setup
│   ├── adapters/
│   │   ├── storage.ts              # Storage configuration
│   │   ├── transports.ts           # Transport configuration
│   │   └── queue.ts                # Queue configuration
│   ├── middleware/
│   │   ├── rate-limit.ts           # Rate limiting
│   │   ├── deduplication.ts        # Deduplication
│   │   └── analytics.ts            # Analytics tracking
│   ├── templates/
│   │   ├── index.ts                # Template registry
│   │   ├── welcome.ts              # Welcome template
│   │   ├── security.ts             # Security template
│   │   └── social.ts               # Social templates
│   └── services/
│       ├── device-tokens.ts        # Device token management
│       └── user-emails.ts          # User email management
```

## 📝 Step-by-Step Implementation

### Step 1: Initialize Database

Create a migration file:

```typescript
// migrations/001_create_notifications_tables.ts
import { PostgresStorageAdapter } from '@notifyc/adapter-postgres';

export async function up() {
  const storage = new PostgresStorageAdapter({
    connectionString: process.env.DATABASE_URL!
  });
  
  await storage.initialize();
  console.log('✓ Notification tables created');
}
```

Run migration:
```bash
npx ts-node migrations/001_create_notifications_tables.ts
```

### Step 2: Setup Device Token Management

```typescript
// src/notifications/services/device-tokens.ts
import { Pool } from 'pg';

export class DeviceTokenService {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async initialize() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS device_tokens (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        token VARCHAR(500) NOT NULL UNIQUE,
        platform VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        last_used TIMESTAMP DEFAULT NOW(),
        CONSTRAINT valid_platform CHECK (platform IN ('android', 'ios', 'web'))
      );
      CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens(user_id);
    `);
  }

  async registerToken(
    userId: string,
    token: string,
    platform: 'android' | 'ios' | 'web'
  ): Promise<void> {
    await this.pool.query(`
      INSERT INTO device_tokens (user_id, token, platform, last_used)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (token) DO UPDATE SET last_used = NOW()
    `, [userId, token, platform]);
  }

  async removeToken(token: string): Promise<void> {
    await this.pool.query('DELETE FROM device_tokens WHERE token = $1', [token]);
  }

  async getTokens(userId: string): Promise<string[]> {
    const result = await this.pool.query(
      'SELECT token FROM device_tokens WHERE user_id = $1',
      [userId]
    );
    return result.rows.map(row => row.token);
  }

  async cleanupExpiredTokens(daysOld: number = 90): Promise<number> {
    const result = await this.pool.query(`
      DELETE FROM device_tokens
      WHERE last_used < NOW() - INTERVAL '${daysOld} days'
    `);
    return result.rowCount || 0;
  }
}
```

### Step 3: Setup User Email Service

```typescript
// src/notifications/services/user-emails.ts
import { Pool } from 'pg';

export class UserEmailService {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async getEmail(userId: string): Promise<string | null> {
    const result = await this.pool.query(
      'SELECT email FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0].email;
  }

  async getEmailPreferences(userId: string): Promise<{
    email: string;
    emailVerified: boolean;
    unsubscribed: boolean;
  } | null> {
    const result = await this.pool.query(`
      SELECT email, email_verified, unsubscribed
      FROM users
      WHERE id = $1
    `, [userId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return {
      email: result.rows[0].email,
      emailVerified: result.rows[0].email_verified,
      unsubscribed: result.rows[0].unsubscribed
    };
  }
}
```

### Step 4: Create Custom Middleware

```typescript
// src/notifications/middleware/rate-limit.ts
import { NotificationMiddleware, Notification } from '@notifyc/core';
import Redis from 'ioredis';

export class RateLimitMiddleware implements NotificationMiddleware {
  name = 'rate-limit';
  private redis: Redis;
  private limits: Record<string, { max: number; window: number }>;

  constructor(redis: Redis) {
    this.redis = redis;
    this.limits = {
      email: { max: 10, window: 3600 },      // 10 per hour
      push: { max: 50, window: 3600 },       // 50 per hour
      sms: { max: 5, window: 3600 }          // 5 per hour
    };
  }

  async beforeSend(notification: Notification): Promise<Notification | null> {
    for (const channel of notification.channels) {
      const limit = this.limits[channel];
      if (!limit) continue;

      const key = `rate-limit:${notification.userId}:${channel}`;
      const count = await this.redis.incr(key);

      // Set expiry on first increment
      if (count === 1) {
        await this.redis.expire(key, limit.window);
      }

      // Check if over limit
      if (count > limit.max) {
        console.warn(`Rate limit exceeded for ${notification.userId} on ${channel}`);
        // Remove this channel from the notification
        notification.channels = notification.channels.filter(c => c !== channel);
      }
    }

    // If no channels left, skip notification
    if (notification.channels.length === 0) {
      return null;
    }

    return notification;
  }
}

// src/notifications/middleware/deduplication.ts
import { NotificationMiddleware, Notification } from '@notifyc/core';
import Redis from 'ioredis';
import crypto from 'crypto';

export class DeduplicationMiddleware implements NotificationMiddleware {
  name = 'deduplication';
  private redis: Redis;
  private window: number = 300; // 5 minutes

  constructor(redis: Redis, windowSeconds = 300) {
    this.redis = redis;
    this.window = windowSeconds;
  }

  async beforeSend(notification: Notification): Promise<Notification | null> {
    // Create hash of notification content
    const hash = this.createHash(notification);
    const key = `dedupe:${notification.userId}:${hash}`;

    // Check if we've sent this recently
    const exists = await this.redis.exists(key);
    if (exists) {
      console.log(`Skipping duplicate notification: ${notification.id}`);
      return null;
    }

    // Mark as sent
    await this.redis.setex(key, this.window, '1');

    return notification;
  }

  private createHash(notification: Notification): string {
    const content = `${notification.type}:${notification.title}:${notification.body}`;
    return crypto.createHash('md5').update(content).digest('hex');
  }
}

// src/notifications/middleware/analytics.ts
import { NotificationMiddleware, Notification } from '@notifyc/core';

export class AnalyticsMiddleware implements NotificationMiddleware {
  name = 'analytics';

  async afterSend(notification: Notification): Promise<void> {
    // Track with your analytics service
    console.log('[Analytics] Notification sent:', {
      userId: notification.userId,
      type: notification.type,
      channels: notification.channels,
      priority: notification.priority,
      timestamp: new Date()
    });

    // Example: Send to analytics service
    // await analytics.track('notification_sent', {
    //   userId: notification.userId,
    //   notificationType: notification.type,
    //   channels: notification.channels.join(','),
    //   priority: notification.priority
    // });
  }

  async onError(error: Error, notification: Notification): Promise<void> {
    console.error('[Analytics] Notification failed:', {
      userId: notification.userId,
      type: notification.type,
      error: error.message
    });

    // Example: Track error
    // await analytics.track('notification_failed', {
    //   userId: notification.userId,
    //   notificationType: notification.type,
    //   error: error.message
    // });
  }
}
```

### Step 5: Setup Notification Templates

```typescript
// src/notifications/templates/index.ts
import { NotificationCenter } from '@notifyc/core';

export function registerTemplates(center: NotificationCenter) {
  // Welcome template
  center.registerTemplate({
    id: 'welcome',
    type: 'onboarding',
    defaults: {
      title: (data) => `Welcome to ${data.appName}! 🎉`,
      body: (data) => `Hi ${data.userName}, thanks for joining us. Let's get started!`,
      channels: ['email', 'inapp'],
      priority: 'normal',
      category: 'onboarding'
    }
  });

  // New comment
  center.registerTemplate({
    id: 'new-comment',
    type: 'comment',
    defaults: {
      title: (data) => `${data.author} commented on your ${data.contentType}`,
      body: (data) => data.text,
      channels: ['inapp', 'push'],
      priority: 'normal',
      category: 'social'
    }
  });

  // Security alert
  center.registerTemplate({
    id: 'security-alert',
    type: 'security',
    defaults: {
      title: 'Security Alert 🔐',
      body: (data) => `New login from ${data.location} on ${data.device}`,
      channels: ['email', 'push', 'inapp'],
      priority: 'urgent',
      category: 'security'
    }
  });

  // Like notification
  center.registerTemplate({
    id: 'new-like',
    type: 'like',
    defaults: {
      title: (data) => data.count === 1
        ? `${data.author} liked your ${data.contentType}`
        : `${data.author} and ${data.count - 1} others liked your ${data.contentType}`,
      body: (data) => data.preview || '',
      channels: ['inapp'],
      priority: 'low',
      category: 'social'
    }
  });

  // System announcement
  center.registerTemplate({
    id: 'announcement',
    type: 'system',
    defaults: {
      title: (data) => data.title,
      body: (data) => data.message,
      channels: ['email', 'inapp'],
      priority: 'normal',
      category: 'system'
    }
  });
}
```

### Step 6: Main Notification Setup

```typescript
// src/notifications/index.ts
import { NotificationCenter } from '@notifyc/core';
import { PostgresStorageAdapter } from '@notifyc/adapter-postgres';
import { FirebasePushAdapter } from '@notifyc/adapter-fcm';
import { SendGridEmailAdapter } from '@notifyc/adapter-sendgrid';
import { RedisQueueAdapter } from '@notifyc/queue-redis';
import Redis from 'ioredis';
import { DeviceTokenService } from './services/device-tokens';
import { UserEmailService } from './services/user-emails';
import { RateLimitMiddleware } from './middleware/rate-limit';
import { DeduplicationMiddleware } from './middleware/deduplication';
import { AnalyticsMiddleware } from './middleware/analytics';
import { registerTemplates } from './templates';

// Initialize services
const deviceTokenService = new DeviceTokenService(process.env.DATABASE_URL!);
const userEmailService = new UserEmailService(process.env.DATABASE_URL!);
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD
});

// Create storage adapter
const storage = new PostgresStorageAdapter({
  connectionString: process.env.DATABASE_URL!,
  schema: 'public',
  tablePrefix: 'notif_'
});

// Create transport adapters
const firebasePush = new FirebasePushAdapter({
  credentialPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH!,
  projectId: process.env.FIREBASE_PROJECT_ID!,
  getDeviceTokens: async (userId) => {
    return deviceTokenService.getTokens(userId);
  }
});

const sendgridEmail = new SendGridEmailAdapter({
  apiKey: process.env.SENDGRID_API_KEY!,
  fromEmail: process.env.SENDGRID_FROM_EMAIL!,
  fromName: process.env.SENDGRID_FROM_NAME,
  getUserEmail: async (userId) => {
    const prefs = await userEmailService.getEmailPreferences(userId);
    if (!prefs || prefs.unsubscribed || !prefs.emailVerified) {
      return null;
    }
    return prefs.email;
  },
  replyTo: 'support@yourapp.com',
  retry: {
    maxAttempts: 3,
    delay: 1000
  }
});

// Create queue adapter
const queue = new RedisQueueAdapter({
  connection: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
  },
  prefix: 'myapp',
  worker: {
    concurrency: 10,
    limiter: {
      max: 100,
      duration: 1000
    }
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    },
    removeOnComplete: 100,
    removeOnFail: 1000
  },
  onCompleted: (job, result) => {
    console.log(`✓ Notification ${job.data.id} delivered`);
  },
  onFailed: (job, error) => {
    console.error(`✗ Notification ${job?.data?.id} failed:`, error.message);
  }
});

// Create notification center
export const notificationCenter = new NotificationCenter({
  storage,
  transports: [firebasePush, sendgridEmail],
  queue,
  workers: {
    enabled: true,
    concurrency: 10,
    pollInterval: 1000
  },
  cleanup: {
    enabled: true,
    interval: 3600000, // 1 hour
    retentionDays: 30
  },
  middleware: [
    new RateLimitMiddleware(redis),
    new DeduplicationMiddleware(redis),
    new AnalyticsMiddleware()
  ]
});

// Register templates
registerTemplates(notificationCenter);

// Initialize and start
export async function initializeNotifications() {
  await storage.initialize();
  await deviceTokenService.initialize();
  await notificationCenter.start();
  console.log('✓ Notification system initialized');
}

// Graceful shutdown
export async function shutdownNotifications() {
  await notificationCenter.stop();
  await redis.quit();
  console.log('✓ Notification system shut down');
}
```

### Step 7: Use in Your Application

```typescript
// src/app.ts
import express from 'express';
import { notificationCenter, initializeNotifications, shutdownNotifications } from './notifications';

const app = express();

// Initialize on startup
initializeNotifications().catch(console.error);

// API routes
app.post('/api/notifications/send', async (req, res) => {
  try {
    const notification = await notificationCenter.send({
      userId: req.body.userId,
      type: req.body.type,
      title: req.body.title,
      body: req.body.body,
      channels: req.body.channels || ['inapp'],
      priority: req.body.priority || 'normal',
      data: req.body.data
    });
    
    res.json({ success: true, notification });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/notifications/:userId', async (req, res) => {
  const notifications = await notificationCenter.getForUser(req.params.userId, {
    limit: 20,
    status: req.query.status as any
  });
  
  res.json(notifications);
});

app.post('/api/notifications/:id/read', async (req, res) => {
  await notificationCenter.markAsRead(req.params.id);
  res.json({ success: true });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  await shutdownNotifications();
  process.exit(0);
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## 🚀 Usage Examples

### Send Welcome Email
```typescript
await notificationCenter.send({
  template: 'welcome',
  userId: 'user:123',
  data: {
    appName: 'MyApp',
    userName: 'Alice'
  }
});
```

### Send Push Notification
```typescript
await notificationCenter.send({
  template: 'new-comment',
  userId: 'user:123',
  data: {
    author: 'Bob',
    contentType: 'post',
    text: 'Great work!'
  }
});
```

### Send Security Alert
```typescript
await notificationCenter.send({
  template: 'security-alert',
  userId: 'user:123',
  data: {
    location: 'San Francisco, CA',
    device: 'iPhone 13'
  }
});
```

## 📊 Monitoring & Metrics

```typescript
// Get queue metrics
const metrics = await queue.getMetrics();
console.log('Queue:', metrics);

// Get user stats
const stats = await notificationCenter.getStats('user:123');
console.log('User stats:', stats);

// Health check
const health = await notificationCenter.healthCheck();
console.log('Health:', health);
```

## 🔒 Security Best Practices

1. **API Keys**: Store in environment variables, never commit
2. **Rate Limiting**: Prevent notification spam
3. **User Preferences**: Always respect user opt-outs
4. **Data Encryption**: Use encrypted Redis for sensitive data
5. **Database Access**: Use connection pooling with limits

## 📚 Next Steps

- Add WebSocket support for real-time updates
- Implement notification grouping/threading
- Add A/B testing for notification content
- Build admin dashboard for monitoring
- Add notification scheduling UI

You now have a production-ready notification system! 🎉