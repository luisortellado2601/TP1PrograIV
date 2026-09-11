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
    console.log('Login result:', result);
    if (result.error) {
      console.error('Login failed:', result.error);
      return;
    }
    console.log('Login successful:', result.data);
    this.router.navigate(['/peliculas']);
  }

}