import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'models/models.dart';

class RealtimeService {
  final NotificationConfig config;
  final Function(Map<String, dynamic>, {bool isSSE}) onMessage;

  io.Socket? _ws;
  StreamSubscription? _sseSubscription;
  http.Client? _sseClient;
  Timer? _pollingTimer;

  Completer<bool>? _wsCompleter;
  Completer<bool>? _sseCompleter;

  RealtimeService({
    required this.config,
    required this.onMessage,
  });

  Future<bool> connect() async {
    disconnect();

    if (config.realtimeTransport == RealtimeTransport.none) return false;

    if (config.realtimeTransport == RealtimeTransport.sse) {
      final sseConnected = await connectSSE();
      if (sseConnected) return true;

      if (config.wsUrl != null) {
        return connectWebSocket();
      }
    } else if (config.realtimeTransport == RealtimeTransport.websocket) {
      final wsConnected = await connectWebSocket();
      if (wsConnected) return true;

      return connectSSE();
    } else if (config.realtimeTransport == RealtimeTransport.polling) {
      startPolling();
      return true;
    }

    return false;
  }

  Future<bool> connectWebSocket() async {
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
        onMessage(data as Map<String, dynamic>, isSSE: false);
      });

      _ws!.onConnectError((err) {
        if (!completer.isCompleted) completer.complete(false);
        _wsCompleter = null;
      });

    } catch (e) {
      if (!completer.isCompleted) completer.complete(false);
      _wsCompleter = null;
    }

    return completer.future;
  }

  Future<bool> connectSSE() async {
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

      final response = await _sseClient!.send(request);
      
      if (response.statusCode != 200) {
        if (!completer.isCompleted) completer.complete(false);
        _sseCompleter = null;
        return false;
      }

      _sseSubscription = response.stream
          .transform(utf8.decoder)
          .transform(const LineSplitter())
          .listen((line) {
        if (!completer.isCompleted) {
          completer.complete(true);
          _sseCompleter = null;
        }

        if (line.startsWith('data:')) {
          final data = line.substring(5).trim();
          if (data.isNotEmpty) {
            try {
              onMessage(jsonDecode(data), isSSE: true);
            } catch (_) {}
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
