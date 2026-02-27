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
        this.config = config;
    }
    /* ============================================================
       HTTP REQUESTS
    ============================================================ */
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
    /* ============================================================
       DATE PARSER
    ============================================================ */
    NotificationApiClient.prototype.parseNotificationDates = function (notification) {
        return __assign(__assign({}, notification), { createdAt: notification.createdAt ? new Date(notification.createdAt) : new Date(), readAt: notification.readAt ? new Date(notification.readAt) : undefined, scheduledFor: notification.scheduledFor ? new Date(notification.scheduledFor) : undefined, expiresAt: notification.expiresAt ? new Date(notification.expiresAt) : undefined });
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
    /* ============================================================
       REALTIME CONNECTOR
    ============================================================ */
    NotificationApiClient.prototype.connectRealtime = function (onMessage) {
        return __awaiter(this, void 0, void 0, function () {
            var wsConnected, sseConnected;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.disconnectRealtime();
                        return [4 /*yield*/, this.connectWebSocket(onMessage)];
                    case 1:
                        wsConnected = _a.sent();
                        if (wsConnected)
                            return [2 /*return*/, true];
                        return [4 /*yield*/, this.connectSSE(onMessage)];
                    case 2:
                        sseConnected = _a.sent();
                        if (sseConnected)
                            return [2 /*return*/, true];
                        return [2 /*return*/, false];
                }
            });
        });
    };
    /* ============================================================
       WEBSOCKET
    ============================================================ */
    NotificationApiClient.prototype.connectWebSocket = function (onMessage) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                if (this.wsPromise)
                    return [2 /*return*/, this.wsPromise];
                if (this.ws) {
                    this.ws.close();
                    this.ws = undefined;
                }
                this.wsPromise = new Promise(function (resolve) { return __awaiter(_this, void 0, void 0, function () {
                    var settled, settle, base, token, _a, wsUrl, _b;
                    var _this = this;
                    var _c;
                    return __generator(this, function (_d) {
                        switch (_d.label) {
                            case 0:
                                settled = false;
                                settle = function (value) {
                                    if (settled)
                                        return;
                                    settled = true;
                                    _this.wsPromise = undefined;
                                    resolve(value);
                                };
                                _d.label = 1;
                            case 1:
                                _d.trys.push([1, 5, , 6]);
                                base = (_c = this.config.wsUrl) !== null && _c !== void 0 ? _c : this.config.apiUrl;
                                if (!this.config.getAuthToken) return [3 /*break*/, 3];
                                return [4 /*yield*/, this.config.getAuthToken()];
                            case 2:
                                _a = _d.sent();
                                return [3 /*break*/, 4];
                            case 3:
                                _a = null;
                                _d.label = 4;
                            case 4:
                                token = _a;
                                wsUrl = new URL(base.replace(/^http/, 'ws'));
                                wsUrl.searchParams.set('userId', this.config.userId);
                                if (token)
                                    wsUrl.searchParams.set('token', token);
                                this.ws = new WebSocket(wsUrl.toString());
                                this.ws.onopen = function () { return settle(true); };
                                this.ws.onmessage = function (event) {
                                    try {
                                        onMessage(JSON.parse(event.data));
                                    }
                                    catch (_a) {
                                        onMessage(event.data);
                                    }
                                };
                                this.ws.onerror = function () {
                                    if (!settled)
                                        settle(false);
                                };
                                this.ws.onclose = function () { };
                                return [3 /*break*/, 6];
                            case 5:
                                _b = _d.sent();
                                settle(false);
                                return [3 /*break*/, 6];
                            case 6: return [2 /*return*/];
                        }
                    });
                }); });
                return [2 /*return*/, this.wsPromise];
            });
        });
    };
    /* ============================================================
       SERVER-SENT EVENTS
    ============================================================ */
    NotificationApiClient.prototype.connectSSE = function (onMessage) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                if (typeof EventSource === 'undefined')
                    return [2 /*return*/, false];
                if (this.ssePromise)
                    return [2 /*return*/, this.ssePromise];
                if (this.sse) {
                    this.sse.close();
                    this.sse = undefined;
                }
                this.ssePromise = new Promise(function (resolve) { return __awaiter(_this, void 0, void 0, function () {
                    var settled, opened, timeoutMs, settle, base, path, url, token, _a, timeout;
                    var _this = this;
                    var _b, _c, _d, _e;
                    return __generator(this, function (_f) {
                        switch (_f.label) {
                            case 0:
                                settled = false;
                                opened = false;
                                timeoutMs = (_b = this.config.sseConnectTimeoutMs) !== null && _b !== void 0 ? _b : 5000;
                                settle = function (value) {
                                    if (settled)
                                        return;
                                    settled = true;
                                    _this.ssePromise = undefined;
                                    resolve(value);
                                };
                                base = ((_c = this.config.sseUrl) !== null && _c !== void 0 ? _c : this.config.apiUrl).replace(/\/+$/, '');
                                path = ((_d = this.config.ssePath) !== null && _d !== void 0 ? _d : '/notifications/:userId/stream')
                                    .replace(':userId', encodeURIComponent(this.config.userId));
                                url = new URL("".concat(base).concat(path));
                                if (!this.config.getAuthToken) return [3 /*break*/, 2];
                                return [4 /*yield*/, this.config.getAuthToken()];
                            case 1:
                                _a = _f.sent();
                                return [3 /*break*/, 3];
                            case 2:
                                _a = null;
                                _f.label = 3;
                            case 3:
                                token = _a;
                                if (token) {
                                    url.searchParams.set((_e = this.config.sseAuthQueryParam) !== null && _e !== void 0 ? _e : 'token', token);
                                }
                                this.sse = new EventSource(url.toString(), {
                                    withCredentials: true
                                });
                                timeout = setTimeout(function () {
                                    var _a;
                                    if (!opened) {
                                        (_a = _this.sse) === null || _a === void 0 ? void 0 : _a.close();
                                        _this.sse = undefined;
                                        settle(false);
                                    }
                                }, timeoutMs);
                                this.sse.onopen = function () {
                                    clearTimeout(timeout);
                                    opened = true;
                                    settle(true);
                                };
                                this.sse.onmessage = function (event) {
                                    try {
                                        onMessage(JSON.parse(event.data), true);
                                    }
                                    catch (_a) {
                                        onMessage(event.data, true);
                                    }
                                };
                                this.sse.onerror = function () {
                                    var _a;
                                    if (!opened) {
                                        clearTimeout(timeout);
                                        (_a = _this.sse) === null || _a === void 0 ? void 0 : _a.close();
                                        _this.sse = undefined;
                                        settle(false);
                                    }
                                };
                                return [2 /*return*/];
                        }
                    });
                }); });
                return [2 /*return*/, this.ssePromise];
            });
        });
    };
    /* ============================================================
       POLLING
    ============================================================ */
    NotificationApiClient.prototype.startPolling = function (callback) {
        var _this = this;
        if (!this.config.pollInterval)
            return;
        // Prevent duplicate polling loops
        if (this.pollingIntervalId) {
            clearInterval(this.pollingIntervalId);
        }
        this.pollingIntervalId = setInterval(function () { return __awaiter(_this, void 0, void 0, function () {
            var err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, callback()];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        err_1 = _a.sent();
                        console.error('[notifyc] Polling error:', err_1);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); }, this.config.pollInterval);
    };
    NotificationApiClient.prototype.stopPolling = function () {
        if (this.pollingIntervalId) {
            clearInterval(this.pollingIntervalId);
            this.pollingIntervalId = undefined;
        }
    };
    /* ============================================================
       CLEANUP
    ============================================================ */
    NotificationApiClient.prototype.disconnectRealtime = function () {
        if (this.sse) {
            this.sse.close();
            this.sse = undefined;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = undefined;
        }
        this.stopPolling();
        this.wsPromise = undefined;
        this.ssePromise = undefined;
    };
    return NotificationApiClient;
}());
exports.NotificationApiClient = NotificationApiClient;
