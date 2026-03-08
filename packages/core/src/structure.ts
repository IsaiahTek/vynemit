// ```

// ### 6. Package Structure
// ```
// packages/
// ├── core/                           # @notifyc/core
// │   ├── src/
// │   │   ├── center.ts              # Main NotificationCenter
// │   │   ├── models/                # Types & interfaces
// │   │   ├── adapters/              # Base adapter interfaces
// │   │   ├── queue/                 # Queue abstraction
// │   │   ├── middleware/            # Built-in middleware
// │   │   └── utils/                 # Helpers
// │   └── package.json
// │
// ├── storage-adapters/
// │   ├── memory/                    # @synq/notifications-storage-memory
// │   ├── postgres/                  # @synq/notifications-storage-postgres
// │   ├── mongodb/                   # @synq/notifications-storage-mongodb
// │   ├── firestore/                 # @synq/notifications-storage-firestore
// │   └── rest/                      # @synq/notifications-storage-rest
// │
// ├── transport-adapters/
// │   ├── email/                     # @synq/notifications-transport-email
// │   ├── push/                      # @synq/notifications-transport-push
// │   ├── sms/                       # @synq/notifications-transport-sms
// │   ├── webhook/                   # @synq/notifications-transport-webhook
// │   └── inapp/                     # @synq/notifications-transport-inapp
// │
// ├── queue-adapters/
// │   ├── memory/                    # @synq/notifications-queue-memory
// │   ├── redis/                     # @synq/notifications-queue-redis
// │   └── bullmq/                    # @synq/notifications-queue-bullmq
// │
// ├── bindings/
// │   ├── react/                     # @synq/notifications-react
// │   ├── vue/                       # @synq/notifications-vue
// │   ├── nestjs/                    # @synq/notifications-nestjs
// │   ├── express/                   # @synq/notifications-express
// │   └── flutter/                   # synq_notifications (Dart)
// │
// └── middleware/
//     ├── rate-limit/                # @synq/notifications-middleware-rate-limit
//     ├── deduplication/             # @synq/notifications-middleware-dedupe
//     └── analytics/                 # @synq/notifications-middleware-analytics