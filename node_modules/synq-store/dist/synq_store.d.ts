import { Store } from "./store";
import { ServerOptions, SynqStoreStatus } from "./types";
interface ExtendedServerOptions<T, B> extends ServerOptions<T, B> {
    mode?: 'collection' | 'single';
}
export declare class SynqStore<T, B> extends Store<T> {
    status: SynqStoreStatus;
    private options;
    private timer?;
    constructor(initial: T | T[] | null, options: ExtendedServerOptions<T, B>, key?: string);
    get isSingleMode(): boolean;
    get isLoading(): boolean;
    get isError(): boolean;
    get isSuccess(): boolean;
    get isIdle(): boolean;
    fetch(): Promise<void>;
    add(item: Partial<T>, xId?: B): Promise<void>;
    addMany(items: T[]): Promise<void>;
    update(item: Partial<T> | ((state: T) => T), key?: string): Promise<void>;
    remove(input: string | ((item: T) => boolean)): Promise<void>;
    dispose(): void;
}
export {};
