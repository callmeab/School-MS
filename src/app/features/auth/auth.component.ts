import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { getHomeRoute } from '../../core/models/user.model';
import { SCHOOL_CONFIG } from '../../core/config/school.config';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.scss',
})
export class AuthComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly schoolName = SCHOOL_CONFIG.name;
  readonly schoolShortName = SCHOOL_CONFIG.shortName;

  protected readonly showPassword = signal<boolean>(false);
  protected readonly isSubmitting = signal<boolean>(false);

  protected readonly loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  togglePasswordVisibility(): void {
    this.showPassword.update((visible) => !visible);
  }

  async onSubmit(): Promise<void> {
    if (this.loginForm.invalid || this.isSubmitting()) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    const { email, password } = this.loginForm.value;

    const success = await this.authService.login(email ?? '', password ?? '');
    this.isSubmitting.set(false);

    if (success) {
      // Validate returnUrl: strictly require internal paths starting with '/' and not '//'
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      const isInternalPath =
        returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//');

      const destination = isInternalPath
        ? returnUrl
        : getHomeRoute(this.authService.role());

      this.router.navigateByUrl(destination);
    }
  }
}
