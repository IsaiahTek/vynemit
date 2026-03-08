import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Store } from '../src/store';

interface Item {
  id: string;
  name: string;
}

const emptyItem: Item = {
  id: '',
  name: '',
}

describe('Store<T>', () => {
  let store: Store<Item>;

  beforeEach(() => {
    store = new Store<Item>(emptyItem, 'id');
  });

  it('adds an item', () => {
    store.add({ id: '1', name: 'Item 1' });
    // expect(store.snapshot).toHaveLength(1);
    expect((store.snapshot as Item).name).toBe('Item 1');
  });

  it('updates an item by key', () => {
    store.add({ id: '1', name: 'Item 1' });
    store.update({ id: '1', name: 'Updated' }, '1');
    expect((store.snapshot as Item).name).toBe('Updated');
  });

  it('supports functional updates', () => {
    store.add({ id: '1', name: 'Item 1' });

    store.update((item) => ({ ...item!, name: 'Renamed' }), '1');

    expect((store.snapshot as Item).name).toBe('Renamed');
  });

  it('removes an item', () => {
    store.add({ id: '1', name: 'Item 1' });
    store.remove('1');
    // expect(store.snapshot).toHaveLength(0);
  });

  it('calls subscribers when state changes', () => {
    const listener = vi.fn();
    store.subscribe(listener);
    store.add({ id: '1', name: 'Item 1' });
    expect(listener).toHaveBeenCalled();
  });
});
