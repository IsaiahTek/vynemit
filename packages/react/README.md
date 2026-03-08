# notifyc-react - Provider-less Usage Guide

Complete guide for using Synq Notifications in React with **react-synq-store** (NO PROVIDER NEEDED!)

## 🚀 The Magic: No Provider Required!

Unlike traditional React state management, `react-synq-store` doesn't require wrapping your app in a provider. Just initialize once and use anywhere! Perfect for:

- ✅ **Global Toast Notifications**
- ✅ **Web (System Tray) Notifications**
- ✅ **Notification Badges** (in headers, sidebars, anywhere)
- ✅ **Notification Centers** (dropdowns, panels)
- ✅ **Cross-App State** (shared across different parts of your app)

## 📦 Installation

```bash
npm install notifyc-react react-synq-store @synq/notifications-core
```

## 🎯 Quick Start (3 Steps)

### Step 1: Initialize Once

Call `initializeNotifications()` once in your app entry point:

```tsx
// app/layout.tsx (Next.js App Router)
// or _app.tsx (Next.js Pages Router)
// or main.tsx (Vite/CRA)

import { initializeNotifications } from 'notifyc-react';

// Initialize on client side
if (typeof window !== 'undefined') {
  initializeNotifications({
    config: {
      apiUrl: 'http://localhost:3000',
      userId: 'user:123',
      realtimeTransport: 'sse', // Default
      ssePath: '/notifications/:userId/stream', // Optional
      wsUrl: 'http://localhost:3000/notifications', // Optional fallback/override
      pollInterval: 5000, // Final fallback
      getAuthToken: async () => localStorage.getItem('token')
    },
    onInitialized: () => console.log('Initialized'),
    onConnected: () => console.log('Connected to realtime'),
    onNotification: (notification) => {
      // Optional: trigger global toast
      console.log('Received notification:', notification);
    }
  });
}

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        {/* No provider needed! */}
      </body>
    </html>
  );
}
```
### Step 2: Use Anywhere

**In your header:**
```tsx
import { useUnreadCount } from 'notifyc-react';

function Header() {
  const unreadCount = useUnreadCount(); // ✨ Works without provider!
  
  return (
    <header>
      <nav>
        <button>
          🔔
          {unreadCount > 0 && <Badge>{unreadCount}</Badge>}
        </button>
      </nav>
    </header>
  );
}
```

**In your sidebar:**
```tsx
import { useNotifications } from 'notifyc-react';

function Sidebar() {
  const { notifications } = useNotifications({ status: 'unread' });
  
  return (
    <aside>
      <h3>Recent ({notifications.length})</h3>
      {notifications.map(n => <NotificationCard key={n.id} {...n} />)}
    </aside>
  );
}
```

**Anywhere else:**
```tsx
import { markAsRead } from 'notifyc-react';

function RandomComponent() {
  return (
    <button onClick={() => markAsRead('notif_123')}>
      Mark as Read
    </button>
  );
}
```

### Step 3: Build Components

All components share the same state automatically!

```tsx
function NotificationCenter() {
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    deleteNotification
  } = useNotifications();

  return (
    <div>
      <h2>Notifications ({unreadCount} unread)</h2>
      {loading && <Spinner />}
      {notifications.map(notif => (
        <div key={notif.id}>
          <h3>{notif.title}</h3>
          <p>{notif.body}</p>
          <button onClick={() => markAsRead(notif.id)}>✓</button>
          <button onClick={() => deleteNotification(notif.id)}>×</button>
        </div>
      ))}
    </div>
  );
}
```

## 📚 API Reference

### Initialization

