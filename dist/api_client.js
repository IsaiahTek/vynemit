"use strict";
// ============================================================================
// API CLIENT
// ============================================================================
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationApiClient = void 0;
var NotificationApiClient = /** @class */ (function () {
    function NotificationApiClient(config) {
        var _this = this;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.handleSSEMessage = function (eventType, onMessage) { return function (event) {
            var _a;
            var parsedData = event.data;
            if (typeof event.data === 'string') {
                try {
                    parsedData = JSON.parse(event.data);
                }
                catch (_b) {
                    parsedData = { data: event.data };
                }
            }
            var normalized = parsedData && typeof parsedData === 'object'
                ? __assign(__assign({}, parsedData), { type: (_a = parsedData.type) !== null && _a !== void 0 ? _a : eventType }) : { type: eventType, data: parsedData };
            _this.handleMessage(normalized, onMessage);
        }; };
        // Helper function to process messages (optional, based on your original logic)
        this.handleMessage = function (data, onMessage) {
            if (data.notification) {
                data.notification = _this.parseNotificationDates(data.notification);
            }
            if (Array.isArray(data.notifications)) {
                data.notifications = data.notifications.map(function (notification) { return _this.parseNotificationDates(notification); });
            }
            onMessage(data);
        };
        this.config = config;
    }
    NotificationApiClient.prototype.emitDebug = function (source, event, level, details) {
        var _a, _b;
        if (level === void 0) { level = 'info'; }
        var payload = __assign({ source: source, event: event, level: level, timestamp: new Date().toISOString() }, (details ? { details: details } : {}));
        if (this.config.debug) {
            var method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
            console[method]('[notifyc-react]', payload);
        }
        (_b = (_a = this.config).onDebugEvent) === null || _b === void 0 ? void 0 : _b.call(_a, payload);
    };
    NotificationApiClient.prototype.request = function (endpoint_1) {
        return __awaiter(this, arguments, void 0, function (endpoint, options) {
            var token, _a, response;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!this.config.getAuthToken) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.config.getAuthToken()];
                    case 1:
                        _a = _b.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        _a = null;
                        _b.label = 3;
                    case 3:
                        token = _a;
                        return [4 /*yield*/, fetch("".concat(this.config.apiUrl).concat(endpoint), __assign(__assign({}, options), { credentials: 'include', headers: __assign(__assign({ 'Content-Type': 'application/json' }, (token && { Authorization: "Bearer ".concat(token) })), options.headers) }))];
                    case 4:
                        response = _b.sent();
                        if (!response.ok) {
                            throw new Error("API Error: ".concat(response.statusText));
                        }
                        return [2 /*return*/, response.json()];
                }
            });
        });
    };
    NotificationApiClient.prototype.getNotifications = function (filters) {
        return __awaiter(this, void 0, void 0, function () {
            var params, query, rawNotifications, notifications;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        params = new URLSearchParams();
                        if (filters === null || filters === void 0 ? void 0 : filters.status) {
                            params.append('status', Array.isArray(filters.status) ? filters.status.join(',') : filters.status);
                        }
                        if (filters === null || filters === void 0 ? void 0 : filters.type) {
                            params.append('type', Array.isArray(filters.type) ? filters.type.join(',') : filters.type);
                        }
                        if (filters === null || filters === void 0 ? void 0 : filters.limit)
                            params.append('limit', filters.limit.toString());
                        if (filters === null || filters === void 0 ? void 0 : filters.offset)
                            params.append('offset', filters.offset.toString());
                        query = params.toString() ? "?".concat(params.toString()) : '';
                        return [4 /*yield*/, this.request("/notifications/".concat(this.config.userId).concat(query))];
                    case 1:
                        rawNotifications = _a.sent();
                        notifications = this.config.dataLocator ? this.config.dataLocator(rawNotifications) : rawNotifications;
                        // Parse date strings to Date objects
                        return [2 /*return*/, Array.isArray(notifications) ? notifications.map(this.parseNotificationDates) : [this.parseNotificationDates(notifications)]];
                }
            });
        });
    };
    NotificationApiClient.prototype.getUnreadCount = function () {
        return __awaiter(this, void 0, void 0, function () {
            var rawResult, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.request("/notifications/".concat(this.config.userId, "/unread-count"))];
                    case 1:
                        rawResult = _a.sent();
                        result = this.config.dataLocator ? this.config.dataLocator(rawResult) : rawResult;
                        console.log("GOT UNREAD COUNT IN API: ", result.count, result);
                        return [2 /*return*/, result.count];
                }
            });
        });
    };
    NotificationApiClient.prototype.getStats = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.request("/notifications/".concat(this.config.userId, "/stats"))];
            });
        });
    };
    NotificationApiClient.prototype.getPreferences = function () {
        return __awaiter(this, void 0, void 0, function () {
            var prefs;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.request("/notifications/".concat(this.config.userId, "/preferences"))];
                    case 1:
                        prefs = _a.sent();
                        return [2 /*return*/, prefs];
                }
            });
        });
    };
    NotificationApiClient.prototype.markAsRead = function (notificationId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.request("/notifications/".concat(this.config.userId, "/").concat(notificationId, "/read"), { method: 'POST' })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    NotificationApiClient.prototype.markAllAsRead = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.request("/notifications/".concat(this.config.userId, "/read-all"), { method: 'POST' })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    NotificationApiClient.prototype.deleteNotification = function (notificationId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.request("/notifications/".concat(this.config.userId, "/").concat(notificationId), { method: 'DELETE' })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    NotificationApiClient.prototype.deleteAll = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.request("/notifications/".concat(this.config.userId, "/all"), { method: 'DELETE' })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    NotificationApiClient.prototype.updatePreferences = function (prefs) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.request("/notifications/".concat(this.config.userId, "/preferences"), {
                            method: 'PUT',
                            body: JSON.stringify(prefs)
                        })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    NotificationApiClient.prototype.connectSSE = function (onMessage) {
        return __awaiter(this, void 0, void 0, function () {
            var base, configuredPath, normalizedPath, resolvedPath, streamUrl, token, _a;
            var _this = this;
            var _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        if (typeof EventSource === 'undefined')
                            return [2 /*return*/, false];
                        base = ((_b = this.config.sseUrl) !== null && _b !== void 0 ? _b : this.config.apiUrl).replace(/\/+$/, '');
                        configuredPath = (_c = this.config.ssePath) !== null && _c !== void 0 ? _c : '/notifications/:userId/stream';
                        normalizedPath = configuredPath.startsWith('/') ? configuredPath : "/".concat(configuredPath);
                        resolvedPath = normalizedPath.replace(':userId', encodeURIComponent(this.config.userId));
                        streamUrl = new URL("".concat(base).concat(resolvedPath));
                        if (!this.config.getAuthToken) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.config.getAuthToken()];
                    case 1:
                        _a = _e.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        _a = null;
                        _e.label = 3;
                    case 3:
                        token = _a;
                        if (token) {
                            streamUrl.searchParams.set((_d = this.config.sseAuthQueryParam) !== null && _d !== void 0 ? _d : 'token', token);
                        }
                        this.emitDebug('sse', 'connect-attempt', 'info', { url: streamUrl.origin + streamUrl.pathname });
                        return [2 /*return*/, new Promise(function (resolve) {
                                var _a;
                                var settled = false;
                                var opened = false;
                                var connectTimeoutMs = (_a = _this.config.sseConnectTimeoutMs) !== null && _a !== void 0 ? _a : 5000;
                                var settle = function (value) {
                                    if (settled)
                                        return;
                                    settled = true;
                                    resolve(value);
                                };
                                _this.sse = new EventSource(streamUrl.toString(), { withCredentials: true });
                                _this.sse.addEventListener('initial-data', _this.handleSSEMessage('initial-data', onMessage));
                                _this.sse.addEventListener('notification', _this.handleSSEMessage('notification', onMessage));
                                _this.sse.addEventListener('unread-count', _this.handleSSEMessage('unread-count', onMessage));
                                var timeout = setTimeout(function () {
                                    var _a;
                                    if (!opened) {
                                        (_a = _this.sse) === null || _a === void 0 ? void 0 : _a.close();
                                        _this.sse = undefined;
                                        settle(false);
                                    }
                                }, connectTimeoutMs);
                                _this.sse.onopen = function () {
                                    clearTimeout(timeout);
                                    opened = true;
                                    _this.reconnectAttempts = 0;
                                    console.log('🔌 SSE connected');
                                    _this.emitDebug('sse', 'connected');
                                    settle(true);
                                };
                                _this.sse.onerror = function (error) {
                                    var _a;
                                    console.error('❌ SSE error:', error);
                                    _this.emitDebug('sse', 'error', 'error', { opened: opened });
                                    if (!opened) {
                                        clearTimeout(timeout);
                                        (_a = _this.sse) === null || _a === void 0 ? void 0 : _a.close();
                                        _this.sse = undefined;
                                        settle(false);
                                    }
                                };
                            })];
                }
            });
        });
    };
    NotificationApiClient.prototype.connectWebSocket = function (onMessage) {
        return __awaiter(this, void 0, void 0, function () {
            var io_1, token_1, _a, error_1;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!this.config.wsUrl)
                            return [2 /*return*/, false];
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 6, , 7]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('socket.io-client'); })];
                    case 2:
                        io_1 = (_b.sent()).io;
                        if (!this.config.getAuthToken) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.config.getAuthToken()];
                    case 3:
                        _a = _b.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        _a = null;
                        _b.label = 5;
                    case 5:
                        token_1 = _a;
                        this.emitDebug('websocket', 'connect-attempt', 'info', {
                            url: this.config.wsUrl
                        });
                        console.log("ABOUT TO CONNECT TO WEBSOCKET");
                        return [2 /*return*/, new Promise(function (resolve) {
                                var settled = false;
                                var settle = function (value) {
                                    if (settled)
                                        return;
                                    settled = true;
                                    resolve(value);
                                };
                                _this.ws = io_1(_this.config.wsUrl, __assign(__assign({ query: { userId: _this.config.userId } }, (token_1 && { auth: { token: token_1 } })), { withCredentials: true, transports: ['websocket', 'polling'], reconnectionAttempts: _this.maxReconnectAttempts, timeout: 5000 }));
                                _this.ws.on('connect', function () {
                                    console.log('🔌 WebSocket connected');
                                    _this.emitDebug('websocket', 'connected');
                                    _this.reconnectAttempts = 0;
                                    settle(true);
                                });
                                _this.ws.on('connect_error', function (err) {
                                    console.error('❌ connect_error:', err.message);
                                    _this.emitDebug('websocket', 'connect-error', 'error', {
                                        message: err.message
                                    });
                                    settle(false);
                                });
                                _this.ws.on('disconnect', function (reason) {
                                    console.log('🔌 Socket.IO disconnected:', reason);
                                    _this.emitDebug('websocket', 'disconnected', 'warn', { reason: reason });
                                });
                                _this.ws.on('initial-data', function (data) { return _this.handleMessage(data, onMessage); });
                                _this.ws.on('notification', function (data) { return _this.handleMessage(data, onMessage); });
                                _this.ws.on('unread-count', function (data) { return _this.handleMessage(data, onMessage); });
                            })];
                    case 6:
                        error_1 = _b.sent();
                        console.error('Failed to initialize socket.io-client:', error_1);
                        this.emitDebug('websocket', 'connect-failed', 'error');
                        return [2 /*return*/, false];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    NotificationApiClient.prototype.disconnectWebSocket = function () {
        if (this.sse) {
            this.sse.close();
            this.sse = undefined;
            this.emitDebug('sse', 'closed', 'warn');
        }
        if (this.ws) {
            this.ws.close();
            this.ws = undefined;
            this.emitDebug('websocket', 'closed', 'warn');
        }
    };
    NotificationApiClient.prototype.startPolling = function (onPoll) {
        var _this = this;
        if (!this.config.pollInterval)
            return;
        this.emitDebug('polling', 'started', 'info', { intervalMs: this.config.pollInterval });
        this.pollInterval = setInterval(function () { return __awaiter(_this, void 0, void 0, function () {
            var error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, onPoll()];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        error_2 = _a.sent();
                        console.error('Polling error:', error_2);
                        this.emitDebug('polling', 'error', 'error');
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); }, this.config.pollInterval);
    };
    NotificationApiClient.prototype.stopPolling = function () {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = undefined;
            this.emitDebug('polling', 'stopped', 'warn');
        }
    };
    NotificationApiClient.prototype.parseNotificationDates = function (notification) {
        return __assign(__assign({}, notification), { createdAt: notification.createdAt ? new Date(notification.createdAt) : new Date(), readAt: notification.readAt ? new Date(notification.readAt) : undefined, scheduledFor: notification.scheduledFor ? new Date(notification.scheduledFor) : undefined, expiresAt: notification.expiresAt ? new Date(notification.expiresAt) : undefined });
    };
    return NotificationApiClient;
}());
exports.NotificationApiClient = NotificationApiClient;
