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

  errorMessage = signal<string>('');

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

    this.errorMessage.set('');

    if (this.loginForm().valid()) {
      const credentials = this.loginModel();
      const result = await this.auth.signIn(credentials.email, credentials.password);
      
      if (result.error) {
        let mensajeAmigable = 'Ocurrió un error inesperado al iniciar sesión.';
        
        if (result.error.message.includes('Invalid login credentials')) {
          mensajeAmigable = 'El correo electrónico o la contraseña son incorrectos.';
        } else if (result.error.message.toLowerCase().includes('network')) {
          mensajeAmigable = 'Error de conexión. Revisá tu internet e intentá nuevamente.';
        }
        
        this.errorMessage.set(mensajeAmigable);
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
}