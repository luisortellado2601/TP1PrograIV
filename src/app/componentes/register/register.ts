import { Component, signal } from '@angular/core';
import { email, form, FormField, required } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { Auth } from '../../services/auth';

interface LoginData {
  email: string;
  password: string;
}

@Component({
  imports: [FormField, RouterLink],
  selector: 'app-register',
  styleUrl: './register.css',
  templateUrl: './register.html',
})
export class Register {
  registerModel = signal<LoginData>({
    email: '',
    password: '',
  });

  registerForm = form(this.registerModel, (schemaPath) => {
    required(schemaPath.email, {message: 'Email is required'});
    email(schemaPath.email, {message: 'Enter a valid email address'});
    required(schemaPath.password, {message: 'Password is required'});
  });

  constructor(private auth: Auth) {}

  onSubmit(event: Event) {
    event.preventDefault();
    console.log(this.registerModel());
    this.auth.signUp(this.registerModel().email, this.registerModel().password);
  }
}