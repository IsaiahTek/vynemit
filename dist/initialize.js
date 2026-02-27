"use strict";
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
exports.apiClient = void 0;
exports.initializeNotifications = initializeNotifications;
exports.disconnectNotifications = disconnectNotifications;
var actions_1 = require("./actions");
var api_client_1 = require("./api_client");
var handlers_1 = require("./handlers");
var store_1 = require("./store");
// ============================================================================
// INITIALIZATION (Call once in your app)
// ============================================================================
exports.apiClient = null;
function initializeNotifications(config, onInitialized) {
    var _this = this;
    exports.apiClient = new api_client_1.NotificationApiClient(config);
    var getState = function () {
        var snapshot = store_1.notificationStore.snapshot;
        return Array.isArray(snapshot) ? snapshot[0] : snapshot;
    };
    var emitDebug = function (source, event, level, details) {
        var _a;
        if (level === void 0) { level = 'info'; }
        var payload = __assign({ source: source, event: event, level: level, timestamp: new Date().toISOString() }, (details ? { details: details } : {}));
        if (config.debug) {
            var method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
            console[method]('[notifyc-react]', payload);
        }
        (_a = config.onDebugEvent) === null || _a === void 0 ? void 0 : _a.call(config, payload);
    };
    var updateRealtime = function (transport, status, event, error) {
        if (error === void 0) { error = null; }
        var state = getState();
        var realtime = {
            transport: transport,
            status: status,
            lastEvent: event,
            lastError: error,
            updatedAt: new Date(),
        };
        store_1.notificationStore.update(__assign(__assign({}, state), { realtime: realtime }), "key");
    };
    var onMessage = function (data, isSSE) {
        if (isSSE === void 0) { isSSE = false; }
        console.log("GOT NEW \"".concat(data.type, "\" NOTIFICATION: "), data);
        if (data.type === 'notification') {
            (0, handlers_1.addNotification)(isSSE ? data.data : data.notification);
        }
        else if (data.type === 'unread-count') {
            var state = getState();
            store_1.notificationStore.update(__assign(__assign({}, state), { unreadCount: isSSE ? data.data : data.count }), "key");
        }
        else if (data.type === 'initial-data') {
            var state = getState();
            store_1.notificationStore.update(__assign(__assign({}, state), { notifications: isSSE ? data.data.notifications : data.notifications, unreadCount: isSSE ? data.data.unreadCount : data.unreadCount, isConnected: true }), "key");
        }
    };
    var connectRealtime = function () { return __awaiter(_this, void 0, void 0, function () {
        var preferredTransport, connected, connectedTransport, error_1, state, state;
        var _this = this;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    preferredTransport = (_a = config.realtimeTransport) !== null && _a !== void 0 ? _a : 'sse';
                    connected = false;
                    connectedTransport = null;
                    updateRealtime(preferredTransport, 'connecting', 'connect-start');
                    emitDebug('initialize', 'connect-start', 'info', { preferredTransport: preferredTransport });
                    if (!(preferredTransport === 'sse')) return [3 /*break*/, 4];
                    return [4 /*yield*/, exports.apiClient.connectSSE(onMessage)];
                case 1:
                    connected = _b.sent();
                    if (connected)
                        connectedTransport = 'sse';
                    if (!(!connected && config.wsUrl)) return [3 /*break*/, 3];
                    updateRealtime('websocket', 'fallback', 'fallback-to-websocket');
                    emitDebug('initialize', 'fallback-to-websocket', 'warn');
                    return [4 /*yield*/, exports.apiClient.connectWebSocket(onMessage)];
                case 2:
                    connected = _b.sent();
                    if (connected)
                        connectedTransport = 'websocket';
                    _b.label = 3;
                case 3: return [3 /*break*/, 11];
                case 4:
                    if (!(preferredTransport === 'websocket')) return [3 /*break*/, 10];
                    return [4 /*yield*/, exports.apiClient.connectWebSocket(onMessage)];
                case 5:
                    connected = _b.sent();
                    if (connected)
                        connectedTransport = 'websocket';
                    if (!!connected) return [3 /*break*/, 9];
                    _b.label = 6;
                case 6:
                    _b.trys.push([6, 8, , 9]);
                    updateRealtime('sse', 'fallback', 'fallback-to-sse');
                    emitDebug('initialize', 'fallback-to-sse', 'warn');
                    return [4 /*yield*/, exports.apiClient.connectSSE(onMessage)];
                case 7:
                    connected = _b.sent();
                    if (connected)
                        connectedTransport = 'sse';
                    return [3 /*break*/, 9];
                case 8:
                    error_1 = _b.sent();
                    return [3 /*break*/, 9];
                case 9: return [3 /*break*/, 11];
                case 10:
                    if (preferredTransport === 'polling') {
                        connected = false;
                        connectedTransport = 'polling';
                    }
                    else if (preferredTransport === 'none') {
                        connected = false;
                        connectedTransport = 'none';
                    }
                    _b.label = 11;
                case 11:
                    if (!connected && preferredTransport !== 'none' && config.pollInterval) {
                        exports.apiClient.startPolling(function () { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, (0, actions_1.fetchNotifications)()];
                                    case 1:
                                        _a.sent();
                                        return [4 /*yield*/, (0, actions_1.fetchUnreadCount)()];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); });
                        connected = true;
                        connectedTransport = 'polling';
                        updateRealtime('polling', 'fallback', 'fallback-to-polling');
                        emitDebug('initialize', 'fallback-to-polling', 'warn');
                    }
                    if (connected) {
                        state = getState();
                        store_1.notificationStore.update(__assign(__assign({}, state), { isConnected: true }), "key");
                        updateRealtime(connectedTransport, 'connected', 'connected');
                        emitDebug('initialize', 'connected', 'info', { transport: connectedTransport });
                    }
                    else if (preferredTransport === 'none') {
                        updateRealtime('none', 'idle', 'realtime-disabled');
                        emitDebug('initialize', 'realtime-disabled');
                    }
                    else {
                        state = getState();
                        store_1.notificationStore.update(__assign(__assign({}, state), { isConnected: false }), "key");
                        updateRealtime(connectedTransport !== null && connectedTransport !== void 0 ? connectedTransport : preferredTransport, 'error', 'connect-failed', 'No realtime transport available');
                        emitDebug('initialize', 'connect-failed', 'error');
                    }
                    return [2 /*return*/];
            }
        });
    }); };
    void connectRealtime();
    console.log("ABOUT TO CALL NOTIFICATION ACTIONS");
    // Initial fetch
    (0, actions_1.fetchNotifications)();
    (0, actions_1.fetchUnreadCount)();
    (0, actions_1.fetchPreferences)();
    // Call onInitialized callback
    onInitialized && onInitialized();
}
function disconnectNotifications() {
    if (exports.apiClient) {
        exports.apiClient.disconnectRealtime();
        var snapshot = store_1.notificationStore.snapshot;
        var state = Array.isArray(snapshot) ? snapshot[0] : snapshot;
        store_1.notificationStore.update(__assign(__assign({}, state), { isConnected: false, realtime: __assign(__assign({}, state.realtime), { status: 'idle', lastEvent: 'disconnected', updatedAt: new Date() }) }), "key");
    }
}
