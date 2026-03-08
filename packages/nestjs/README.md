# Backend Frameworks Integration Guide

Complete guide for integrating Synq Notifications with **NestJS** and **Express.js**.

## 📦 Installation

### NestJS

```bash
npm install @synq/notifications-nestjs @notifyc/core
# Optional: only needed if you enable the built-in WebSocket gateway
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io
```

### Express.js

```bash
npm install @synq/notifications-express @notifyc/core
npm install ws
```

## 🎯 NestJS Integration

### Basic Setup

```typescript
// app.module.ts
import { Module } from "@nestjs/common";
import { NotificationsModule } from "@synq/notifications-nestjs";
import { PostgresStorageAdapter } from "@synq/notifications-storage-postgres";
import { FirebasePushAdapter } from "@synq/notifications-transport-firebase";
import { SendGridEmailAdapter } from "@synq/notifications-transport-sendgrid";
import { RedisQueueAdapter } from "@synq/notifications-queue-redis";

@Module({
  imports: [
    NotificationsModule.forRoot({
      // Storage
      storage: new PostgresStorageAdapter({
        connectionString: process.env.DATABASE_URL,
      }),

      // Transports
      transports: [
        new FirebasePushAdapter({
          serviceAccount: require("./firebase-credentials.json"),
          projectId: process.env.FIREBASE_PROJECT_ID,
          getDeviceTokens: async (userId) => {
            // Fetch from your database
            return deviceTokenService.getTokens(userId);
          },
        }),
        new SendGridEmailAdapter({
          apiKey: process.env.SENDGRID_API_KEY,
          fromEmail: "notifications@yourapp.com",
          getUserEmail: async (userId) => {
            // Fetch from your database
            return userService.getEmail(userId);
          },
        }),
      ],

      // Queue
      queue: new RedisQueueAdapter({
        connection: {
          host: process.env.REDIS_HOST,
          port: parseInt(process.env.REDIS_PORT || "6379"),
        },
      }),

      // Workers
      workers: {
        enabled: true,
        concurrency: 10,
      },

      // Cleanup
      cleanup: {
        enabled: true,
        retentionDays: 30,
      },

      // Enable WebSocket (default: true)
      enableWebSocket: true,

      // Enable REST API (default: true)
      enableRestApi: true,

      // Templates
      templates: [
        {
          id: "welcome",
          type: "onboarding",
          defaults: {
            title: (data) => `Welcome ${data.userName}!`,
            body: (data) => "Thanks for joining us.",
            channels: ["email", "inapp"],
            priority: "normal",
          },
        },
      ],
    }),
  ],
})
export class AppModule {}
```

### Async Configuration

Use `forRootAsync()` with `ConfigService`:

```typescript
import { ConfigModule, ConfigService } from "@nestjs/config";

@Module({
  imports: [
    ConfigModule.forRoot(),
    NotificationsModule.forRootAsync({
      imports: [ConfigModule],
      // Optional feature flags (both default to true)
      enableWebSocket: true,
      enableRestApi: true,
      useFactory: async (configService: ConfigService) => ({
        storage: new PostgresStorageAdapter({
          connectionString: configService.get("DATABASE_URL"),
        }),
        transports: [
          new SendGridEmailAdapter({
            apiKey: configService.get("SENDGRID_API_KEY"),
            fromEmail: configService.get("SENDGRID_FROM_EMAIL"),
            getUserEmail: async (userId) => {
              // Fetch from database
            },
          }),
        ],
        queue: new RedisQueueAdapter({
          connection: {
            host: configService.get("REDIS_HOST"),
            port: configService.get("REDIS_PORT"),
          },
        }),
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

### Using in Services

```typescript
import { Injectable } from "@nestjs/common";
import { NotificationsService } from "@synq/notifications-nestjs";

@Injectable()
export class UserService {
  constructor(private readonly notificationsService: NotificationsService) {}