```typescript
initializeNotifications(options: { 
  config: NotificationConfig,
  onInitialized?: () => void,
  onConnected?: () => void,
  onNotification?: (notification: Notification) => void 
})

interface NotificationConfig {
  // Required
  apiUrl: string;              // Backend API URL
  userId: string;              // Current user ID
  
  // Optional - Real-time
  realtimeTransport?: 'sse' | 'websocket' | 'polling' | 'none'; // Default: 'sse'
  sseUrl?: string;             // Optional SSE base URL (defaults to apiUrl)
  ssePath?: string;            // SSE path template, default '/notifications/:userId/stream'
  sseAuthQueryParam?: string;  // If getAuthToken exists, token query key (default: 'token')
  sseConnectTimeoutMs?: number;// Time to wait before SSE fallback (default: 5000)
  wsUrl?: string;              // WebSocket URL (used when transport is websocket/fallback)
  pollInterval?: number;       // Polling interval (ms) fallback
  debug?: boolean;             // Log structured realtime diagnostics to console
  onDebugEvent?: (event) => void; // Callback for realtime lifecycle events
  
  // Optional - Auth
  getAuthToken?: () => Promise<string | null>;
}
```

### Hooks

#### useNotifications()

Main hook for accessing notifications:

```typescript
const {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  
  // Actions
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  markAsUnread: (id: string) => Promise<void>;
  markAllAsUnread: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  deleteAll: () => Promise<void>;
  refresh: () => Promise<void>;
} = useNotifications(filters?: NotificationFilters);
```

**With filters:**
```tsx
const { notifications } = useNotifications({
  status: 'unread',
  type: 'comment',
  limit: 10
});
```

#### useUnreadCount()

Optimized for badge displays (only re-renders when count changes):

```typescript
const unreadCount: number = useUnreadCount();
```

**Perfect for:**
```tsx
function NotificationBadge() {
  const count = useUnreadCount(); // Only re-renders on count change!
  return count > 0 ? <Badge>{count}</Badge> : null;
}
```

#### useNotificationStats()

Get statistics:

```typescript
const stats: NotificationStats | null = useNotificationStats();

// stats = {
//   total: 50,
//   unread: 5,
//   byStatus: { read: 45, unread: 5, ... },
//   byChannel: { inapp: 30, email: 20 },
//   byPriority: { urgent: 2, high: 10, normal: 35, low: 3 }
// }
```

#### useNotificationPreferences()

Manage user preferences:

```typescript
const {
  preferences: NotificationPreferences | null;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>;
} = useNotificationPreferences();
```

#### useNotificationRealtime()

Inspect transport status and fallback behavior in UI:

```typescript
const realtime = useNotificationRealtime();
// realtime = {
//   transport: 'sse' | 'websocket' | 'polling' | 'none' | null,
//   status: 'idle' | 'connecting' | 'connected' | 'fallback' | 'error',
//   lastEvent: string | null,
//   lastError: string | null,
//   updatedAt: Date | null
// }
```

#### useNotification()

Get single notification by ID:

```typescript
const {
  notification: Notification | undefined;
  markAsRead: () => Promise<void>;
  delete: () => Promise<void>;
} = useNotification(notificationId);
```

### Actions (Can be called anywhere!)

```typescript
import {
  fetchNotifications,
  markAsRead,
  markAllAsRead,
  markAsUnread,
  markAllAsUnread,
  deleteNotification,
  deleteAll,
  updatePreferences
} from 'notifyc-react';

// Call from anywhere - no hooks needed!
await markAsRead('notif_123');
await markAllAsRead();
await markAsUnread('notif_123');
await deleteNotification('notif_456');
```

## 🎨 Real-World Examples

### 1. Global Toast-like Notifications

Following your toast pattern:

```tsx
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <NotificationToastContainer /> {/* No provider! */}
      </body>
    </html>
  );
}

// components/NotificationToastContainer.tsx
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useNotifications } from "notifyc-react";

export default function NotificationToastContainer() {
  const { notifications, markAsRead } = useNotifications({
    status: 'unread',
    priority: 'urgent'
  });

  // Auto-dismiss after 5s
  React.useEffect(() => {
    notifications.forEach(notif => {
      setTimeout(() => markAsRead(notif.id), 5000);
    });
  }, [notifications]);

  return (
    <div className="fixed bottom-4 right-4 space-y-2 z-50">
      <AnimatePresence>
        {notifications.map(notif => (
          <motion.div
            key={notif.id}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className={`rounded-lg shadow-lg p-4 ${
              notif.priority === 'urgent' ? 'bg-red-600' : 'bg-blue-600'
            } text-white`}
          >
            <h3 className="font-bold">{notif.title}</h3>
            <p className="text-sm">{notif.body}</p>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
```

