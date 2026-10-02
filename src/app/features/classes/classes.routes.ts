import { Routes } from '@angular/router';

export const CLASSES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./classes.component').then((m) => m.ClassesComponent),
  },
];
