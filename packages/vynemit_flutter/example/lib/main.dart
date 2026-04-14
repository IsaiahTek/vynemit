import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:vynemit_flutter/vynemit_flutter.dart' as vynemit;

void main() {
  runApp(const ExampleApp());
}

class ExampleApp extends StatelessWidget {
  const ExampleApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'vynemit_flutter Example',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0F766E)),
        useMaterial3: true,
      ),
      home: const ExampleHomePage(),
    );
  }
}

class ExampleHomePage extends StatelessWidget {
  const ExampleHomePage({super.key});

  @override
  Widget build(BuildContext context) {
    final config = vynemit.NotificationConfig(
      apiUrl: 'https://api.example.com',
      userId: 'user_123',
      realtimeTransport: vynemit.RealtimeTransport.sse,
      ssePath: '/notifications/:userId/stream',
    );

    final notifications = <vynemit.Notification>[
      vynemit.Notification(
        id: 'notif_001',
        type: 'order.updated',
        title: 'Order shipped',
        body: 'Your order #1042 is on the way.',
        userId: 'user_123',
        priority: vynemit.NotificationPriority.high,
        status: vynemit.NotificationStatus.sent,
        createdAt: DateTime.now().subtract(const Duration(minutes: 15)),
        channels: const [vynemit.ChannelType.inapp, vynemit.ChannelType.push],
        data: const {'orderId': '1042'},
      ),
      vynemit.Notification(
        id: 'notif_002',
        type: 'security.login',
        title: 'New device sign-in',
        body: 'We noticed a new sign-in from Lagos.',
        userId: 'user_123',
        priority: vynemit.NotificationPriority.normal,
        status: vynemit.NotificationStatus.read,
        createdAt: DateTime.now().subtract(const Duration(hours: 3)),
        channels: const [vynemit.ChannelType.inapp, vynemit.ChannelType.email],
        data: const {'location': 'Lagos'},
      ),
    ];

    return Scaffold(
      appBar: AppBar(title: const Text('vynemit_flutter')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Text(
            'Package overview',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 12),
          const Text(
            'This example previews the exported models and the configuration '
            'shape you would pass into VynemitProvider in your own app.',
          ),
          const SizedBox(height: 24),
          _SectionCard(
            title: 'NotificationConfig',
            child: SelectableText(
              const JsonEncoder.withIndent('  ').convert({
                'apiUrl': config.apiUrl,
                'userId': config.userId,
                'realtimeTransport': 'sse',
                'ssePath': config.ssePath,
              }),
            ),
          ),
          const SizedBox(height: 16),
          _SectionCard(
            title: 'Serialized notifications',
            child: Column(
              children: [
                for (final notification in notifications) ...[
                  _NotificationPreview(notification: notification),
                  const SizedBox(height: 12),
                ],
              ],
            ),
          ),
          const SizedBox(height: 16),
          _SectionCard(
            title: 'Next step',
            child: const SelectableText(
              'Wrap your app with ChangeNotifierProvider and create a '
              'VynemitProvider(NotificationConfig(...)) to enable fetching, '
              'unread counts, and realtime updates.',
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}

class _NotificationPreview extends StatelessWidget {
  const _NotificationPreview({required this.notification});

  final vynemit.Notification notification;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              notification.title,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Text(notification.body),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                Chip(label: Text(notification.type)),
                Chip(label: Text('priority: ${notification.priority.name}')),
                Chip(label: Text('status: ${notification.status.name}')),
                for (final channel in notification.channels)
                  Chip(label: Text(channel.name)),
              ],
            ),
            const SizedBox(height: 12),
            SelectableText(
              const JsonEncoder.withIndent('  ').convert(notification.toJson()),
            ),
          ],
        ),
      ),
    );
  }
}
