import 'dart:convert';
import 'package:http/http.dart' as http;
import 'models/models.dart';

class NotificationApiClient {
  NotificationConfig config;
  final http.Client _client;
  Future<void>? _refreshFuture;

  NotificationApiClient(this.config, {http.Client? client})
      : _client = client ?? http.Client();

  Future<T> _request<T>(
    String endpoint, {
    String method = 'GET',
    Map<String, String>? headers,
    dynamic body,
    bool isRetry = false,
  }) async {
    final token =
        config.getAuthToken != null ? await config.getAuthToken!() : null;

    final requestHeaders = {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
      ...headers ?? const <String, String>{},
    };

    final url = Uri.parse('${config.apiUrl}$endpoint');
    late http.Response response;

    switch (method.toUpperCase()) {
      case 'POST':
        response = await _client.post(url,
            headers: requestHeaders,
            body: body != null ? jsonEncode(body) : null);
        break;
      case 'PATCH':
        response = await _client.patch(url,
            headers: requestHeaders,
            body: body != null ? jsonEncode(body) : null);
        break;
      case 'PUT':
        response = await _client.put(url,
            headers: requestHeaders,
            body: body != null ? jsonEncode(body) : null);
        break;
      case 'DELETE':
        response = await _client.delete(url, headers: requestHeaders);
        break;
      default:
        response = await _client.get(url, headers: requestHeaders);
    }

    // Handle 401 retry
    if (response.statusCode == 401 &&
        !isRetry &&
        config.onRefreshAuth != null) {
      _refreshFuture ??=
          config.onRefreshAuth!().whenComplete(() => _refreshFuture = null);
      await _refreshFuture;
      return _request<T>(endpoint,
          method: method, headers: headers, body: body, isRetry: true);
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('API Error ${response.statusCode}: ${response.body}');
    }

    if (response.statusCode == 204) {
      return null as T;
    }

    final dynamic data = jsonDecode(response.body);
    final locatedData =
        config.dataLocator != null ? config.dataLocator!(data) : data;

    return locatedData as T;
  }

  Future<List<Notification>> getNotifications({
    List<NotificationStatus>? status,
    List<String>? type,
    int? limit,
    int? offset,
  }) async {
    final params = <String, String>{};
    if (status != null) params['status'] = status.map((e) => e.name).join(',');
    if (type != null) params['type'] = type.join(',');
    if (limit != null) params['limit'] = limit.toString();
    if (offset != null) params['offset'] = offset.toString();

    final query =
        params.isNotEmpty ? '?${Uri(queryParameters: params).query}' : '';
    final dynamic data =
        await _request('/notifications/${config.userId}$query');

    if (data is List) {
      return data.map((json) => Notification.fromJson(json)).toList();
    } else if (data is Map<String, dynamic>) {
      // Support cases where API returns a single notification or wrapped object
      return [Notification.fromJson(data)];
    }
    return [];
  }

  Future<int> getUnreadCount() async {
    final dynamic data =
        await _request('/notifications/${config.userId}/unread-count');
    return data['count'] as int;
  }

  Future<NotificationStats> getStats() async {
    final dynamic data =
        await _request('/notifications/${config.userId}/stats');
    return NotificationStats.fromJson(data);
  }

  Future<NotificationPreferences> getPreferences() async {
    final dynamic data =
        await _request('/notifications/${config.userId}/preferences');
    return NotificationPreferences.fromJson(data);
  }

  Future<void> markAsRead(String notificationId) async {
    await _request('/notifications/${config.userId}/$notificationId/read',
        method: 'PATCH');
  }

  Future<void> markAllAsRead() async {
    await _request('/notifications/${config.userId}/read-all', method: 'PATCH');
  }

  Future<void> markAsUnread(String notificationId) async {
    await _request('/notifications/${config.userId}/$notificationId/unread',
        method: 'PATCH');
  }

  Future<void> markAllAsUnread() async {
    await _request('/notifications/${config.userId}/unread-all',
        method: 'PATCH');
  }

  Future<void> deleteNotification(String notificationId) async {
    await _request('/notifications/${config.userId}/$notificationId',
        method: 'DELETE');
  }

  Future<void> deleteAll() async {
    await _request('/notifications/${config.userId}/all', method: 'DELETE');
  }

  Future<void> updatePreferences(Map<String, dynamic> prefs) async {
    await _request('/notifications/${config.userId}/preferences',
        method: 'PUT', body: prefs);
  }

  void dispose() {
    _client.close();
  }
}
