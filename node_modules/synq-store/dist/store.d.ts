import { Listener } from "./types";
/**
 * Base Store class supporting Collection (Array) and Single (Object) modes.
 */
export declare class Store<T> {
    key: string;
    protected state: T | T[] | null;
    protected listeners: Set<Listener<T | T[] | null>>;
    constructor(initial: T | T[] | null, key?: string);
    get snapshot(): T | T[] | null;
    protected get isCollection(): boolean;
    add(item: T | Partial<T>): void;
    addMany(items: T[]): void;
    update(item: Partial<T> | ((state: T) => T), id?: string): void;
    remove(input: string | ((item: T) => boolean)): void;
    find(id: string): T | undefined;
    findBy(predicate: (item: T) => boolean): T | undefined;
    findByKey<K extends keyof T>(key: K, value: T[K]): T | undefined;
    setState(next: T | T[] | null): void;
    subscribe(listener: Listener<T | T[] | null>): () => boolean;
}
