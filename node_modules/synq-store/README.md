# Synq-Store

<p align="center">
<img src="https://raw.githubusercontent.com/IsaiahTek/synq-store/main/images/synq_store_cover.svg" />
</p>

**Sync Store** is a lightweight, hook-based state management library for JavaScript/TypeScript, with powerful, built-in features for **server data synchronization** and **optimistic updates**.

It provides two core store types:

1.  **`Store`**: A minimal, fast, global state container.
2.  **`SynqStore`**: An extended store for managing and synchronizing collections of server-side data (e.g., resources, lists) with automatic fetching, optimistic mutations, and background re-fetching.

---

## 🚀 Features

- **Server Synchronization:** The **`SynqStore`** handles data fetching, caching, and server mutations out of the box.
- **Optimistic Updates:** Experience instant UI updates on `add`, `update`, and `remove` operations, with automatic rollback on failure.
- **Interval Re-fetching:** Keep data fresh with automatic background fetching on a defined interval.
- **Microtask Queuing:** Ensures store initialization happens efficiently without blocking the main thread.
- **Framework Agnostic Core:** The core `Store` class can be used outside of any framework.

---

## 📦 Installation

```bash
# Using npm
npm install synq-store
# Using yarn
yarn add synq-store
```

## 📖 Usage

### Basic Store (Local State)

The `Store` is a lightweight global state container for managing local application state.

```typescript
import { Store } from "synq-store";
import { clearAllStores, emptyStore} from "synq-store/dist/synq";

// Create a store with initial state
const counterStore = new Store({ count: 0, user: null });

// Subscribe to store changes
const unsubscribe = counterStore.subscribe((state) => {
  console.log("State updated:", state);
});

// Update the state
counterStore.setState({ count: counterStore.snapshot.count + 1 });

// Get current state
const currentState = counterStore.snapshot;
console.log(currentState); // { count: 1, user: null }

// Clean up
clearAllStores();         // For clearing all stores including this. Don't use this if you only want to clear this store
emptyStore(counterStore)  // Use for clearing the state of this store only
```

### SynqStore (Server State Synchronization)

The `SynqStore` extends `Store` to manage server-side data with automatic fetching, caching, and optimistic updates.

```typescript
import { SynqStore } from 'synq-store';

// Define your data type
interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

// Create a SynqStore with server sync configuration
const todosStore = new SynqStore<Todo>({[],
  {
    fetcher: async() => await fetch('https://api/example.com/todos'),

    add: async (item: Omit<Todo, 'id'>) => {
      const response = await fetch('https://api.example.com/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });
      return response.json();
    },

    update: async (id: string, updates: Partial<Todo>) => {
      const response = await fetch(`https://api.example.com/todos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      return response.json();
    },

    remove: async (id: string) => {
      await fetch(`https://api.example.com/todos/${id}`, {
        method: 'DELETE'
      });
      return id;
    },
    
    interval: 3000,
    autoFetchOnStart: false,
  }
});
```

### Advanced: Combining Local and Server State

```tsx
import { Store, SynqStore } from "synq-store";

// Local UI state
const uiStore = new Store({
  sidebarOpen: false,
  theme: "light",
  selectedFilter: "all",
});

// Server-synced data
const postsStore = new SynqStore({
  initialState: [],
  idKey: "id",
  fetchFn: async () => {
    const response = await fetch("https://api.example.com/posts");
    return response.json();
  },
  refetchInterval: 60000,
});

function App() {
  // Use both local and server state
  const ui = useStore(uiStore); // use hooks only available in react wrapper.
  const { data: posts, loading } = useServerSyncedStoreWithExtras(postsStore); // Only available in React wrapper. See below how to use with react/next

  // Filter posts based on local UI state
  const filteredPosts = posts.filter((post) => {
    if (ui.selectedFilter === "all") return true;
    return post.category === ui.selectedFilter;
  });

  return (
    <div className={ui.theme}>
      <Sidebar
        open={ui.sidebarOpen}
        onToggle={() =>
          uiStore.setState({
            sidebarOpen: !ui.sidebarOpen,
          })
        }
      />

      <FilterBar
        value={ui.selectedFilter}
        onChange={(filter) =>
          uiStore.setState({
            selectedFilter: filter,
          })
        }
      />

      {loading ? <Spinner /> : <PostList posts={filteredPosts} />}
    </div>
  );
}
```

### TypeScript Support

Synq-Store is fully typed for an excellent TypeScript experience:

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  role: "admin" | "user";
}

// Store is fully typed
const userStore = new Store<User>({
  id: 0,
  name: "",
  email: "",
  role: "user",
});
```

### React/NextJs Integration

Use [react-synq-store](https://www.npmjs.com/package/react-synq-store)

## Credit

Created by Engr., [Isaiah Pius](https://github.com/IsaiahTek)

### Follow Me

[Linked](https://linkedin.com/in/isaiah-pius)

[X (Twitter)](https://x.com/IsaiahCodes)

## Sponsorship

Kindly [Donate](https://github.com/sponsors/IsaiahTek) to help me continue authoring and maintaining all my open source projects.