### 2. Notification Dropdown

```tsx
function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const { notifications, markAsRead, markAllAsRead } = useNotifications({
    limit: 10,
    sortBy: 'createdAt'
  });
  const unreadCount = useUnreadCount();

  return (
    <div>
      <button onClick={() => setOpen(!open)}>
        🔔
        {unreadCount > 0 && <Badge>{unreadCount}</Badge>}
      </button>

      {open && (
        <div className="dropdown">
          <div className="header">
            <h3>Notifications</h3>
            <button onClick={markAllAsRead}>Mark all read</button>
          </div>
          
          {notifications.map(notif => (
            <div key={notif.id} onClick={() => markAsRead(notif.id)}>
              <h4>{notif.title}</h4>
              <p>{notif.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### 3. Multi-Location State Sync

The same state works everywhere automatically:

```tsx
// Header.tsx
function Header() {
  const count = useUnreadCount();
  return <Badge>{count}</Badge>; // Shows "5"
}

// Sidebar.tsx
function Sidebar() {
  const { markAsRead } = useNotifications();
  
  const handleClick = () => {
    markAsRead('notif_123');
    // Header badge automatically updates to "4"! ✨
  };
  
  return <button onClick={handleClick}>Mark Read</button>;
}

// NotificationCenter.tsx
function NotificationCenter() {
  const { notifications } = useNotifications();
  // Automatically stays in sync with Header and Sidebar!
  return <List items={notifications} />;
}
```

### 4. Filtered Views

```tsx
function NotificationTabs() {
  const [tab, setTab] = useState('all');
  
  const filters = {
    all: {},
    unread: { status: 'unread' },
    urgent: { priority: 'urgent' },
    social: { category: 'social' }
  };

  const { notifications } = useNotifications(filters[tab]);

  return (
    <div>
      <Tabs value={tab} onChange={setTab} />
      <NotificationList notifications={notifications} />
    </div>
  );
}
```

### 5. Browser Notifications

```tsx
function BrowserNotificationListener() {
  const { notifications } = useNotifications({ status: 'unread' });
  const [lastCount, setLastCount] = useState(0);

  useEffect(() => {
    // Show browser notification for new items
    if (notifications.length > lastCount && 'Notification' in window) {
      const newNotif = notifications[0];
      if (Notification.permission === 'granted') {
        new Notification(newNotif.title, {
          body: newNotif.body,
          icon: '/icon.png'
        });
      }
    }
    setLastCount(notifications.length);
  }, [notifications.length]);

  return null; // Invisible component
}
```

### 6. Custom Notification Sound

```tsx
function NotificationSoundPlayer() {
  const { notifications } = useNotifications();
  const prevCountRef = useRef(0);

  useEffect(() => {
    if (notifications.length > prevCountRef.current) {
      const audio = new Audio('/notification.mp3');
      audio.play();
    }
    prevCountRef.current = notifications.length;
  }, [notifications.length]);

  return null;
}
```

## 🔌 Real-time Updates

### SSE (Default)

```tsx
initializeNotifications({
  config: {
    apiUrl: 'http://localhost:3000',
    userId: 'user:123'
  }
});

// Uses GET /notifications/:userId/stream by default
```

### WebSocket (Optional)

```tsx
initializeNotifications({
  config: {
    apiUrl: 'http://localhost:3000',
    realtimeTransport: 'websocket',
    wsUrl: 'http://localhost:3000/notifications',
    userId: 'user:123'
  }
});

