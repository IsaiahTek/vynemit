"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * An advanced reactive data store for synchronizing with remote servers.
 *
 * @template T - The entity type, which must include an `id` property.
 */
// export type SynqStore<T extends { id: string }> = Store<T[]> & {
//   /**
//    * The current status of the store (e.g., loading, idle, error, success).
//    */
//   status: SynqStoreStatus;
//   /**
//    * Fetches the latest items from the server and updates the store state.
//    */
//   fetch(): Promise<void>;
//   /**
//    * Adds a new item to both the store and server.
//    * 
//    * @param item - The item to add (may be partial).
//    */
//   add(item: Partial<T>): Promise<void>;
//   /**
//    * Adds multiple items to both the store and server.
//    * 
//    * @param items - The list of items to add.
//    */
//   addMany(items: T[]): Promise<void>;
//   /**
//    * Updates an existing item in both the store and server.
//    * 
//    * @param item - The item with updated fields.
//    */
//   update(item: T): Promise<void>;
//   /**
//    * Removes an item from both the store and server by ID.
//    * 
//    * @param id - The ID of the item to remove.
//    */
//   remove(id: string): Promise<void>;
//   /**
//    * Disposes of the store by cleaning up subscriptions and resources.
//    */
//   dispose(): void;
// };
//# sourceMappingURL=types.js.map