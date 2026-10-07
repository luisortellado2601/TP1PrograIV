import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { Auth } from '../services/auth';

export const gerenteGuard: CanActivateFn = async (route, state) => {
  const platformId = inject(PLATFORM_ID);
  const router = inject(Router);
  const authService = inject(Auth);

  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  const respuesta = await authService.getUser();

  if (respuesta.data?.user) {
    const rol = await authService.getRolUsuario(respuesta.data.user.id);

    if (rol === 'gerente') {
      return true;
    } else {
      router.navigate(['/cartelera']);
      return false;
    }
  }

  router.navigate(['/login']);
  return false;
};
