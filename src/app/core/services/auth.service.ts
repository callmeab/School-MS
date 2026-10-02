import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { Session } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { ToastService } from './toast.service';
import { UserProfile, UserRole } from '../models/user.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  // Core signals
  private readonly _session = signal<Session | null>(null);
  readonly session = this._session.asReadonly();

  private readonly _profile = signal<UserProfile | null>(null);
  readonly profile = this._profile.asReadonly();

  private readonly _loading = signal<boolean>(true);
  readonly loading = this._loading.asReadonly();

  // Computed properties
  readonly isAuthenticated = computed<boolean>(() => {
    const session = this._session();
    const profile = this._profile();
    return !!session && !!profile && profile.is_active === true;
  });

  readonly role = computed<UserRole | null>(() => {
    return this._profile()?.role ?? null;
  });

  readonly isAdmin = computed<boolean>(() => this.role() === 'admin');
  readonly isTeacher = computed<boolean>(() => this.role() === 'teacher');

  private authListenerAttached = false;

  /**
   * Initializes session and profile on application bootstrap.
   * Invoked via provideAppInitializer before route guards evaluate.
   */
  async init(): Promise<void> {
    try {
      const { data, error } = await this.supabaseService.client.auth.getSession();
      if (!error && data.session?.user) {
        this._session.set(data.session);
        await this.loadProfile(data.session.user.id);
      } else {
        this._session.set(null);
        this._profile.set(null);
      }
    } catch {
      this._session.set(null);
      this._profile.set(null);
    } finally {
      this._loading.set(false);
      this.subscribeToAuthChanges();
    }
  }

  /**
   * Signs in user with email and password.
   * Fetches fresh role and account status strictly from the 'profiles' table.
   */
  async login(email: string, password: string): Promise<boolean> {
    this._loading.set(true);
    try {
      const { data, error } = await this.supabaseService.client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error || !data.user || !data.session) {
        this.toastService.showError('Invalid email or password');
        this._loading.set(false);
        return false;
      }

      this._session.set(data.session);
      const isProfileValid = await this.loadProfile(data.user.id);
      this._loading.set(false);
      return isProfileValid;
    } catch {
      this.toastService.showError('Invalid email or password');
      this._loading.set(false);
      return false;
    }
  }

  /**
   * Signs out user, clears all reactive signals, and navigates to /login.
   */
  async logout(reasonMessage?: string): Promise<void> {
    this._loading.set(true);
    try {
      await this.supabaseService.client.auth.signOut();
    } catch {
      // Continue cleanup regardless of signout network status
    } finally {
      this._session.set(null);
      this._profile.set(null);
      this._loading.set(false);

      if (reasonMessage) {
        this.toastService.showError(reasonMessage);
      }

      this.router.navigate(['/login']);
    }
  }

  /**
   * Loads profile strictly from database profiles table.
   * Enforces role and active status check.
   */
  private async loadProfile(userId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('profiles')
        .select('id, full_name, role, phone, is_active, created_at')
        .eq('id', userId)
        .single();

      if (error || !data) {
        await this.logout('User profile record not found. Please contact administration.');
        return false;
      }

      if (!data.is_active) {
        await this.logout('Your account is deactivated. Please contact administration.');
        return false;
      }

      if (data.role !== 'admin' && data.role !== 'teacher') {
        await this.logout('Your account has no access.');
        return false;
      }

      this._profile.set(data as UserProfile);
      return true;
    } catch {
      await this.logout('Unable to load profile data.');
      return false;
    }
  }

  /**
   * Subscribes to auth state changes once.
   * Supabase async calls are deferred via setTimeout(..., 0) to avoid known deadlock issues.
   */
  private subscribeToAuthChanges(): void {
    if (this.authListenerAttached) return;
    this.authListenerAttached = true;

    this.supabaseService.client.auth.onAuthStateChange((_event, session) => {
      // Defer Supabase calls to avoid client deadlock
      setTimeout(async () => {
        if (session?.user) {
          this._session.set(session);
          if (this._profile()?.id !== session.user.id) {
            await this.loadProfile(session.user.id);
          }
        } else {
          this._session.set(null);
          this._profile.set(null);
        }
        this._loading.set(false);
      }, 0);
    });
  }
}
