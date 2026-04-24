# @vynelix/vynemit-adapter-sendgrid

SendGrid transport adapter for [Vynemit](https://github.com/IsaiahTek/vynemit).

## Installation

```bash
npm install @vynelix/vynemit-adapter-sendgrid
```

## Usage

```typescript
import { NotificationCenter } from '@vynelix/vynemit-core';
import { SendGridProvider } from '@vynelix/vynemit-adapter-sendgrid';

const sendgrid = new SendGridProvider({
  apiKey: process.env.SENDGRID_API_KEY,
  fromEmail: 'noreply@example.com',
  debug: true // Optional: enables detailed logging
});

const nc = new NotificationCenter({
  transports: [sendgrid],
  // ... other config
});
```

## Dynamic Templates

This adapter supports SendGrid Dynamic Templates. Pass the `templateId` and `templateData` in the notification data:

```typescript
await nc.send({
  userId: 'user-123',
  title: 'Welcome!', // Fallback subject
  body: '...', // Fallback body
  data: {
    email: 'user@example.com',
    templateId: 'd-xxxxxxxxxxxxxxxx',
    templateData: {
      firstName: 'John',
      inviteUrl: 'https://example.com/invite'
    }
  }
});
```

## Health Check

The adapter includes a non-invasive health check that verifies API key validity without sending actual emails.

```typescript
const isHealthy = await sendgrid.healthCheck();
```