  async createUser(data: CreateUserDto) {
    const user = await this.userRepository.save(data);

    // Send welcome notification
    await this.notificationsService.send({
      template: "welcome",
      userId: user.id,
      type: "onboarding",
      title: "",
      body: "",
      channels: [],
      data: { userName: user.name },
    });

    return user;
  }
}
```

### Using in Controllers

```typescript
import { Controller, Post, Param, Request } from "@nestjs/common";
import { NotificationsService } from "@synq/notifications-nestjs";

@Controller("posts")
export class PostsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post(":id/like")
  async likePost(@Param("id") postId: string, @Request() req) {
    const post = await this.postsService.like(postId, req.user.id);

    // Notify post author
    await this.notificationsService.send({
      userId: post.authorId,
      type: "like",
      title: `${req.user.name} liked your post`,
      body: post.title,
      channels: ["inapp", "push"],
      priority: "low",
      category: "social",
    });

    return post;
  }

  @Post(":id/comment")
  async commentOnPost(
    @Param("id") postId: string,
    @Body() body: CreateCommentDto,
    @Request() req,
  ) {
    const comment = await this.postsService.addComment(
      postId,
      body,
      req.user.id,
    );
    const post = await this.postsService.findById(postId);

    // Notify post author
    await this.notificationsService.send({
      userId: post.authorId,
      type: "comment",
      title: `${req.user.name} commented on your post`,
      body: comment.text,
      channels: ["inapp", "push", "email"],
      priority: "normal",
      category: "social",
    });

    return comment;
  }
}
```

### Direct Injection

You can also inject the `NotificationCenter` directly:

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { NOTIFICATION_CENTER, NotificationCenter } from '@synq/notifications-nestjs';

@Injectable()
export class CustomService {
  constructor(
    @Inject(NOTIFICATION_CENTER)
    private readonly notificationCenter: NotificationCenter
  ) {}

  async doSomething() {
    // Direct access to NotificationCenter
    await this.notificationCenter.send({...});
  }
}
```

### Built-in REST API

The module automatically creates these REST endpoints:

```
GET    /notifications/:userId              - Get notifications
GET    /notifications/:userId/unread-count - Get unread count
GET    /notifications/:userId/stats        - Get statistics
GET    /notifications/:userId/preferences  - Get preferences
PUT    /notifications/:userId/preferences  - Update preferences
GET    /notifications/:userId/stream       - SSE stream (initial-data, notification, unread-count)
POST   /notifications                      - Send notification
POST   /notifications/batch                - Send batch
POST   /notifications/:userId/:id/read     - Mark as read (ownership-scoped)
POST   /notifications/:userId/read-all     - Mark all as read
DELETE /notifications/:userId/:id          - Delete notification (ownership-scoped)
DELETE /notifications/:userId/all          - Delete all
GET    /notifications/health                - Health check
```

### Built-in SSE Stream

Use Server-Sent Events for one-way realtime updates:

```javascript
const events = new EventSource(
  "http://localhost:3000/notifications/user:123/stream",
);

events.addEventListener("initial-data", (event) => {
  const data = JSON.parse(event.data);
  console.log("Initial data:", data);
});

events.addEventListener("notification", (event) => {
  const data = JSON.parse(event.data);
  console.log("New notification:", data.notification);
});

events.addEventListener("unread-count", (event) => {
  const data = JSON.parse(event.data);
  console.log("Unread count:", data.count);
});
```

### Built-in WebSocket Gateway

WebSocket is automatically available at `/notifications`:

```typescript
// Frontend (Socket.IO client)
import io from "socket.io-client";

const socket = io("http://localhost:3000/notifications", {
  query: { userId: "user:123" },
});

socket.on("notification", (data) => {
  console.log("New notification:", data.notification);
});

socket.on("unread-count", (data) => {
  console.log("Unread count:", data.count);
});

socket.on("initial-data", (data) => {
  console.log("Initial data:", data);
});

// Send messages
socket.emit("mark-as-read", { notificationId: "notif_123" });
socket.emit("mark-all-read");
socket.emit("delete", { notificationId: "notif_123" });
```

