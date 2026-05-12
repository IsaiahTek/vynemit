# @vynelix/vynemit-adapter-fcm

> FCM (Firebase Cloud Messaging) transport adapter for [Vynemit](https://github.com/IsaiahTek/vynemit).

This adapter allows Vynemit to send push notifications via Google's Firebase Cloud Messaging (FCM).

## Installation

```bash
npm install @vynelix/vynemit-adapter-fcm
```

## Prerequisites

You need to have `firebase-admin` initialized in your project.

```typescript
import * as admin from 'firebase-admin';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
```

## Usage

```typescript
import { NotificationCenter } from '@vynelix/vynemit-core';
import { FcmProvider } from '@vynelix/vynemit-adapter-fcm';
import * as admin from 'firebase-admin';

const center = new NotificationCenter({
  // ... other config
  transports: [
    new FcmProvider() // Uses the default firebase-admin app
    // OR
    // new FcmProvider(admin.messaging()) // Provide specific messaging instance
  ]
});

// To send a notification, ensure the recipient has a deviceToken in their data or preferences
await center.send({
  userId: 'user:123',
  type: 'push',
  title: 'Hello',
  body: 'This is a push notification',
  channels: ['push'],
  data: {
    deviceToken: 'fcm-device-token-here'
  }
});
```

### Recipient Token Resolution

The adapter looks for the device token in the following order:
1. `notification.data.deviceToken`
2. `preferences.data.deviceToken`

## Features

- [x] Single notification delivery
- [x] Batch notification delivery (`sendEach`)
- [x] Multicast support (grouping identical messages by content)
- [x] Health check support
- [x] Error classification and metadata

## License

MIT © [Engr., Isaiah Pius E.](https://github.com/IsaiahTek)
