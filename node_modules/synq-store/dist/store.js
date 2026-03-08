"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Store = void 0;
/**
 * Base Store class supporting Collection (Array) and Single (Object) modes.
 */
class Store {
    constructor(initial, key) {
        this.key = 'id';
        this.state = null;
        this.listeners = new Set();
        this.state = initial;
        if (key)
            this.key = key;
        if (typeof window !== "undefined") {
            queueMicrotask(async () => {
                try {
                    const { addStore } = await Promise.resolve().then(() => __importStar(require("./synq")));
                    addStore(this);
                }
                catch (e) { /* ignore */ }
            });
        }
    }
    get snapshot() {
        return this.state;
    }
    get isCollection() {
        return Array.isArray(this.state);
    }
    // -------------------
    // Add
    // -------------------
    add(item) {
        if (this.isCollection) {
            const list = this.state;
            const id = item[this.key];
            // Prevent duplicates
            if (id !== undefined && list.some((i) => i[this.key] === id))
                return;
            this.setState([...list, item]);
        }
        else {
            this.setState(item);
        }
    }
    addMany(items) {
        if (this.isCollection) {
            const current = this.state;
            // Filter out existing items
            const newItems = items.filter(newItem => {
                const id = newItem[this.key];
                return !current.some((existing) => existing[this.key] === id);
            });
            this.setState([...current, ...newItems]);
        }
        else {
            this.setState(items);
        }
    }
    // -------------------
    // Update
    // -------------------
    update(item, id) {
        if (this.isCollection) {
            if (!id)
                return;
            const list = this.state;
            const index = list.findIndex((i) => i[this.key] === id);
            const current = index !== -1 ? list[index] : undefined;
            const next = typeof item === 'function'
                ? item(current)
                : { ...current, ...item };
            const nextList = [...list];
            if (index !== -1)
                nextList[index] = next;
            else
                nextList.push(next); // Upsert
            this.setState(nextList);
        }
        else {
            const current = this.state;
            const next = typeof item === 'function'
                ? item(current)
                : { ...current, ...item };
            this.setState(next);
        }
    }
    // -------------------
    // Remove
    // -------------------
    remove(input) {
        if (this.isCollection) {
            const list = this.state;
            let nextList;
            if (typeof input === 'function') {
                nextList = list.filter(item => !input(item));
            }
            else {
                nextList = list.filter((i) => i[this.key] !== input);
            }
            this.setState(nextList);
        }
        else {
            // Single Mode
            if (typeof input === 'function') {
                const current = this.state;
                if (current && input(current)) {
                    this.setState(null);
                }
            }
            else {
                this.setState(null);
            }
        }
    }
    find(id) {
        if (this.isCollection) {
            return this.state.find((i) => i[this.key] === id);
        }
        return undefined;
    }
    findBy(predicate) {
        if (this.isCollection) {
            return this.state.find(predicate);
        }
        const item = this.state;
        return predicate(item) ? item : undefined;
    }
    findByKey(key, value) {
        if (this.isCollection) {
            return this.state.find(item => item[key] === value);
        }
        const item = this.state;
        return item[key] === value ? item : undefined;
    }
    setState(next) {
        if (Object.is(this.state, next))
            return;
        this.state = next;
        this.listeners.forEach((l) => l(this.state));
    }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
}
exports.Store = Store;
//# sourceMappingURL=store.js.map