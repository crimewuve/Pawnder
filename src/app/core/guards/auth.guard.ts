import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Solo deja pasar a usuarios con sesión; si no, los manda al login */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.whenReady();
  return auth.isLoggedIn() ? true : router.createUrlTree(['/login']);
};

/** Evita que alguien con sesión vuelva a ver login/registro */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.whenReady();
  return auth.isLoggedIn() ? router.createUrlTree(['/home']) : true;
};