// Components automatically receive real-time updates! ✨
```

**Backend:**
```typescript
import WebSocket from 'ws';

const wss = new WebSocket.Server({ port: 3001 });

wss.on('connection', (ws, req) => {
  const userId = new URL(req.url!, 'ws://localhost').searchParams.get('userId');
  
  const unsubscribe = notificationCenter.subscribe(userId!, (notification) => {
    ws.send(JSON.stringify({
      type: 'notification',
      notification
    }));
  });

  ws.on('close', () => unsubscribe());
});
```

### Polling (Fallback)

```tsx
initializeNotifications({
  config: {
    apiUrl: 'http://localhost:3000',
    realtimeTransport: 'polling',
    userId: 'user:123',
    pollInterval: 5000 // Poll every 5 seconds
  }
});
```

## 🎯 Advanced Patterns

### Grouped Notifications

```tsx
function GroupedNotifications() {
  const { notifications } = useNotifications();

  const grouped = notifications.reduce((acc, notif) => {
    const key = notif.category || 'other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(notif);
    return acc;
  }, {});

  return (
    <div>
      {Object.entries(grouped).map(([category, notifs]) => (
        <div key={category}>
          <h3>{category} ({notifs.length})</h3>
          <NotificationList notifications={notifs} />
        </div>
      ))}
    </div>
  );
}
```

### Infinite Scroll

```tsx
function InfiniteNotificationList() {
  const [page, setPage] = useState(0);
  const { notifications } = useNotifications({
    limit: 20,
    offset: page * 20
  });

  return (
    <InfiniteScroll
      dataLength={notifications.length}
      next={() => setPage(p => p + 1)}
      hasMore={true}
    >
      {notifications.map(n => <NotificationCard key={n.id} {...n} />)}
    </InfiniteScroll>
  );
}
```

### Custom Renderers

```tsx
function SmartNotificationList() {
  const { notifications } = useNotifications();

  const renderNotification = (notif) => {
    switch (notif.type) {
      case 'comment':
        return <CommentNotification {...notif} />;
      case 'like':
        return <LikeNotification {...notif} />;
      case 'security':
        return <SecurityAlert {...notif} />;
      default:
        return <DefaultNotification {...notif} />;
    }
  };

  return (
    <div>
      {notifications.map(notif => (
        <div key={notif.id}>{renderNotification(notif)}</div>
      ))}
    </div>
  );
}
```

## ⚡ Performance Tips

1. **Use Selective Hooks**: `useUnreadCount()` only re-renders on count changes
2. **Filter Early**: Pass filters to hooks instead of filtering in components
3. **Memoize**: Use `React.memo()` for notification cards
4. **Virtualize**: Use `react-window` for long lists
5. **Debounce**: Debounce rapid state updates

## 🆚 Comparison with Context/Redux

### Traditional Approach (Context)
```tsx
// ❌ Need provider
<NotificationProvider>
  <App />
</NotificationProvider>

// ❌ Verbose
const context = useContext(NotificationContext);
const { notifications, markAsRead } = context;
```

### react-synq-store Approach
```tsx
// ✅ No provider needed!
<App />

// ✅ Simple
const { notifications, markAsRead } = useNotifications();
```

## 🧪 Testing

```tsx
import { notificationStore, initializeNotifications } from 'notifyc-react';

beforeEach(() => {
  // Reset store
  notificationStore.reset();
  
  initializeNotifications({
    config: {
      apiUrl: 'http://test',
      userId: 'test-user'
    }
  });
});

test('displays notifications', () => {
  render(<NotificationList />);
  expect(screen.getByText('Test')).toBeInTheDocument();
});
```

## 🎉 That's It!

No providers, no context, no boilerplate. Just initialize once and use anywhere!

**Next Steps:**
- Check out the [full demo](https://github.com/synq/notifications-demo)
- Explore [advanced patterns](https://docs.synq.dev/patterns)
- Join our [Discord community](https://discord.gg/synq)
# notifyc-react
