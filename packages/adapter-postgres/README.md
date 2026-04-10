# @vynelix/vynemit-adapter-postgres

PostgreSQL storage adapter for Vynemit. Perfect for production environments requiring persistence and complex queries.

## Installation

```bash
npm install @vynelix/vynemit-adapter-postgres pg
```

## Usage

```typescript
import { NotificationCenter } from '@vynelix/vynemit-core';
import { PostgresStorageAdapter } from '@vynelix/vynemit-adapter-postgres';

const storage = new PostgresStorageAdapter({
  connectionString: process.env.DATABASE_URL,
  schema: 'public',
  tablePrefix: 'notif_'
});

// Initialize tables
await storage.initialize();

const center = new NotificationCenter({
  storage,
  transports: [...]
});

await center.start();
```

## Features

- ✅ **Full Persistence** - Save notifications, receipts, and user preferences.
- ✅ **Table Prefixes** - Run multiple Vynemit instances in a single database.
- ✅ **Search/Index** - Highly optimized for fast user-based queries.
- ✅ **Automatic Migrations** - Tables are created automatically on initialization.

## License

MIT © [Engr., Isaiah Pius E.](https://github.com/IsaiahTek)
