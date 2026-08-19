# @vynelix/vynemit-adapter-twilio

Twilio SMS & WhatsApp transport adapter for [Vynemit](https://github.com/IsaiahTek/vynemit).

## Installation

```bash
npm install @vynelix/vynemit-adapter-twilio
```

## Usage

```typescript
import { NotificationCenter } from '@vynelix/vynemit-core';
import { TwilioProvider } from '@vynelix/vynemit-adapter-twilio';

// Option 1: Using API Key and Secret (Recommended for production)
const twilio = new TwilioProvider({
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  apiKey: process.env.TWILIO_API_KEY,
  apiSecret: process.env.TWILIO_API_SECRET,
  fromNumber: '+1234567890', // Required if no messagingServiceSid
  // messagingServiceSid: 'MGxxxxxxxx', // Optional: Use a Messaging Service
  debug: true // Optional: enables detailed logging
});

// Option 2: Using Account SID and Auth Token
const twilioWithAuthToken = new TwilioProvider({
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  fromNumber: '+1234567890',
});

const nc = new NotificationCenter({
  transports: [twilio],
  // ... other config
});
```

## WhatsApp Support

To send via WhatsApp, ensure your recipient number is prefixed with `whatsapp:` or set the `whatsapp: true` flag in the notification data:

```typescript
await nc.send({
  userId: '+1234567890',
  body: 'Hello from WhatsApp!',
  data: {
    whatsapp: true // Force WhatsApp delivery
  }
});
```

## Messaging Services

If you provide a `messagingServiceSid`, it will prioritize that over the `fromNumber`. This is recommended for production to leverage Alphanumeric Sender IDs and sticky senders.

## Health Check

The adapter verifies connectivity by fetching account details from the Twilio API.

```typescript
const isHealthy = await twilio.healthCheck();
```
