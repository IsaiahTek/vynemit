# @vynelix/vynemit-adapter-brevo

> Brevo (formerly Sendinblue) transactional email adapter for [Vynemit](https://github.com/IsaiahTek/vynemit).

Sends transactional emails via the [Brevo API v3](https://developers.brevo.com/) using the official `@getbrevo/brevo` SDK.

## Installation

```bash
npm install @vynelix/vynemit-adapter-brevo
```

## Prerequisites

Create a **Brevo** account and generate an API v3 key from  
**Settings → API keys → Create a new API key**.

## Quick Start

```typescript
import { NotificationCenter } from '@vynelix/vynemit-core';
import { BrevoProvider } from '@vynelix/vynemit-adapter-brevo';

const center = new NotificationCenter({
  // ...storage, queue, etc.
  transports: [
    new BrevoProvider({
      apiKey: process.env.BREVO_API_KEY!,
      sender: {
        name: 'My App',
        email: 'noreply@myapp.com',
      },
    }),
  ],
});

// Send a transactional email
await center.send({
  type: 'welcome',
  userId: 'user-42',
  title: 'Welcome to My App!',
  body: 'Thanks for signing up.',
  html: '<h1>Welcome!</h1><p>Thanks for signing up.</p>',
  channels: ['email'],
  data: {
    email: 'new-user@example.com',
  },
});
```

## Configuration

```typescript
interface BrevoConfig {
  /** Brevo API v3 key (required) */
  apiKey: string;

  /** Default From sender (required) */
  sender: {
    name: string;
    email: string;
  };

  /** Optional default Reply-To address */
  replyTo?: {
    name: string;
    email: string;
  };

  /** Enable verbose console logging */
  debug?: boolean;
}
```

## Recipient Email Resolution

The adapter resolves the recipient address in this priority order:

| Priority | Source |
|---|---|
| 1 | `notification.data.email` |
| 2 | `preferences.data.email` |
| 3 | `notification.userId` (if it is a valid email address) |

## Per-Notification Overrides via `data`

You can pass extra delivery options inside `notification.data`:

| Field | Type | Description |
|---|---|---|
| `email` | `string` | Recipient email address |
| `recipientName` | `string` | Recipient display name |
| `senderName` | `string` | Override default sender name |
| `senderEmail` | `string` | Override default sender email |
| `replyToEmail` | `string` | Override Reply-To address |
| `replyToName` | `string` | Override Reply-To display name |
| `templateId` | `number` | Brevo template ID |
| `templateParams` | `object` | Variables to inject into the template |
| `cc` | `Array<{ email, name? }>` | CC recipients |
| `bcc` | `Array<{ email, name? }>` | BCC recipients |
| `headers` | `Record<string, string>` | Custom SMTP headers |
| `attachments` | `Array<{ content: string, name: string }>` | Base-64 encoded attachments |
| `tags` | `string[]` | Brevo tags for analytics |

### Using a Brevo Template

```typescript
await center.send({
  type: 'password-reset',
  userId: 'user-99',
  title: 'Reset your password',   // subject line
  body: '',
  channels: ['email'],
  data: {
    email: 'user@example.com',
    templateId: 7,                 // Brevo template ID
    templateParams: {
      FIRST_NAME: 'Alice',
      RESET_LINK: 'https://myapp.com/reset?token=xyz',
    },
  },
});
```

## Features

- [x] Transactional email delivery via Brevo API v3
- [x] Brevo template support with dynamic params
- [x] Reply-To / CC / BCC / custom headers
- [x] Base-64 attachment support
- [x] Brevo tags for campaign analytics
- [x] Batch delivery (`sendBatch`)
- [x] Non-invasive health check (`GET /account`)
- [x] Email address validation and resolution chain
- [x] Full debug logging

## License

MIT © [Engr., Isaiah Pius E.](https://github.com/IsaiahTek)
