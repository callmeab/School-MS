import { Injectable, signal, computed } from '@angular/core';

export interface LayoutState {
  isSidebarOpen: boolean;
  pageTitle: string;
}

/**
 * Signal-based store managing layout and responsive navigation state.
 */
@Injectable({
  providedIn: 'root',
})
export class LayoutStore {
  private readonly _state = signal<LayoutState>({
    isSidebarOpen: false,
    pageTitle: 'Dashboard',
  });

  // Readonly computed signals
  readonly isSidebarOpen = computed(() => this._state().isSidebarOpen);
  readonly pageTitle = computed(() => this._state().pageTitle);

  toggleSidebar(): void {
    this._state.update((s) => ({ ...s, isSidebarOpen: !s.isSidebarOpen }));
  }

  openSidebar(): void {
    this._state.update((s) => ({ ...s, isSidebarOpen: true }));
  }

  closeSidebar(): void {
    this._state.update((s) => ({ ...s, isSidebarOpen: false }));
  }

  setPageTitle(title: string): void {
    this._state.update((s) => ({ ...s, pageTitle: title }));
  }
}
