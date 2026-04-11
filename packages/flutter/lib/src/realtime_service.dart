import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'models/models.dart';

class RealtimeService {
  NotificationConfig config;
  final Function(Map<String, dynamic>, {bool isSSE, String? eventType}) onMessage;

  io.Socket? _ws;
  StreamSubscription? _sseSubscription;
  http.Client? _sseClient;
  Timer? _pollingTimer;
  Future<void>? _refreshFuture;

  Completer<bool>? _wsCompleter;
  Completer<bool>? _sseCompleter;

  RealtimeService({
    required this.config,
    required this.onMessage,
  });

  Future<bool> connect({bool isRetry = false}) async {
    disconnect();

    if (config.realtimeTransport == RealtimeTransport.none) return false;

    if (config.realtimeTransport == RealtimeTransport.sse) {
      final sseConnected = await connectSSE(isRetry: isRetry);
      if (sseConnected) return true;

      if (config.wsUrl != null) {
        return connectWebSocket(isRetry: isRetry);
      }
    } else if (config.realtimeTransport == RealtimeTransport.websocket) {
      final wsConnected = await connectWebSocket(isRetry: isRetry);
      if (wsConnected) return true;

      return connectSSE(isRetry: isRetry);
    } else if (config.realtimeTransport == RealtimeTransport.polling) {
      startPolling();
      return true;
    }

    return false;
  }

  Future<bool> connectWebSocket({bool isRetry = false}) async {
    if (_wsCompleter != null) return _wsCompleter!.future;

    _ws?.dispose();
    _ws = null;

    final completer = Completer<bool>();
    _wsCompleter = completer;

    try {
      final base = (config.wsUrl ?? config.apiUrl).replaceAll(RegExp(r'/+$'), '');
      final token = config.getAuthToken != null ? await config.getAuthToken!() : null;

      _ws = io.io('$base/notifications', io.OptionBuilder()
        .setTransports(['websocket'])
        .setAuth({'token': token})
        .setQuery({'userId': config.userId})
        .build());

      _ws!.onConnect((_) {
        if (!completer.isCompleted) completer.complete(true);
        _wsCompleter = null;
      });

      _ws!.onAny((event, data) {
        if (data is Map) {
          onMessage(Map<String, dynamic>.from(data), isSSE: false, eventType: event.toString());
        } else if (data != null) {
          try {
             // In case socket payload is serialized string
            final map = jsonDecode(data.toString());
            onMessage(map, isSSE: false, eventType: event.toString());
          } catch (_) {}
        }
      });

      _ws!.onConnectError((err) async {
        final errStr = err.toString().toLowerCase();
        if ((errStr.contains('401') || errStr.contains('unauthorized') || errStr.contains('authentication')) && !isRetry && config.onRefreshAuth != null) {
          if (config.debug) {
            config.onDebugEvent?.call({
              'type': 'ws-401',
              'message': 'WebSocket connection returned 401, attempting token refresh...',
            });
          }
          _refreshFuture ??= config.onRefreshAuth!().whenComplete(() => _refreshFuture = null);
          await _refreshFuture;
          
          // Reconnect with new token
          _ws?.dispose();
          _ws = null;
          final reconnected = await connectWebSocket(isRetry: true);
          if (!completer.isCompleted) completer.complete(reconnected);
          return;
        }

        if (config.debug) {
          config.onDebugEvent?.call({
            'type': 'ws-error',
            'message': 'WebSocket connect error: $err',
          });
        }
        if (!completer.isCompleted) completer.complete(false);
        _wsCompleter = null;
      });
      
      _ws!.onDisconnect((reason) async {
        if (config.debug) {
          config.onDebugEvent?.call({
            'type': 'ws-disconnect',
            'message': 'WebSocket disconnected: $reason',
          });
        }
        // If the server disconnected us specifically due to unauthorized, try to refresh and reconnect
        final reasonStr = reason.toString().toLowerCase();
        if ((reasonStr == 'io server disconnect' || reasonStr.contains('unauthorized')) && !isRetry && config.onRefreshAuth != null) {
          _refreshFuture ??= config.onRefreshAuth!().whenComplete(() => _refreshFuture = null);
          await _refreshFuture;
          connectWebSocket(isRetry: true);
        }
      });

    } catch (e) {
      if (!completer.isCompleted) completer.complete(false);
      _wsCompleter = null;
    }

    return completer.future;
  }

