import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:mocktail/mocktail.dart';
import 'package:vynemit_flutter/vynemit_flutter.dart';

class MockHttpClient extends Mock implements http.Client {}

void main() {
  late MockHttpClient mockClient;
  late NotificationConfig config;
  late NotificationApiClient apiClient;

  setUp(() {
    mockClient = MockHttpClient();
    config = NotificationConfig(
      apiUrl: 'https://api.test',
      userId: 'user_123',
    );
    apiClient = NotificationApiClient(config, client: mockClient);
    registerFallbackValue(Uri.parse('https://api.test'));
  });

  group('NotificationApiClient', () {
    test('getUnreadCount should return correct count', () async {
      when(() => mockClient.get(
            any(),
            headers: any(named: 'headers'),
          )).thenAnswer((_) async => http.Response(
            jsonEncode({'count': 5}),
            200,
            headers: {'content-type': 'application/json'},
          ));

      final count = await apiClient.getUnreadCount();

      expect(count, 5);
      verify(() => mockClient.get(
            Uri.parse('https://api.test/notifications/user_123/unread-count'),
            headers: any(named: 'headers'),
          )).called(1);
    });

    test('markAsRead should call correct endpoint', () async {
      when(() => mockClient.patch(
            any(),
            headers: any(named: 'headers'),
            body: any(named: 'body'),
          )).thenAnswer((_) async => http.Response('', 204));

      await apiClient.markAsRead('notif_456');

      verify(() => mockClient.patch(
            Uri.parse('https://api.test/notifications/user_123/notif_456/read'),
            headers: any(named: 'headers'),
            body: any(named: 'body'),
          )).called(1);
    });
  });
}
