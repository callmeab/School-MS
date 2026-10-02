import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

/**
 * Normalizes Supabase project URL in case the dashboard URL was pasted.
 */
function normalizeUrl(url: string): string {
  const match = url.match(/dashboard\/project\/([a-zA-Z0-9]+)/);
  if (match) {
    return `https://${match[1]}.supabase.co`;
  }
  return url;
}

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private readonly _client: SupabaseClient = createClient(
    normalizeUrl(environment.supabaseUrl),
    environment.supabaseAnonKey
  );

  /**
   * Returns the shared Supabase client singleton instance.
   */
  get client(): SupabaseClient {
    return this._client;
  }
}