  Future<bool> connectSSE({bool isRetry = false}) async {
    if (_sseCompleter != null) return _sseCompleter!.future;

    _sseSubscription?.cancel();
    _sseClient?.close();
    _sseSubscription = null;
    _sseClient = null;

    final completer = Completer<bool>();
    _sseCompleter = completer;

    try {
      final base = (config.sseUrl ?? config.apiUrl).replaceAll(RegExp(r'/+$'), '');
      final path = (config.ssePath ?? '/notifications/:userId/stream')
          .replaceAll(':userId', Uri.encodeComponent(config.userId));

      final uri = Uri.parse('$base$path');
      final token = config.getAuthToken != null ? await config.getAuthToken!() : null;

      final urlWithToken = token != null
          ? uri.replace(queryParameters: {
              ...?uri.queryParameters,
              config.sseAuthQueryParam ?? 'token': token,
            })
          : uri;

      _sseClient = http.Client();
      final request = http.Request('GET', urlWithToken);
      request.headers['Accept'] = 'text/event-stream';
      request.headers['Cache-Control'] = 'no-cache';
      if (token != null) {
        request.headers['Authorization'] = 'Bearer $token';
      }

      final response = await _sseClient!.send(request);
      
      if (response.statusCode == 401 && !isRetry && config.onRefreshAuth != null) {
        if (config.debug) {
          config.onDebugEvent?.call({
            'type': 'sse-401',
            'message': 'SSE connection returned 401, attempting token refresh...',
          });
        }
        
        _refreshFuture ??= config.onRefreshAuth!().whenComplete(() => _refreshFuture = null);
        await _refreshFuture;
        
        // Retry connection once
        _sseClient?.close();
        _sseClient = null;
        return connectSSE(isRetry: true);
      }

      if (response.statusCode != 200) {
        if (config.debug) {
          config.onDebugEvent?.call({
            'type': 'sse-error',
            'message': 'SSE connection failed with status: ${response.statusCode}',
          });
        }
        if (!completer.isCompleted) completer.complete(false);
        _sseCompleter = null;
        return false;
      }

      String? currentSseEvent;

      _sseSubscription = response.stream
          .transform(utf8.decoder)
          .transform(const LineSplitter())
          .listen((line) {
        if (!completer.isCompleted) {
          completer.complete(true);
          _sseCompleter = null;
        }

        if (line.startsWith('event:')) {
          currentSseEvent = line.substring(6).trim();
        } else if (line.startsWith('data:')) {
          final data = line.substring(5).trim();
          if (data.isNotEmpty) {
            try {
              final mapData = jsonDecode(data);
              onMessage(mapData is Map ? Map<String, dynamic>.from(mapData) : {'data': mapData}, isSSE: true, eventType: currentSseEvent);
              currentSseEvent = null;
            } catch (_) {
              try {
                onMessage({'data': data}, isSSE: true, eventType: currentSseEvent);
                currentSseEvent = null;
              } catch (_) {}
            }
          }
        }
      }, onError: (err) {
        if (!completer.isCompleted) {
          completer.complete(false);
          _sseCompleter = null;
        }
      }, onDone: () {
        if (!completer.isCompleted) {
          completer.complete(false);
          _sseCompleter = null;
        }
      });

      // Timeout for initial connection
      Timer(const Duration(seconds: 2), () {
        if (!completer.isCompleted) {
          completer.complete(true); // Assume success if no error yet
          _sseCompleter = null;
        }
      });

    } catch (e) {
      if (!completer.isCompleted) completer.complete(false);
      _sseCompleter = null;
    }

    return completer.future;
  }

  void startPolling() {
    if (config.pollInterval == null) return;
    _pollingTimer?.cancel();
    _pollingTimer = Timer.periodic(config.pollInterval!, (_) {
      // Polling is handled by the Provider/Facade
    });
  }

  void stopPolling() {
    _pollingTimer?.cancel();
    _pollingTimer = null;
  }

  void disconnect() {
    _ws?.dispose();
    _ws = null;
    _sseSubscription?.cancel();
    _sseClient?.close();
    _sseSubscription = null;
    _sseClient = null;
    stopPolling();
    _wsCompleter = null;
    _sseCompleter = null;
  }
}
