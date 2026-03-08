# v1.5.1
Minor update.
Added isIdle to SynqStore to reflect store fetching state before initial fetch call

# v1.5.0
## Readded `find` `findBy` and added `findByKey` to Store which is by extension also available for use in SynqStore

Usage:
```typescript
// This will search and return an item in the collection whose id matches the value
store.find(value) 

store.findBy((item) => item.name === value)

store.findByKey(key, value)
```

# v1.4.1

Minor update on `fetcher?: () => Promise<T | T[]>;` to either return a collection (`T[]`) of provided type or single (`T`) for `mode: single`.

# v1.4.0

## Summary of Changes

- **Single Item Mode**: Introduced `mode: 'single'` configuration. You can now manage a single object (e.g., User Settings, Profile) instead of forcing an array structure.
- **Functional Updates**: `Store.update` and `SynqStore.update` now accept a callback function `(state: T) => T` to calculate the new state based on the previous one.
- **Predicate Removal**: `Store.remove` and `SynqStore.remove` now accept a predicate function `(item: T) => boolean` to conditionally remove items.
- **Optimistic UI**: Enhanced rollback capabilities for functional updates, removals, and single-mode operations on server failure.

---

## Single Item Mode (`mode: 'single'`)

By default, `SynqStore` operates in `'collection'` mode (managing `T[]`). You can now configure it to manage a single object (`T`) by setting the `mode` option.

**Configuration:**

```typescript
const store = new SynqStore<UserSetting, any>(
  { theme: "light", notifications: true }, // Initial State is an Object, not Array
  {
    mode: "single", // <--- Enable Single Mode
    fetcher: getSettings,
    update: updateSettings,
    // ...
  },
);
```

## Usage in Single Mode:

1. Add: Acts as "Set" or "Create".
2. Update: Merges properties into the root object. No ID is required.
3. Remove: Clears the state (sets it to null) or resets it.

```typescript
// Update without an ID
await store.update({ theme: "dark" });

// Or use a function
await store.update((current) => ({ ...current, theme: "dark" }));
```

## Update Methods

`SynqStore.update` and `Store.update`
Signature:

```typescript
update(item: T | ((state: T) => T), key?: string)
```

You can now pass a function to update the state.

1. Single Mode: The function receives the current state object. The key parameter is ignored.
2. Collection Mode: The function receives the specific item found by the key. Note: The key parameter is required in collection mode.

## Example: Functional Update (Collection Mode)

```typescript
await store.add({ id: "x1", title: "Old", priority: 1 });

// Pass a function to derive the new state
await store.update((item) => {
  return { ...item, title: "Updated", priority: item.priority + 1 };
}, "x1"); // Key is required here
```

## Example: Object Update (Collection Mode)

```typescript
// Pass a partial object to merge
await store.update(
  {
    id: "x1",
    title: "Edited",
  },
  "x1",
);
```

## Remove Methods

SynqStore.remove and Store.remove
Signature:

```typescript
remove(input: string | ((item: T) => boolean))
```

You can now remove items by passing a predicate function. If the server sync fails, the items removed by the predicate are restored automatically.

## Example: Remove by ID

```typescript
await store.add({ id: "r1", title: "Delete Me" });
await store.remove("r1");
```

## Example: Remove by Predicate (Function)

```typescript
await store.add({ id: "r1", title: "Delete Me" });
await store.add({ id: "r2", title: "Keep Me" });

// Remove all items where title is "Delete Me"
await store.remove((item) => item.title === "Delete Me");
```

# v1.3.1

## `SynqStore.update` and `Store.update` now accepts `store.update(item: T | ((state: T) => T), key?: string)`

If you are passing in a function to update it ensure you also pass in the key value. The key value is optional because when you are passing in the object instead of function you don't need it.

### Example with function

```ts
await store.add({
  id: "x1",
  title: "Old",
  completed: false,
  description: "Old desc",
  priority: 1,
});
await store.update((item) => {
  console.log("Updating item", item);
  return { ...item, id: "x1", title: "Updated" };
}, "x1");

// See result
const items = store.snapshot as Todo[];
const updated = items.find((i) => i.id === "x1");
console.log("Updated item", updated, items);
expect(updated?.title).toBe("Updated");
expect(mockOptions.update).toHaveBeenCalled();
```

### Example update with object

```ts
await store.add({
  id: "x1",
  title: "Old",
  completed: false,
  description: "Old desc",
  priority: 1,
});
await store.update({
  id: "x1",
  title: "Edited",
  completed: false,
  description: "Old desc",
  priority: 1,
});

// See result
const items = store.snapshot as Todo[];
const updated = items.find((i) => i.id === "x1");
console.log("Updated item", updated, items);
expect(updated?.title).toBe("Edited");
expect(mockOptions.update).toHaveBeenCalled();
```
