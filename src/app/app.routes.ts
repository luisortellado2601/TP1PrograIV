import { Routes } from '@angular/router';
import { authGuard } from './guards/auth-guard';
import { adminGuard } from './guards/admin-guard';

export const routes: Routes = [
    {
        path: '',
        redirectTo: 'cartelera',
        pathMatch: 'full'
    },
    {
        path: 'cartelera',
        loadComponent: () => import('./componentes/cartelera/cartelera').then(m => m.Cartelera),
    },
    {
        path: 'pelicula-detalle/:id',
        loadComponent: () => import('./componentes/pelicula-detalle/pelicula-detalle').then(m => m.PeliculaDetalle),
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
        path: 'candy-cliente',
        loadComponent: ()=> import('./componentes/candy-cliente/candy-cliente').then(m => m.CandyCliente),
        canActivate: [authGuard]
    },
    {
        path: 'admin',
        loadComponent: () => import('./componentes/admin/admin').then(m => m.Admin),
        canMatch: [adminGuard]
    },
    {
        path: 'admin-candy',
        loadComponent: ()=> import('./componentes/admin-candy/admin-candy').then(m => m.Candy),
        canMatch: [adminGuard]
    },
    {
        path: 'peliculas',
        loadComponent: () => import('./componentes/peliculas/peliculas').then(m => m.Peliculas),
        canMatch: [adminGuard]
    },

]