## 🚀 Express.js Integration

### Basic Setup

```typescript
import express from "express";
import http from "http";
import { createNotificationsMiddleware } from "@synq/notifications-express";
import { PostgresStorageAdapter } from "@synq/notifications-storage-postgres";
import { SendGridEmailAdapter } from "@synq/notifications-transport-sendgrid";
import { RedisQueueAdapter } from "@synq/notifications-queue-redis";

const app = express();
const server = http.createServer(app);

app.use(express.json());

// Create notifications manager
const notificationsManager = createNotificationsMiddleware({
  storage: new PostgresStorageAdapter({
    connectionString: process.env.DATABASE_URL,
  }),
  transports: [
    new SendGridEmailAdapter({
      apiKey: process.env.SENDGRID_API_KEY,
      fromEmail: "notifications@yourapp.com",
      getUserEmail: async (userId) => {
        return userService.getEmail(userId);
      },
    }),
  ],
  queue: new RedisQueueAdapter({
    connection: {
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
    },
  }),
  workers: {
    enabled: true,
    concurrency: 10,
  },

  // Custom auth middleware
  authMiddleware: (req, res, next) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    // Verify token
    req.userId = verifyToken(token);
    next();
  },
});

// Start notification system
await notificationsManager.start();

// Mount REST API
app.use("/api/notifications", notificationsManager.createRestRouter());

// Setup WebSocket
notificationsManager.setupWebSocket(server);

server.listen(3000, () => {
  console.log("Server running on port 3000");
});
```

### Using in Routes

```typescript
// Get the notification center
const center = notificationsManager.getCenter();

app.post("/posts/:id/like", authenticateUser, async (req, res) => {
  const { id } = req.params;
  const post = await postsService.like(id, req.userId);

  // Send notification
  await center.send({
    userId: post.authorId,
    type: "like",
    title: `${req.user.name} liked your post`,
    body: post.title,
    channels: ["inapp", "push"],
    priority: "low",
  });

  res.json(post);
});

app.post("/auth/signup", async (req, res) => {
  const user = await userService.create(req.body);

  // Send welcome notification
  await center.send({
    template: "welcome",
    userId: user.id,
    type: "onboarding",
    title: "",
    body: "",
    channels: [],
    data: { userName: user.name },
  });

  res.json(user);
});
```

### Manual Route Setup

If you want more control:

```typescript
import { NotificationCenter } from '@notifyc/core';

const notificationCenter = new NotificationCenter({
  storage: new PostgresStorageAdapter(...),
  transports: [...],
  queue: new RedisQueueAdapter(...)
});

await notificationCenter.start();

// Custom routes
app.get('/api/notifications/:userId', async (req, res) => {
  const notifications = await notificationCenter.getForUser(req.params.userId);
  res.json(notifications);
});

app.post('/api/notifications', async (req, res) => {
  const notification = await notificationCenter.send(req.body);
  res.json(notification);
});

app.post('/api/notifications/:id/read', async (req, res) => {
  await notificationCenter.markAsRead(req.params.id);
  res.json({ success: true });
});
```

### WebSocket Client (Native WebSocket)

```typescript
// Frontend
const ws = new WebSocket("ws://localhost:3000/ws?userId=user:123");

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case "notification":
      console.log("New notification:", data.notification);
      break;
    case "unread-count":
      console.log("Unread count:", data.count);
      break;
    case "initial-data":
      console.log("Initial data:", data);
      break;
  }
};

// Send messages
ws.send(
  JSON.stringify({
    type: "mark-as-read",
    notificationId: "notif_123",
  }),
);
```

## 🔧 Advanced Patterns

### Custom Notification Types

