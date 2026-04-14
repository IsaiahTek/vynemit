import 'package:flutter/foundation.dart';
import 'api_client.dart';
import 'models/models.dart';
import 'realtime_service.dart';

/// A ChangeNotifier that manages the Vynemit Notification SDK state and coordinates
/// both REST API calls and real-time connectivity (WebSocket/SSE) for a specific user.
/// It provides reactive state updates to the UI, handling notification fetches, unread counts,
/// and optimistic local updates.
class VynemitProvider extends ChangeNotifier {
  NotificationConfig config;
  late NotificationApiClient _apiClient;
  late RealtimeService _realtimeService;

  List<Notification> _notifications = [];
  int _unreadCount = 0;
  NotificationStats? _stats;
  NotificationPreferences? _preferences;
  bool _loading = false;
  String? _error;
  bool _isConnected = false;
  DateTime? _lastSync;

  /// The current state of notifications.
  List<Notification> get notifications => _notifications;

  /// The current number of unread notifications for the user.
  int get unreadCount => _unreadCount;

  /// Additional notification statistics (e.g., breakdown by channel).
  NotificationStats? get stats => _stats;

  /// The user's active notification preferences and opt-ins.
  NotificationPreferences? get preferences => _preferences;

  /// Whether the provider is currently initializing or performing a major sync.
  bool get loading => _loading;

  /// Holds the last error encountered during an operation (if any).
  String? get error => _error;

  /// Whether the real-time transport (WebSocket/SSE) is currently connected and active.
  bool get isConnected => _isConnected;

  /// The specific time an active sync with the server last happened.
  DateTime? get lastSync => _lastSync;

  VynemitProvider(this.config) {
    _apiClient = NotificationApiClient(config);
    _realtimeService = RealtimeService(
      config: config,
      onMessage: _onMessage,
    );
    _initialize();
  }

  Future<void> _initialize() async {
    _setLoading(true);
    _error = null;
    try {
      if (config.debug) {
        debugPrint(
            "VynemitProvider: initializing for user ${config.userId}...");
      }
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
      if (config.debug) {
        debugPrint("VynemitProvider: initialization failed: $e");
      }
    } finally {
      _setLoading(false);
      notifyListeners();
    }
  }

  void _onMessage(Map<String, dynamic> data,
      {bool isSSE = false, String? eventType}) {
    final type = eventType ?? data['type'];

    if (config.debug) {
      debugPrint(
          "VynemitProvider: message received (type: $type, isSSE: $isSSE)");
    }

    if (type == 'notification') {
      try {
        final notifJson = data['notification'] ?? data['data'] ?? data;
        final notification = Notification.fromJson(notifJson);

        // Fully reassign the list so listeners like `Selector` relying on object equality will rebuild.
        _notifications = [notification, ..._notifications];

        if (notification.status != NotificationStatus.read) {
          _unreadCount++;
        }

        // Fire the onNotification callback so the app can show a Snackbar or sound alert!
        config.onNotification?.call(notification);

        // Update UI state
        notifyListeners();
      } catch (e, stacktrace) {
        if (config.debug)
          debugPrint(
              "VynemitProvider: Error parsing SSE incoming notification: $e\nData: $data\nStackTrace: $stacktrace");
      }
    } else if (type == 'unread-count') {
      _unreadCount = data['count'] ?? data['data'] ?? 0;
      notifyListeners();
    } else if (type == 'initial-data') {
      // For initial-data, both WS and SSE will have notifications and unreadCount in the root of data
      final initialData =
          data['data'] != null && data['data'] is Map ? data['data'] : data;

      _notifications = (initialData['notifications'] as List? ?? [])
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

  /// Fetches the user's notification preferences from the server.
  Future<void> fetchPreferences() async {
    try {
      _preferences = await _apiClient.getPreferences();
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }

  /// Optimistically marks a specific notification as "read" locally, then updates the server.
  ///
  /// [notificationId] The ID of the notification to mark read.
  Future<void> markAsRead(String notificationId) async {
    try {
      await _apiClient.markAsRead(notificationId);
      final index = _notifications.indexWhere((n) => n.id == notificationId);
      if (index != -1) {
        final n = _notifications[index];
        // Only update if it wasn't already read — avoids double-counting
        final wasUnread = n.status != NotificationStatus.read;
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
        // Only decrement locally if no SSE unread-count event will follow.
        // Since the server broadcasts an unread-count SSE event after each read,
        // we skip the local decrement to prevent double-subtraction.
        // If SSE is NOT connected, fall back to local decrement.
        if (!_isConnected && wasUnread) {
          _unreadCount = (_unreadCount - 1).clamp(0, double.infinity).toInt();
        }
        notifyListeners();
      }
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }

  /// Optimistically marks all notifications as read locally, then syncs the action to the server.
  Future<void> markAllAsRead() async {
    try {
      await _apiClient.markAllAsRead();
      _notifications = _notifications
          .map((n) => Notification(
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
              ))
          .toList();
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

  /// Updates the configuration logic of the Provider, causing it to dispose of old connections
  /// and thoroughly re-initialize with the new configuration (e.g. when changing Users/Tenants).
  ///
  /// [userId] Dynamically change the associated User without providing a whole new Config object.
  /// [newConfig] Override the current configuration completely.
  Future<void> updateConfig(
      {String? userId, NotificationConfig? newConfig}) async {
    if (config.debug) {
      debugPrint(
          "VynemitProvider: updating config (userId: $userId, hasNewConfig: ${newConfig != null})");
      config.onDebugEvent?.call({
        'type': 'update-config',
        'userId': userId,
        'hasNewConfig': newConfig != null,
      });
    }

    final oldConfig = config;
    if (newConfig != null) {
      config = newConfig;
    } else if (userId != null) {
      config = config.copyWith(userId: userId);
    }

    // Make sure our existing API and Realtime clients use the newest config/token getters.
    _apiClient.config = config;
    _realtimeService.config = config;

    // Only drop connections and re-initialize if fundamental user params changed.
    final userChanged =
        oldConfig.userId != config.userId || oldConfig.apiUrl != config.apiUrl;

    if (userChanged) {
      if (config.debug)
        debugPrint(
            "VynemitProvider: Connection dropping due to config user change");
      await _initialize();
    } else {
      if (config.debug)
        debugPrint(
            "VynemitProvider: Config updated, preserving active connections.");
      if (!_isConnected) {
        _realtimeService.connect();
      }
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
      final List<String> tokens =
          List<String>.from(existingData['deviceTokens'] ?? []);

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
