
enum ChannelType { inapp, push, email, sms, webhook }

enum NotificationStatus { pending, sent, delivered, failed, read }

enum NotificationPriority { low, normal, high, urgent }

enum RealtimeTransport { sse, websocket, polling, none }

enum RealtimeStatus { idle, connecting, connected, fallback, error }

class NotificationAction {
  final String id;
  final String label;
  final String? url;
  final String? handler;

  NotificationAction({
    required this.id,
    required this.label,
    this.url,
    this.handler,
  });

  factory NotificationAction.fromJson(Map<String, dynamic> json) {
    return NotificationAction(
      id: json['id'],
      label: json['label'],
      url: json['url'],
      handler: json['handler'],
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'label': label,
        'url': url,
        'handler': handler,
      };
}

class Notification {
  final String id;
  final String type;
  final String title;
  final String body;
  final Map<String, dynamic>? data;
  final String userId;
  final String? groupId;
  final NotificationPriority priority;
  final String? category;
  final NotificationStatus status;
  final DateTime? readAt;
  final DateTime createdAt;
  final DateTime? scheduledFor;
  final DateTime? expiresAt;
  final List<ChannelType> channels;
  final List<NotificationAction>? actions;

  Notification({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    this.data,
    required this.userId,
    this.groupId,
    required this.priority,
    this.category,
    required this.status,
    this.readAt,
    required this.createdAt,
    this.scheduledFor,
    this.expiresAt,
    required this.channels,
    this.actions,
  });

