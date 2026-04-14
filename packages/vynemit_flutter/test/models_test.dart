import 'package:flutter_test/flutter_test.dart';
import 'package:vynemit_flutter/vynemit_flutter.dart';

void main() {
  group('Notification Model', () {
    test('should parse from valid JSON', () {
      final json = {
        'id': 'notif_123',
        'type': 'test',
        'title': 'Test Title',
        'body': 'Test Body',
        'userId': 'user_456',
        'priority': 'high',
        'status': 'sent',
        'createdAt': '2023-10-27T10:00:00Z',
        'channels': ['inapp', 'push'],
      };

      final notification = Notification.fromJson(json);

      expect(notification.id, 'notif_123');
      expect(notification.priority, NotificationPriority.high);
      expect(notification.status, NotificationStatus.sent);
      expect(notification.channels, contains(ChannelType.inapp));
      expect(notification.createdAt, DateTime.parse('2023-10-27T10:00:00Z'));
    });

    test('should serialize to valid JSON', () {
      final notification = Notification(
        id: 'notif_123',
        type: 'test',
        title: 'Test Title',
        body: 'Test Body',
        userId: 'user_456',
        priority: NotificationPriority.high,
        status: NotificationStatus.sent,
        createdAt: DateTime.parse('2023-10-27T10:00:00Z'),
        channels: [ChannelType.inapp],
      );

      final json = notification.toJson();

      expect(json['id'], 'notif_123');
      expect(json['priority'], 'high');
      expect(json['status'], 'sent');
    });
  });

  group('NotificationPreferences Model', () {
    test('should parse from valid JSON', () {
      final json = {
        'userId': 'user_456',
        'globalMute': true,
        'channels': {
          'inapp': {'enabled': true},
          'email': {'enabled': false},
        },
      };

      final prefs = NotificationPreferences.fromJson(json);

      expect(prefs.userId, 'user_456');
      expect(prefs.globalMute, isTrue);
      expect(prefs.channels[ChannelType.inapp]?.enabled, isTrue);
      expect(prefs.channels[ChannelType.email]?.enabled, isFalse);
    });
  });
}
