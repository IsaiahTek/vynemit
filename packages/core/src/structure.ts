// ```

// ### 6. Package Structure
// ```
// packages/
// ├── core/                           # @vynelix/vynemit-core
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
// │   ├── memory/                    # @vynelix/vynemit-storage-memory
// │   ├── postgres/                  # @vynelix/vynemit-adapter-postgres
// │   ├── mongodb/                   # @vynelix/vynemit-storage-mongodb
// │   ├── firestore/                 # @vynelix/vynemit-storage-firestore
// │   └── rest/                      # @vynelix/vynemit-storage-rest
// │
// ├── transport-adapters/
// │   ├── email/                     # @vynelix/vynemit-adapter-smtp
// │   ├── push/                      # @vynelix/vynemit-transport-push
// │   ├── sms/                       # @vynelix/vynemit-transport-sms
// │   ├── webhook/                   # @vynelix/vynemit-transport-webhook
// │   └── inapp/                     # @vynelix/vynemit-transport-inapp
// │
// ├── queue-adapters/
// │   ├── memory/                    # @vynelix/vynemit-queue-memory
// │   ├── redis/                     # @vynelix/vynemit-queue-redis
// │   └── bullmq/                    # @vynelix/vynemit-queue-bullmq
// │
// ├── bindings/
// │   ├── react/                     # @vynelix/vynemit-react
// │   ├── vue/                       # @vynelix/vynemit-vue
// │   ├── nestjs/                    # @vynelix/vynemit-nestjs
// │   ├── express/                   # @vynelix/vynemit-express
// │   └── flutter/                   # synq_notifications (Dart)
// │
// └── middleware/
//     ├── rate-limit/                # @vynelix/vynemit-middleware-rate-limit
//     ├── deduplication/             # @vynelix/vynemit-middleware-dedupe
//     └── analytics/                 # @vynelix/vynemit-middleware-analytics