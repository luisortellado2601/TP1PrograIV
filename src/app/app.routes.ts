import { Routes } from '@angular/router';
import { authGuard } from './guards/auth-guard';
import { adminGuard } from './guards/admin-guard';

export const routes: Routes = [
    {
        path: '',
        redirectTo: 'login',
        pathMatch: 'full'
    },
    {
        path: 'login',
        loadComponent: () => import('./componentes/login/login').then(m => m.Login)
    },
    {
        path: 'register',
        loadComponent: () => import('./componentes/register/register').then(m => m.Register)
    },
    {
        path: 'peliculas',
        loadComponent: () => import('./componentes/peliculas/peliculas').then(m => m.Peliculas),
        canActivate: [adminGuard]
    },
    {
        path: 'cartelera',
        loadComponent: () => import('./componentes/cartelera/cartelera').then(m => m.Cartelera),
        canActivate: [authGuard]
    },
    {
        path: 'admin',
        loadComponent: () => import('./componentes/admin/admin').then(m => m.Admin),
        canActivate: [adminGuard]
    }
];