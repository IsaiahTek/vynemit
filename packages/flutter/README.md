# notifyc_flutter 🚀

A powerful, lightweight Flutter client for the **notifyc** notification system. This package provides everything you need to integrate real-time notifications into your Flutter applications with minimal effort.

## ✨ Features

- 🏎️ **Quick Setup**: Start receiving notifications in minutes.
- 🔄 **Real-time Synchronization**: Built-in support for SSE (Server-Sent Events) and WebSockets with automatic fallback.
- 📦 **State Management**: Integrated `ChangeNotifier` for easy UI binding.
- 🎨 **Ready-to-use UI Components**: Customizable `NotificationBadge`, `NotificationList`, and `NotificationItem`.
- 🔐 **Authentication Support**: Seamless JWT handling with token refresh.
- 🛠️ **Fully Customizable**: Override any logic or component to fit your needs.

## 📦 Installation

Add `notifyc_flutter` to your `pubspec.yaml`:

```yaml
dependencies:
  notifyc_flutter:
    path: ../packages/flutter # Adjust the path as necessary for your monorepo
  provider: ^6.1.1
```

## 🎯 Quick Start

### 1. Initialize the Provider

Wrap your app with `ChangeNotifierProvider`:

```dart
import 'package:flutter/material.dart';
import 'package:notifyc_flutter/notifyc_flutter.dart';
import 'package:provider/provider.dart';

void main() {
  final config = NotificationConfig(
    apiUrl: 'https://api.yourapp.com',
    userId: 'user_123',
    getAuthToken: () async => 'your_jwt_token',
  );

  runApp(
    ChangeNotifierProvider(
      create: (_) => NotifycProvider(config),
      child: const MyApp(),
    ),
  );
}
```

### 2. Add the Notification Badge

Use the `NotificationBadge` to show unread counts on an icon:

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

### 3. Display the Notification List

Use the `NotificationList` widget to show all notifications:

```dart
class NotificationCenter extends StatelessWidget {
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

### 4. FCM Integration (Push Notifications)

Notifyc is designed to work seamlessly with Firebase Cloud Messaging.

#### Token Registration
To receive push notifications, you must register the device token with Notifyc. The package will store this in the user's preferences:

```dart
final token = await FirebaseMessaging.instance.getToken();
if (token != null) {
  context.read<NotifycProvider>().registerPushToken(token);
}
```

#### Foreground Synchronization
While the app is in the foreground, Notifyc primarily uses SSE/WebSockets for updates. However, to ensure total consistency with FCM messages, use the `handleSerializedNotification` helper:

```dart
FirebaseMessaging.onMessage.listen((RemoteMessage message) {
  // If the message is from notifyc, sync it with the UI state
  if (message.data['origin'] == 'notifyc') {
    context.read<NotifycProvider>().handleSerializedNotification(message.data);
  }
});
```

#### Background Behavior
Notifications received while the app is in the background are handled automatically by the OS via FCM. When the user taps the notification and opens the app, the `NotifycProvider` will automatically re-sync with the server during initialization.

## 🔧 Advanced Configuration

### Real-time Transport Priority

Notifyc supports multiple transports. By default, it uses **SSE** and falls back to **WebSockets**:

```dart
final config = NotificationConfig(
  apiUrl: '...',
  userId: '...',
  // Explicitly prefer WebSockets
  realtimeTransport: RealtimeTransport.websocket,
  wsUrl: 'wss://api.yourapp.com',
);
```

### Custom UI Item

You can completely override the look of individual notification items:

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

## 🛠️ Package Exports

- `NotificationConfig`: Configuration settings for the client.
- `NotifycProvider`: The `ChangeNotifier` handling all logic and state.
- `NotificationList`, `NotificationBadge`, `NotificationItem`: Pre-built UI components.
- `NotificationApiClient`: Direct access to the REST API if needed.

## 📄 License

MIT © [Isaiah Tek](https://github.com/IsaiahTek)