  factory Notification.fromJson(Map<String, dynamic> json) {
    return Notification(
      id: json['id'],
      type: json['type'],
      title: json['title'],
      body: json['body'],
      data: json['data'] != null ? Map<String, dynamic>.from(json['data']) : null,
      userId: json['userId'],
      groupId: json['groupId'],
      priority: NotificationPriority.values.firstWhere(
        (e) => e.name == json['priority'],
        orElse: () => NotificationPriority.normal,
      ),
      category: json['category'],
      status: NotificationStatus.values.firstWhere(
        (e) => e.name == json['status'],
        orElse: () => NotificationStatus.pending,
      ),
      readAt: json['readAt'] != null ? DateTime.parse(json['readAt']) : null,
      createdAt: DateTime.parse(json['createdAt']),
      scheduledFor: json['scheduledFor'] != null ? DateTime.parse(json['scheduledFor']) : null,
      expiresAt: json['expiresAt'] != null ? DateTime.parse(json['expiresAt']) : null,
      channels: (json['channels'] as List<dynamic>?)
              ?.map((e) => ChannelType.values.firstWhere((c) => c.name == e))
              .toList() ??
          [],
      actions: (json['actions'] as List<dynamic>?)
          ?.map((e) => NotificationAction.fromJson(e))
          .toList(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'type': type,
        'title': title,
        'body': body,
        'data': data,
        'userId': userId,
        'groupId': groupId,
        'priority': priority.name,
        'category': category,
        'status': status.name,
        'readAt': readAt?.toIso8601String(),
        'createdAt': createdAt.toIso8601String(),
        'scheduledFor': scheduledFor?.toIso8601String(),
        'expiresAt': expiresAt?.toIso8601String(),
        'channels': channels.map((e) => e.name).toList(),
        'actions': actions?.map((e) => e.toJson()).toList(),
      };
}

class NotificationStats {
  final int total;
  final int unread;
  final Map<NotificationStatus, int> byStatus;
  final Map<ChannelType, int> byChannel;
  final Map<NotificationPriority, int> byPriority;

  NotificationStats({
    required this.total,
    required this.unread,
    required this.byStatus,
    required this.byChannel,
    required this.byPriority,
  });

  factory NotificationStats.fromJson(Map<String, dynamic> json) {
    return NotificationStats(
      total: json['total'] ?? 0,
      unread: json['unread'] ?? 0,
      byStatus: (json['byStatus'] as Map<String, dynamic>?)?.map(
            (k, v) => MapEntry(
                NotificationStatus.values.firstWhere((e) => e.name == k), v as int),
          ) ??
          {},
      byChannel: (json['byChannel'] as Map<String, dynamic>?)?.map(
            (k, v) => MapEntry(
                ChannelType.values.firstWhere((e) => e.name == k), v as int),
          ) ??
          {},
      byPriority: (json['byPriority'] as Map<String, dynamic>?)?.map(
            (k, v) => MapEntry(
                NotificationPriority.values.firstWhere((e) => e.name == k), v as int),
          ) ??
          {},
    );
  }
}

class ChannelPreferences {
  final bool enabled;
  final List<String>? categories;
  final Map<String, String>? quietHours;
  final String? frequency;

  ChannelPreferences({
    required this.enabled,
    this.categories,
    this.quietHours,
    this.frequency,
  });

  factory ChannelPreferences.fromJson(Map<String, dynamic> json) {
    return ChannelPreferences(
      enabled: json['enabled'] ?? true,
      categories: (json['categories'] as List<dynamic>?)?.cast<String>(),
      quietHours: (json['quietHours'] as Map<String, dynamic>?)?.cast<String, String>(),
      frequency: json['frequency'],
    );
  }

  Map<String, dynamic> toJson() => {
    'enabled': enabled,
    'categories': categories,
    'quietHours': quietHours,
    'frequency': frequency,
  };
}

class NotificationPreferences {
  final String userId;
  final Map<ChannelType, ChannelPreferences> channels;
  final bool globalMute;
  final DateTime? updatedAt;
  final Map<String, dynamic>? data;

  NotificationPreferences({
    required this.userId,
    required this.channels,
    this.globalMute = false,
    this.updatedAt,
    this.data,
  });

  factory NotificationPreferences.fromJson(Map<String, dynamic> json) {
    final channelsMap = <ChannelType, ChannelPreferences>{};
    if (json['channels'] != null) {
      (json['channels'] as Map<String, dynamic>).forEach((key, value) {
        try {
          final type = ChannelType.values.firstWhere((e) => e.name == key);
          channelsMap[type] = ChannelPreferences.fromJson(value);
        } catch (_) {}
      });
    }

    return NotificationPreferences(
      userId: json['userId'],
      channels: channelsMap,
      globalMute: json['globalMute'] ?? false,
      updatedAt: json['updatedAt'] != null ? DateTime.parse(json['updatedAt']) : null,
      data: json['data'] != null ? Map<String, dynamic>.from(json['data']) : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'userId': userId,
    'channels': channels.map((k, v) => MapEntry(k.name, v.toJson())),
    'globalMute': globalMute,
    'updatedAt': updatedAt?.toIso8601String(),
    'data': data,
  };
}

class NotificationConfig {
  final String apiUrl;
  final String userId;
  final RealtimeTransport realtimeTransport;
  final String? sseUrl;
  final String? ssePath;
  final String? sseAuthQueryParam;
  final int sseConnectTimeoutMs;
  final String? wsUrl;
  final Duration? pollInterval;
  final bool debug;
  final Function(Map<String, dynamic>)? onDebugEvent;
  final Future<String?> Function()? getAuthToken;
  final Future<void> Function()? onRefreshAuth;
  final dynamic Function(dynamic)? dataLocator;
  final Function(Notification)? onNotification;

  NotificationConfig({
    required this.apiUrl,
    required this.userId,
    this.realtimeTransport = RealtimeTransport.sse,
    this.sseUrl,
    this.ssePath,
    this.sseAuthQueryParam,
    this.sseConnectTimeoutMs = 5000,
    this.wsUrl,
    this.pollInterval,
    this.debug = false,
    this.onDebugEvent,
    this.getAuthToken,
    this.onRefreshAuth,
    this.dataLocator,
    this.onNotification,
  });

  NotificationConfig copyWith({
    String? apiUrl,
    String? userId,
    RealtimeTransport? realtimeTransport,
    String? sseUrl,
    String? ssePath,
    String? sseAuthQueryParam,
    int? sseConnectTimeoutMs,
    String? wsUrl,
    Duration? pollInterval,
    bool? debug,
    Function(Map<String, dynamic>)? onDebugEvent,
    Future<String?> Function()? getAuthToken,
    Future<void> Function()? onRefreshAuth,
    dynamic Function(dynamic)? dataLocator,
    Function(Notification)? onNotification,
  }) {
    return NotificationConfig(
      apiUrl: apiUrl ?? this.apiUrl,
      userId: userId ?? this.userId,
      realtimeTransport: realtimeTransport ?? this.realtimeTransport,
      sseUrl: sseUrl ?? this.sseUrl,
      ssePath: ssePath ?? this.ssePath,
      sseAuthQueryParam: sseAuthQueryParam ?? this.sseAuthQueryParam,
      sseConnectTimeoutMs: sseConnectTimeoutMs ?? this.sseConnectTimeoutMs,
      wsUrl: wsUrl ?? this.wsUrl,
      pollInterval: pollInterval ?? this.pollInterval,
      debug: debug ?? this.debug,
      onDebugEvent: onDebugEvent ?? this.onDebugEvent,
      getAuthToken: getAuthToken ?? this.getAuthToken,
      onRefreshAuth: onRefreshAuth ?? this.onRefreshAuth,
      dataLocator: dataLocator ?? this.dataLocator,
      onNotification: onNotification ?? this.onNotification,
    );
  }
}
