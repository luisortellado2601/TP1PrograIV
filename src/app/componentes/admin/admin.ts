import { Component, computed, inject } from '@angular/core';
import { RouterLink, Router } from '@angular/router'; // 1️⃣ Sumamos 'Router' a la importación
import { Auth } from '../../services/auth';

@Component({
  selector: 'app-admin',
  imports: [RouterLink],
  templateUrl: './admin.html',
  styleUrl: './admin.css'
})
export class Admin {
  private auth = inject(Auth);
  esGerente = computed(() => this.auth.perfilActual()?.rol === 'gerente');
}