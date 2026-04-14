# vynemit_flutter

A powerful, lightweight Flutter client for the **Vynemit** notification system. It helps you fetch notifications, keep unread state in sync, and render a notification center in Flutter with minimal wiring.

## Features

- **Quick setup**: Connect a user and start syncing notifications in minutes.
- **Realtime updates**: Supports SSE and WebSockets with fallback handling.
- **State management**: Ships with `VynemitProvider` for `ChangeNotifier`-based apps.
- **UI helpers**: Includes `NotificationBadge`, `NotificationList`, and `NotificationItem`.
- **Auth-aware API client**: Supports async token lookup and refresh flows.
- **Flexible data access**: Exposes the REST client and models for custom experiences.

## Installation

Add the package to your app:

```yaml
dependencies:
  vynemit_flutter: ^0.1.0
  provider: ^6.1.1
```

Then install dependencies:

```bash
flutter pub get
```

## Quick Start

Wrap your app with `ChangeNotifierProvider` and create a `VynemitProvider` with your API settings:

```dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:vynemit_flutter/vynemit_flutter.dart';

void main() {
  final config = NotificationConfig(
    apiUrl: 'https://api.yourapp.com',
    userId: 'user_123',
    getAuthToken: () async => 'your_jwt_token',
  );

  runApp(
    ChangeNotifierProvider(
      create: (_) => VynemitProvider(config),
      child: const MyApp(),
    ),
  );
}
```

Show unread counts with `NotificationBadge`:

```dart
AppBar(
  actions: [
    NotificationBadge(
      child: IconButton(
        icon: const Icon(Icons.notifications),
        onPressed: () => _openNotificationCenter(context),
      ),
    ),
  ],
)
```

Render a notification feed with `NotificationList`:

```dart
class NotificationCenter extends StatelessWidget {
  const NotificationCenter({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: const NotificationList(
        padding: EdgeInsets.symmetric(vertical: 8),
      ),
    );
  }
}
```

## Firebase Cloud Messaging

Register the current device token with Vynemit:

```dart
final token = await FirebaseMessaging.instance.getToken();
if (token != null) {
  context.read<VynemitProvider>().registerPushToken(token);
}
```

Keep foreground FCM payloads in sync with the in-app store:

```dart
FirebaseMessaging.onMessage.listen((RemoteMessage message) {
  if (message.data['origin'] == 'vynemit') {
    context.read<VynemitProvider>().handleSerializedNotification(message.data);
  }
});
```

## Advanced Configuration

Prefer WebSockets when available:

```dart
final config = NotificationConfig(
  apiUrl: 'https://api.yourapp.com',
  userId: 'user_123',
  realtimeTransport: RealtimeTransport.websocket,
  wsUrl: 'wss://api.yourapp.com',
);
```

Override the default row UI:

```dart
NotificationList(
  itemBuilder: (context, notification) {
    return Card(
      child: ListTile(
        title: Text(notification.title),
        subtitle: Text(notification.body),
        trailing: Icon(
          notification.priority == NotificationPriority.urgent
              ? Icons.priority_high
              : Icons.notifications,
        ),
      ),
    );
  },
)
```

## Exports

- `NotificationConfig` for client configuration.
- `VynemitProvider` for reactive state and realtime orchestration.
- `NotificationApiClient` for direct REST access.
- `NotificationList`, `NotificationBadge`, and `NotificationItem` for UI building blocks.
- `Notification`, `NotificationPreferences`, and related models for custom rendering.

## Example

A runnable example app is included in [`example/`](example). From this package directory, run:

```bash
flutter run -d chrome -t example/lib/main.dart
```

## License

MIT © [Isaiah Tek](https://github.com/IsaiahTek)
