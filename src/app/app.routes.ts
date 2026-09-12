import { Routes } from '@angular/router';
import { authGuard } from './guards/auth-guard';
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
        canActivate: [authGuard]
    }
];