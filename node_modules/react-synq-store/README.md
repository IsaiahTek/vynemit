# React-Synq-Store

<p align="center">
<img src="https://raw.githubusercontent.com/IsaiahTek/react-synq-store/main/images/react_sync_state_cover.svg" />
</p>

**React-Synq-Store** is a lightweight, hook-based state management library for React and Next.js, with powerful, built-in features for **local state management**, **server data synchronization**, and **optimistic updates**.

It's built on top of [synq-store](https://github.com/IsaiahTek/synq-store) and provides convenient React hooks for seamless integration into your React applications.

---

## Features

- **React Hooks:** Simple `useStore` and `useServerSyncedStore` hooks for effortless state management.
- **Optimistic Updates:** Experience instant UI updates on `add`, `update`, and `remove` operations, with automatic rollback on failure.
- **Server Synchronization:** The **`SynqStore`** handles data fetching, caching, and server mutations out of the box.
- **Interval Re-fetching:** Keep data fresh with automatic background fetching on a defined interval.
- **Next.js Ready:** Works seamlessly with Next.js App Router and Server Components.
- **TypeScript First:** Fully typed for an excellent developer experience.
- **Zero Configuration:** Works out of the box with sensible defaults.

---

## Installation

```bash
# Using npm
npm install react-synq-store

# Using yarn
yarn add react-synq-store

# Using pnpm
pnpm add react-synq-store
```

---

## Quick Start

### Basic Local State Management

```typescript
import { Store, useStore } from "react-synq-store";

// Create a store
const counterStore = new Store({ count: 0 });

function Counter() {
  const state = useStore(counterStore);

  return (
    <div>
      <p>Count: {state.count}</p>
      <button onClick={() => counterStore.setState({ count: state.count + 1 })}>
        Increment
      </button>
    </div>
  );
}
```

### Server State Synchronization

```typescript
import { SynqStore, useServerSyncedStore } from "react-synq-store";

// Define your data type
interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

// Create a SynqStore
const todosStore = new SynqStore<Todo>([], {
  fetcher: async () => {
    const response = await fetch("/api/todos");
    return response.json();
  },
  add: async (todo) => {
    const response = await fetch("/api/todos", {
      method: "POST",
      body: JSON.stringify(todo),
    });
    return response.json();
  },
  update: async (id, updates) => {
    const response = await fetch(`/api/todos/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
    return response.json();
  },
  remove: async (id) => {
    await fetch(`/api/todos/${id}`, { method: "DELETE" });
  },
});