```typescript
// Define custom notification handlers
@Injectable()
export class NotificationHandlerService {
  constructor(private notificationsService: NotificationsService) {}

  async handleOrderPlaced(order: Order) {
    await this.notificationsService.send({
      userId: order.userId,
      type: "order",
      title: "Order Confirmed",
      body: `Your order #${order.id} has been confirmed`,
      channels: ["email", "push"],
      priority: "high",
      data: {
        orderId: order.id,
        amount: order.total,
      },
    });
  }

  async handlePaymentFailed(payment: Payment) {
    await this.notificationsService.send({
      userId: payment.userId,
      type: "payment",
      title: "Payment Failed",
      body: "Your payment could not be processed",
      channels: ["email", "push", "sms"],
      priority: "urgent",
      data: {
        paymentId: payment.id,
        reason: payment.failureReason,
      },
    });
  }
}
```

### Scheduled Notifications

```typescript
@Injectable()
export class ReminderService {
  constructor(private notificationsService: NotificationsService) {}

  async scheduleReminder(userId: string, event: Event) {
    const reminderTime = new Date(event.startTime);
    reminderTime.setHours(reminderTime.getHours() - 1);

    await this.notificationsService.schedule(
      {
        userId,
        type: "reminder",
        title: "Event Reminder",
        body: `Your event "${event.title}" starts in 1 hour`,
        channels: ["push"],
        priority: "normal",
      },
      reminderTime,
    );
  }
}
```

### Batch Notifications

```typescript
async notifyFollowers(post: Post) {
  const followers = await this.userService.getFollowers(post.authorId);

  const notifications = followers.map(follower => ({
    userId: follower.id,
    type: 'new-post',
    title: `${post.author.name} posted something new`,
    body: post.title,
    channels: ['inapp'],
    priority: 'low'
  }));

  await this.notificationsService.sendBatch(notifications);
}
```

### Event-Based Notifications

```typescript
// Using NestJS Events
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";

@Injectable()
export class NotificationListener {
  constructor(private notificationsService: NotificationsService) {}

  @OnEvent("user.registered")
  async handleUserRegistered(event: UserRegisteredEvent) {
    await this.notificationsService.send({
      userId: event.userId,
      type: "welcome",
      title: "Welcome!",
      body: "Thanks for joining",
      channels: ["email"],
      priority: "normal",
    });
  }

  @OnEvent("post.liked")
  async handlePostLiked(event: PostLikedEvent) {
    await this.notificationsService.send({
      userId: event.post.authorId,
      type: "like",
      title: `${event.user.name} liked your post`,
      body: event.post.title,
      channels: ["inapp", "push"],
      priority: "low",
    });
  }
}
```

## 🧪 Testing

### NestJS Testing

```typescript
import { Test } from "@nestjs/testing";
import {
  NotificationsModule,
  NotificationsService,
} from "@synq/notifications-nestjs";

describe("UserService", () => {
  let userService: UserService;
  let notificationsService: NotificationsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        NotificationsModule.forRoot({
          storage: new MemoryStorageAdapter(),
          transports: [new ConsoleTransportAdapter()],
          enableWebSocket: false,
        }),
      ],
      providers: [UserService],
    }).compile();

    userService = module.get(UserService);
    notificationsService = module.get(NotificationsService);
  });

  it("should send welcome notification on user creation", async () => {
    const sendSpy = jest.spyOn(notificationsService, "send");

    await userService.createUser({ name: "Test", email: "test@example.com" });

    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "welcome",
        userId: expect.any(String),
      }),
    );
  });
});
```

### Express Testing

```typescript
import request from 'supertest';
import express from 'express';

describe('Notifications API', () => {
  let app: express.Application;

  beforeAll(async () => {
    app = express();
    const manager = createNotificationsMiddleware({...});
    await manager.start();
    app.use('/api/notifications', manager.createRestRouter());
  });

  it('should get notifications for user', async () => {
    const response = await request(app)
      .get('/api/notifications/user:123')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });
});
```

## 🎉 Summary

You now have complete backend integrations for:

- ✅ **NestJS** - Full module with dependency injection, WebSocket gateway, and REST API
- ✅ **Express.js** - Middleware with flexible routing and WebSocket support
- ✅ **Both frameworks** support all notification features seamlessly

Choose the one that fits your stack and start sending notifications! 🚀

# notifyc-nestjs
