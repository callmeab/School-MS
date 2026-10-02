import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { LayoutStore } from '../../core/services/layout.store';
import { NAV_ITEMS } from '../../core/config/nav-items';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  private readonly authService = inject(AuthService);
  protected readonly layoutStore = inject(LayoutStore);

  /**
   * Filters the central NAV_ITEMS config strictly based on the current user role signal.
   */
  protected readonly navItems = computed(() => {
    const role = this.authService.role();
    if (!role) return [];
    return NAV_ITEMS.filter((item) => item.allowedRoles.includes(role));
  });

  onLinkClick(): void {
    // Automatically close sidebar when navigating on mobile devices
    this.layoutStore.closeSidebar();
  }
}
