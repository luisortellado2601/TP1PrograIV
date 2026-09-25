import { Component } from '@angular/core';
import { RouterLink, Router } from '@angular/router'; // 1️⃣ Sumamos 'Router' a la importación
import { Auth } from '../../services/auth';

@Component({
  selector: 'app-admin',
  imports: [RouterLink], // RouterLink te sirve si usás routerLink="" en el HTML
  templateUrl: './admin.html',
  styleUrl: './admin.css'
})
export class Admin {}