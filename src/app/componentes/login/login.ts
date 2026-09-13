import { Component, signal } from '@angular/core';
import { form, FormField, required, email } from '@angular/forms/signals';
import { RouterLink, Router } from '@angular/router';
import { LoginData } from '../../models/login-data';
import { Auth } from '../../services/auth';


@Component({
  imports: [FormField, RouterLink],
  selector: 'app-login',
  styleUrl: './login.css',
  templateUrl: './login.html',
})
export class Login {

  loginModel = signal<LoginData>({
    email: '',
    password: '',
  });

  loginForm = form(this.loginModel, (schemaPath) => {
    required(schemaPath.email, {message: 'Email requerido'});
    email(schemaPath.email, {message: 'Ingrese un email válido'});
    required(schemaPath.password, {message: 'Password requerido'});
  });

  constructor(private auth: Auth, private router: Router) {}

    async onSubmit(event: Event) {
    event.preventDefault();

    const credentials = this.loginModel();
    const result = await this.auth.signIn(credentials.email, credentials.password);
    
    console.log('Login exitoso:', result);
    if (result.error) {
      console.error('Login fallido:', result.error);
      return;
    }

    const perfil = this.auth.perfilActual();

    if (perfil?.rol === 'gerente' || perfil?.rol === 'empleado') {
      this.router.navigate(['/admin']);
    } else {
      this.router.navigate(['/cartelera']);
    }
  }
}