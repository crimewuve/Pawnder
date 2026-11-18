import type { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'splash', pathMatch: 'full' },
  {
    path: 'splash',
    loadComponent: () => import('./pages/splash/splash.page').then((m) => m.SplashPage),
  },
  {
    path: 'menu',
    loadComponent: () => import('./pages/main-menu/main-menu.page').then((m) => m.MainMenuPage),
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/register/register.page').then((m) => m.RegisterPage),
  },
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'map-view',
    loadComponent: () => import('./pages/map-view/map-view.page').then((m) => m.MapViewPage),
  },
  {
    path: 'report-detail/:id',
    loadComponent: () =>
      import('./pages/report-detail/report-detail.page').then((m) => m.ReportDetailPage),
  },
  {
    path: 'create-report',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/create-report/create-report.page').then((m) => m.CreateReportPage),
  },
  { path: '**', redirectTo: 'splash' },
];

export { authGuard };
