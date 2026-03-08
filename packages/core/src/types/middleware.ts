import { Notification } from "../types";

export interface NotificationMiddleware {
  name: string;

  // Lifecycle hooks
  beforeSend?(notification: Notification): Promise<Notification | null>; // null = skip
  afterSend?(notification: Notification): Promise<void>;
  onError?(error: Error, notification: Notification): Promise<void>;
}

// // Example: Rate limiting middleware
// const rateLimitMiddleware: NotificationMiddleware = {
//   name: 'rate-limit',
//   async beforeSend(notif) {
//     const count = await redis.incr(`notif:${notif.userId}:count`);
//     if (count > 100) return null; // Skip if over limit
//     return notif;
//   }
// };

// // Usage
// center.use(rateLimitMiddleware);