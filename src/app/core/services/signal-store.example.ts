import { Injectable, signal, computed } from '@angular/core';

export interface StoreState<T> {
  items: T[];
  selectedItem: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Reusable Signal-based Store Pattern Example.
 * Demonstrates state management using Angular signals and computed selectors
 * without needing external state libraries like NgRx.
 *
 * Example usage pattern to replicate across features (students, classes, etc.):
 * 1. Define feature State interface.
 * 2. Keep private readonly _state = signal<State>(initialState).
 * 3. Expose readonly computed signals for components to consume.
 * 4. Expose clean updater methods (actions) that mutate state immutably.
 */
@Injectable({
  providedIn: 'root',
})
export class SignalStoreExampleService {
  // 1. Private signal containing the single source of truth
  private readonly _state = signal<StoreState<{ id: string; name: string }>>({
    items: [],
    selectedItem: null,
    loading: false,
    error: null,
  });

  // 2. Public read-only signals / computed selectors
  readonly state = this._state.asReadonly();
  readonly items = computed(() => this._state().items);
  readonly selectedItem = computed(() => this._state().selectedItem);
  readonly loading = computed(() => this._state().loading);
  readonly error = computed(() => this._state().error);
  readonly itemCount = computed(() => this._state().items.length);

  // 3. State update methods (mutations)
  setLoading(loading: boolean): void {
    this._state.update((current) => ({ ...current, loading }));
  }

  setItems(items: { id: string; name: string }[]): void {
    this._state.update((current) => ({
      ...current,
      items,
      loading: false,
      error: null,
    }));
  }

  selectItem(item: { id: string; name: string } | null): void {
    this._state.update((current) => ({ ...current, selectedItem: item }));
  }

  setError(error: string): void {
    this._state.update((current) => ({
      ...current,
      error,
      loading: false,
    }));
  }

  reset(): void {
    this._state.set({
      items: [],
      selectedItem: null,
      loading: false,
      error: null,
    });
  }
}
