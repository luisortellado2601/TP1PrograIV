import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';

export const authGuard: CanActivateFn = (route, state) => {
  const platformId = inject(PLATFORM_ID);
  const router = inject(Router);

  if (isPlatformBrowser(platformId)) {
    
    const userSession = sessionStorage.getItem('tu_variable_de_sesion');
    
    if (userSession) {
      return true; 
    }
  }
  router.navigate(['/login']);
  return false;
};