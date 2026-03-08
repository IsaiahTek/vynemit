"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearAllStores = exports.emptyStore = exports.addStore = void 0;
const synq_store_1 = require("./synq_store");
// import { Store, SynqStore } from "./types";
class Synq {
    /**
     * Private constructor to enforce the singleton pattern.
     * Instances should be accessed via `Synq.instance`.
     *
     * @private
     */
    constructor() {
        /**
         * Holds all registered store instances managed by Synq.
         * Can contain both standard `Store` and `SynqStore` objects.
         *
         * @private
         */
        this._stores = [];
    }
    /**
     * Retrieves the singleton instance of `Synq`.
     * Creates a new instance if one does not already exist.
     *
     * @returns The shared Synq instance.
     */
    static get instance() {
        if (!this._instance) {
            this._instance = new Synq();
        }
        return this._instance;
    }
    /**
     * Adds a new store to the Synq manager.
     * This allows centralized tracking and control of multiple store instances.
     *
     * @template T - The store's data type.
     * @param store - The store instance to add (either `Store` or `SynqStore`).
     */
    addStore(store) {
        // if(store instanceof SynqStore)
        Synq.instance._stores.push(store);
    }
    /**
     * Resets a specific store to its initial state.
     * If the store is a `SynqStore`, its status is also reset to `"idle"`.
     *
     * @template T - The store's data type.
     * @param store - The store instance to reset.
     */
    emptyStore(store) {
        const foundStore = Synq.instance._stores.find((s) => s === store);
        if (!foundStore)
            return;
        if (foundStore instanceof synq_store_1.SynqStore) {
            foundStore.status = 'idle';
        }
        foundStore.setState([]);
    }
    /**
     * Clears the state of all stores managed by Synq.
     * Resets each store's state to an empty array and sets its status to `"idle"` if applicable.
     */
    clearAllStores() {
        Synq.instance._stores.forEach((store) => {
            if (store instanceof synq_store_1.SynqStore) {
                store.status = 'idle';
            }
            store.setState([]);
        });
    }
}
/**
 * Convenience exports for commonly used Synq operations.
 *
 * - `addStore`: Registers a store with the Synq manager.
 * - `emptyStore`: Clears the data in a specific store.
 * - `clearAllStores`: Resets all registered stores.
 */
const { addStore, emptyStore, clearAllStores } = Synq.instance;
exports.addStore = addStore;
exports.emptyStore = emptyStore;
exports.clearAllStores = clearAllStores;
//# sourceMappingURL=synq.js.map