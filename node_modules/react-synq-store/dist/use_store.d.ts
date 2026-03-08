import { Store, SynqStore } from "synq-store";
export declare function useStore<T>(store: Store<T>): T | T[] | null;
export declare function useServerSyncedStore<T extends {
    id: string;
}, B>(store: SynqStore<T, B>): T[];
export declare function useServerSyncedStoreWithExtras<T extends {
    id: string;
}, B>(store: SynqStore<T, B>): {
    data: T[];
    fetch: () => Promise<void>;
    add: (item: Partial<T>, xId?: B | undefined) => Promise<void>;
    update: (item: Partial<T> | ((state: T) => T), key?: string) => Promise<void>;
    remove: (input: string | ((item: T) => boolean)) => Promise<void>;
    addMany: (items: T[]) => Promise<void>;
    dispose: () => void;
    subscribe: (listener: import("synq-store").Listener<T | T[] | null>) => () => boolean;
    setState: (next: T | T[] | null) => void;
    isLoading: boolean;
    isIdle: boolean;
    isError: boolean;
    isSuccess: boolean;
};
