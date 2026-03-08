import { SynqStore as ST } from "./synq_store";
import { Store } from "./store";
/**
 * Convenience exports for commonly used Synq operations.
 *
 * - `addStore`: Registers a store with the Synq manager.
 * - `emptyStore`: Clears the data in a specific store.
 * - `clearAllStores`: Resets all registered stores.
 */
declare const addStore: <T>(store: Store<T> | ST<T & {
    id: string;
}, any>) => void, emptyStore: <T>(store: ST<T & {
    id: string;
}, any> | Store<T>) => void, clearAllStores: () => void;
export { addStore, emptyStore, clearAllStores };
