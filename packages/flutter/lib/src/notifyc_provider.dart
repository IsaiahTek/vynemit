import 'package:flutter/foundation.dart';
import 'api_client.dart';
import 'models/models.dart';
import 'realtime_service.dart';

class NotifycProvider extends ChangeNotifier {
  final NotificationConfig config;
  late final NotificationApiClient _apiClient;
  late final RealtimeService _realtimeService;

  List<Notification> _notifications = [];
  int _unreadCount = 0;
  NotificationStats? _stats;
  NotificationPreferences? _preferences;
  bool _loading = false;
  String? _error;
  bool _isConnected = false;
  DateTime? _lastSync;

  List<Notification> get notifications => _notifications;
  int get unreadCount => _unreadCount;
  NotificationStats? get stats => _stats;
  NotificationPreferences? get preferences => _preferences;
  bool get loading => _loading;
  String? get error => _error;
  bool get isConnected => _isConnected;
  DateTime? get lastSync => _lastSync;

  NotifycProvider(this.config) {
    _apiClient = NotificationApiClient(config);
    _realtimeService = RealtimeService(
      config: config,
      onMessage: _onMessage,
    );
    _initialize();
  }

  Future<void> _initialize() async {
    _setLoading(true);
    try {
      await Future.wait([
        fetchNotifications(),
        fetchUnreadCount(),
        fetchPreferences(),
      ]);
      await _realtimeService.connect();
      _isConnected = true;
      _lastSync = DateTime.now();
    } catch (e) {
      _error = e.toString();
    } finally {
      _setLoading(false);
      notifyListeners();
    }
  }

  void _onMessage(Map<String, dynamic> data, {bool isSSE = false}) {
    final type = data['type'];
    if (type == 'notification') {
      final notifJson = isSSE ? data['data'] : data['notification'];
      final notification = Notification.fromJson(notifJson);
      _notifications.insert(0, notification);
      if (notification.status != NotificationStatus.read) {
        _unreadCount++;
      }
      notifyListeners();
    } else if (type == 'unread-count') {
      _unreadCount = isSSE ? data['data'] : data['count'];
      notifyListeners();
    } else if (type == 'initial-data') {
      final initialData = isSSE ? data['data'] : data;
      _notifications = (initialData['notifications'] as List)
          .map((e) => Notification.fromJson(e))
          .toList();
      _unreadCount = initialData['unreadCount'] ?? 0;
      _isConnected = true;
      notifyListeners();
    }
  }

  void _setLoading(bool value) {
    _loading = value;
    notifyListeners();
  }

  Future<void> fetchNotifications() async {
    try {
      _notifications = await _apiClient.getNotifications();
      _lastSync = DateTime.now();
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }

  Future<void> fetchUnreadCount() async {
    try {
      _unreadCount = await _apiClient.getUnreadCount();
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }

  Future<void> fetchPreferences() async {
    try {
      _preferences = await _apiClient.getPreferences();
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }

  Future<void> markAsRead(String notificationId) async {
    try {
      await _apiClient.markAsRead(notificationId);
      final index = _notifications.indexWhere((n) => n.id == notificationId);
      if (index != -1) {
        // Optimistic update
        final n = _notifications[index];
        _notifications[index] = Notification(
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          data: n.data,
          userId: n.userId,
          groupId: n.groupId,
          priority: n.priority,
          category: n.category,
          status: NotificationStatus.read,
          readAt: DateTime.now(),
          createdAt: n.createdAt,
          scheduledFor: n.scheduledFor,
          expiresAt: n.expiresAt,
          channels: n.channels,
          actions: n.actions,
        );
        _unreadCount = (_unreadCount - 1).clamp(0, double.infinity).toInt();
        notifyListeners();
      }
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }

  Future<void> markAllAsRead() async {
    try {
      await _apiClient.markAllAsRead();
      _notifications = _notifications.map((n) => Notification(
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          data: n.data,
          userId: n.userId,
          groupId: n.groupId,
          priority: n.priority,
          category: n.category,
          status: NotificationStatus.read,
          readAt: DateTime.now(),
          createdAt: n.createdAt,
          scheduledFor: n.scheduledFor,
          expiresAt: n.expiresAt,
          channels: n.channels,
          actions: n.actions,
        )).toList();
      _unreadCount = 0;
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }

  Future<void> deleteNotification(String notificationId) async {
    try {
      await _apiClient.deleteNotification(notificationId);
      final index = _notifications.indexWhere((n) => n.id == notificationId);
      if (index != -1) {
        if (_notifications[index].status != NotificationStatus.read) {
          _unreadCount = (_unreadCount - 1).clamp(0, double.infinity).toInt();
        }
        _notifications.removeAt(index);
        notifyListeners();
      }
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }

  Future<void> updatePreferences(Map<String, dynamic> prefs) async {
    try {
      await _apiClient.updatePreferences(prefs);
      await fetchPreferences(); // Refresh local state
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }

  /// Registers an FCM/Push token by storing it in the user's notification preferences.
  /// This allows the backend FirebasePushAdapter to retrieve the tokens for delivery.
  Future<void> registerPushToken(String token) async {
    try {
      // 1. Ensure preferences are loaded
      if (_preferences == null) {
        await fetchPreferences();
      }

      // 2. Safely extract existing device tokens
      final existingData = Map<String, dynamic>.from(_preferences?.data ?? {});
      final List<String> tokens = List<String>.from(existingData['deviceTokens'] ?? []);

      // 3. Add token if it's new
      if (!tokens.contains(token)) {
        tokens.add(token);
        existingData['deviceTokens'] = tokens;

        // 4. Update the server
        await updatePreferences({'data': existingData});
      }
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      rethrow;
    }
  }

  /// Manually injects a notification into the provider state.
  /// Useful for synchronizing foreground FCM messages with the UI.
  /// [data] should be the raw map payload from the message.
  void handleSerializedNotification(Map<String, dynamic> data) {
    _onMessage(data, isSSE: false);
  }

  @override
  void dispose() {
    _apiClient.dispose();
    _realtimeService.disconnect();
    super.dispose();
  }
}
