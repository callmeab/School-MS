import { Routes } from '@angular/router';

export const TEACHERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./teachers.component').then((m) => m.TeachersComponent),
  },
];
