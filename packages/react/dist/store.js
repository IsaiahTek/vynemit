"use strict";
// ============================================================================
// GLOBAL NOTIFICATION STORE (No Provider Needed!)
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationStore = void 0;
var react_synq_store_1 = require("react-synq-store");
var initialState = {
    notifications: [],
    unreadCount: 0,
    stats: null,
    preferences: null,
    loading: false,
    error: null,
    isConnected: false,
    lastSync: null,
    realtime: {
        transport: null,
        status: 'idle',
        lastEvent: null,
        lastError: null,
        updatedAt: null,
    },
    key: "notifications"
};
// Create global store instance
exports.notificationStore = new react_synq_store_1.Store(initialState);
