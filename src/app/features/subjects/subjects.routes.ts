import { Routes } from '@angular/router';

export const SUBJECTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./subjects.component').then((m) => m.SubjectsComponent),
  },
];
