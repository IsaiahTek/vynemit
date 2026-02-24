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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addNotification = addNotification;
var store_1 = require("./store");
// ============================================================================
// REAL-TIME HANDLERS
// ============================================================================
function addNotification(notification) {
    var snapshot = store_1.notificationStore.snapshot;
    var state = Array.isArray(snapshot) ? snapshot[0] : snapshot;
    if (!state)
        return;
    var unreadCount = notification.status !== 'read'
        ? state.unreadCount + 1
        : state.unreadCount;
    var nextState = __assign(__assign({}, state), { notifications: __spreadArray([notification], state.notifications, true), unreadCount: unreadCount });
    store_1.notificationStore.update(nextState, "key");
}
// export function handleNotificationEvent(event: NotificationEvent) {
//   switch (event.type) {
//     case 'sent':
//     case 'delivered':
//       addNotification(event.notification);
//       break;
//     case 'read':
//       notificationStore.update((state) => ({
//         ...state,
//         notifications: state.notifications.map(n =>
//           n.id === event.notification.id
//             ? { ...n, status: 'read' as const, readAt: new Date() }
//             : n
//         ),
//         unreadCount: Math.max(0, state.unreadCount - 1)
//       }));
//       break;
//     case 'failed':
//       console.error('Notification failed:', event.notification);
//       break;
//   }
// }