function TodoList() {
  const todos = useServerSyncedStore(todosStore);

  const handleAdd = async () => {
    await todosStore.add({ title: "New Todo", completed: false });
  };

  const handleToggle = async (id: string, completed: boolean) => {
    await todosStore.update(id, { completed: !completed });
  };

  return (
    <div>
      <button onClick={handleAdd}>Add Todo</button>
      <ul>
        {todos.map((todo) => (
          <li key={todo.id}>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => handleToggle(todo.id, todo.completed)}
            />
            {todo.title}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## Core Concepts

### Store

A `Store` is a simple container for local state that can be shared across components:

```typescript
import { Store } from "react-synq-store";

const uiStore = new Store({
  theme: "light",
  sidebarOpen: false,
});

// Update state
uiStore.setState({ theme: "dark" });

// Get current state
const currentState = uiStore.getState();
```

Note: Store can either be typed as single item or a list of items (i.e)

```typescript
new Store<Item>(); // For single item

// OR
new Store<Item[]>(); // For list of items
```

### SynqStore

A `SynqStore` extends `Store` with server synchronization capabilities:

```typescript
import { SynqStore } from "react-synq-store";

const store = new SynqStore<ItemType>(initialData, {
  fetcher: () => fetchFromServer(),
  add: (item) => createOnServer(item),
  update: (id, updates) => updateOnServer(id, updates),
  remove: (id) => deleteOnServer(id),
  refetchInterval: 30000, // Optional: auto-refetch every 30s
});
```

Note: While Store can accept array type or single type, SynqStore doesn't expect you to use array as type.
It automatically types any type into an array behind the scene. Hence, you get a list of the type you specified.

```typescript
new SynqStore<Item[], ...>(...)   // X : VERY WRONG

// Correct way
new SynqStore<Item, ...>(...)     // CORRECT

```

---

## API Reference

### `useStore(store, selector?)`

Subscribe to a `Store` or `SynqStore`:

```typescript
// Subscribe to entire store
const state = useStore(myStore);

// Subscribe to specific field (with selector)
const count = useStore(myStore, (state) => state.count);
```

### `useServerSyncedStore(store)`

Subscribe to a `SynqStore` with server sync status:

```typescript
const items = useServerSyncedStore(myStore);

// The store provides methods for mutations
await myStore.add(newItem);
await myStore.update(id, updates);
await myStore.remove(id);
```

### Semantic Store Status Properties

Check if a `SynqStore` has finished initial fetching:

```typescript
if (myStore.isSuccess) {
  // Data is ready
}
if (myStore.isLoading) {
  //
}
if (myStore.isError) {
  // The most recent server action threw an error
}
```

### `useServerSyncedStoreWithActions` for using advanced actions [OPTIONAL]

```typescript
const {
  data: items,
  fetch,
  add,
  update,
  remove,
  addMany,
  dispose,
  subscribe,
  setState,
  isLoading,
  isIdle,
  isError,
  isSuccess,
} = useServerSyncedStoreWithExtras(itemsStore);
```

---

## Real-World Example

Here's a complete example with error handling and loading states:

```typescript
import { SynqStore, useServerSyncedStore } from "react-synq-store";

interface Job {
  id: string;
  title: string;
  status: "open" | "in_progress" | "completed" | "cancelled";
}

const jobsStore = new SynqStore<Job>([], {
  fetcher: () => fetch("/api/jobs").then((r) => r.json()),
  add: (job) =>
    fetch("/api/jobs", {
      method: "POST",
      body: JSON.stringify(job),
    }).then((r) => r.json()),
});

function JobList({ filter }: { filter?: string }) {
  const jobs = useServerSyncedStore(jobsStore);

  const filteredJobs = jobs.filter((job) => {
    if (!filter || filter === "all") return true;
    return job.status === filter;
  });

  const handleCreateJob = async () => {
    try {
      await jobsStore.add({
        title: "New Job",
        status: "open",
      });
    } catch (error) {
      console.error("Failed to create job:", error);
      // The optimistic update is automatically rolled back
    }
  };

  if (jobsStore.isLoading) {
    return <div>Loading jobs...</div>;
  }

  return (
    <div>
      <button onClick={handleCreateJob}>Create Job</button>
      <div>
        {filteredJobs.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>
    </div>
  );
}
```

---

## Comparison with Other Libraries

| Feature            | React-Synq-Store | Redux     | Zustand   | React Query |
| ------------------ | ---------------- | --------- | --------- | ----------- |
| Server Sync        | ✅ Built-in      | ❌ Manual | ❌ Manual | ✅ Built-in |
| Optimistic Updates | ✅ Automatic     | ❌ Manual | ❌ Manual | ✅ Manual   |
| Local State        | ✅               | ✅        | ✅        | ❌          |
| TypeScript         | ✅ First-class   | ✅        | ✅        | ✅          |
| Learning Curve     | Low              | High      | Low       | Medium      |

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## License

MIT License - see the [LICENSE](LICENSE) file for details.

---

## Related Projects

- [synq-store](https://github.com/IsaiahTek/synq-store) - The core state management library powering React-Synq-Store

---

## Credits

Built with ❤️ by [IsaiahTek](https://github.com/IsaiahTek)

### Follow Me

[Linked](https://linkedin.com/in/isaiah-pius)

[X (Twitter)](https://x.com/IsaiahCodes)

## Sponsorship

Kindly [Donate](https://github.com/sponsors/IsaiahTek) to help me continue authoring and maintaining all my open source projects.
