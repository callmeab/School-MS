import { Component, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from './shared/components/toast/toast.component';
import { SupabaseService } from './core/services/supabase.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  private readonly supabaseService = inject(SupabaseService);

  ngOnInit(): void {
    // Validates Supabase client initialization without logging sensitive credentials
    if (!this.supabaseService.client) {
      throw new Error('Supabase client failed to initialize.');
    }
  }
}
