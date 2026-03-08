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
exports.fetchNotifications = fetchNotifications;
exports.fetchUnreadCount = fetchUnreadCount;
exports.fetchStats = fetchStats;
exports.fetchPreferences = fetchPreferences;
exports.markAsRead = markAsRead;
exports.markAllAsRead = markAllAsRead;
exports.markAsUnread = markAsUnread;
exports.markAllAsUnread = markAllAsUnread;
exports.deleteNotification = deleteNotification;
exports.deleteAll = deleteAll;
exports.updatePreferences = updatePreferences;
var store_1 = require("./store");
var initialize_1 = require("./initialize");
// const apiClient = new let apiClient: NotificationApiClient | null = null;
function fetchNotifications(filters) {
    return __awaiter(this, void 0, void 0, function () {
        var notifications_1, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // console.log("ENTERED FETCHING NOTIFICATIONS...");
                    if (!initialize_1.apiClient)
                        throw new Error('Call initializeNotifications() first');
                    // console.log("FETCHING NOTIFICATIONS WITH FILTERS: ", filters);
                    store_1.notificationStore.update(function (state) { return (__assign(__assign({}, state), { loading: true, error: null })); }, "key");
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, initialize_1.apiClient.getNotifications(filters)];
                case 2:
                    notifications_1 = _a.sent();
                    // console.log("FETCHED NOTIFICATIONS: ", notifications, " CURRENT STATE: ", notificationStore.snapshot);
                    store_1.notificationStore.update(function (state) { return (__assign(__assign({}, state), { notifications: notifications_1, loading: false, lastSync: new Date() })); }, "key");
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    // console.error('Failed to fetch notifications:', error);
                    store_1.notificationStore.update(function (state) { return (__assign(__assign({}, state), { loading: false, error: error_1.message })); }, "key");
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function fetchUnreadCount() {
    return __awaiter(this, void 0, void 0, function () {
        var unreadCount_1, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!initialize_1.apiClient)
                        return [2 /*return*/];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, initialize_1.apiClient.getUnreadCount()];
                case 2:
                    unreadCount_1 = _a.sent();
                    // console.log("GOT UNREAD COUNT IN FETCH: ", unreadCount);
                    store_1.notificationStore.update(function (state) { return (__assign(__assign({}, state), { unreadCount: unreadCount_1 })); }, "key");
                    return [3 /*break*/, 4];
                case 3:
                    error_2 = _a.sent();
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function fetchStats() {
    return __awaiter(this, void 0, void 0, function () {
        var stats_1, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!initialize_1.apiClient)
                        return [2 /*return*/];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, initialize_1.apiClient.getStats()];
                case 2:
                    stats_1 = _a.sent();
                    store_1.notificationStore.update(function (state) { return (__assign(__assign({}, state), { stats: stats_1 })); }, "key");
                    return [3 /*break*/, 4];
                case 3:
                    error_3 = _a.sent();
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function fetchPreferences() {
    return __awaiter(this, void 0, void 0, function () {
        var preferences_1, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!initialize_1.apiClient)
                        return [2 /*return*/];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, initialize_1.apiClient.getPreferences()];
                case 2:
                    preferences_1 = _a.sent();
                    store_1.notificationStore.update(function (state) { return (__assign(__assign({}, state), { preferences: preferences_1 })); }, "key");
                    return [3 /*break*/, 4];
                case 3:
                    error_4 = _a.sent();
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function markAsRead(notificationId) {
    return __awaiter(this, void 0, void 0, function () {
        var error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!initialize_1.apiClient)
                        return [2 /*return*/];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, initialize_1.apiClient.markAsRead(notificationId)];
                case 2:
                    _a.sent();
                    store_1.notificationStore.update(function (state) { return (__assign(__assign({}, state), { notifications: state.notifications.map(function (n) {
                            return n.id === notificationId
                                ? __assign(__assign({}, n), { status: 'read', readAt: new Date() }) : n;
                        }) })); }, "key");
                    return [4 /*yield*/, fetchUnreadCount()];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    error_5 = _a.sent();
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
}
function markAllAsRead() {
    return __awaiter(this, void 0, void 0, function () {
        var error_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!initialize_1.apiClient)
                        return [2 /*return*/];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, initialize_1.apiClient.markAllAsRead()];
                case 2:
                    _a.sent();
                    store_1.notificationStore.update(function (state) { return (__assign(__assign({}, state), { notifications: state.notifications.map(function (n) { return (__assign(__assign({}, n), { status: 'read', readAt: new Date() })); }), unreadCount: 0 })); }, "key");
                    return [3 /*break*/, 4];
                case 3:
                    error_6 = _a.sent();
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function markAsUnread(notificationId) {
    return __awaiter(this, void 0, void 0, function () {
        var error_7;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!initialize_1.apiClient)
                        return [2 /*return*/];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, initialize_1.apiClient.markAsUnread(notificationId)];
                case 2:
                    _a.sent();
                    store_1.notificationStore.update(function (state) { return (__assign(__assign({}, state), { notifications: state.notifications.map(function (n) {
                            return n.id === notificationId
                                ? __assign(__assign({}, n), { status: 'delivered', readAt: undefined }) : n;
                        }) })); }, "key");
                    return [4 /*yield*/, fetchUnreadCount()];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    error_7 = _a.sent();
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
}
function markAllAsUnread() {
    return __awaiter(this, void 0, void 0, function () {
        var error_8;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!initialize_1.apiClient)
                        return [2 /*return*/];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, initialize_1.apiClient.markAllAsUnread()];
                case 2:
                    _a.sent();
                    store_1.notificationStore.update(function (state) { return (__assign(__assign({}, state), { notifications: state.notifications.map(function (n) { return (__assign(__assign({}, n), { status: 'delivered', readAt: undefined })); }), unreadCount: state.notifications.length })); }, "key");
                    return [3 /*break*/, 4];
                case 3:
                    error_8 = _a.sent();
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function deleteNotification(notificationId) {
    return __awaiter(this, void 0, void 0, function () {
        var error_9;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!initialize_1.apiClient)
                        return [2 /*return*/];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, initialize_1.apiClient.deleteNotification(notificationId)];
                case 2:
                    _a.sent();
                    store_1.notificationStore.update(function (state) { return (__assign(__assign({}, state), { notifications: state.notifications.filter(function (n) { return n.id !== notificationId; }) })); }, "key");
                    return [4 /*yield*/, fetchUnreadCount()];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    error_9 = _a.sent();
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
}
function deleteAll() {
    return __awaiter(this, void 0, void 0, function () {
        var error_10;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!initialize_1.apiClient)
                        return [2 /*return*/];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, initialize_1.apiClient.deleteAll()];
                case 2:
                    _a.sent();
                    store_1.notificationStore.update(function (state) { return (__assign(__assign({}, state), { notifications: [], unreadCount: 0 })); }, "key");
                    return [3 /*break*/, 4];
                case 3:
                    error_10 = _a.sent();
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function updatePreferences(prefs) {
    return __awaiter(this, void 0, void 0, function () {
        var error_11;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!initialize_1.apiClient)
                        return [2 /*return*/];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, initialize_1.apiClient.updatePreferences(prefs)];
                case 2:
                    _a.sent();
                    store_1.notificationStore.update(function (state) { return (__assign(__assign({}, state), { preferences: state.preferences ? __assign(__assign({}, state.preferences), prefs) : null })); }, "key");
                    return [3 /*break*/, 4];
                case 3:
                    error_11 = _a.sent();
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
