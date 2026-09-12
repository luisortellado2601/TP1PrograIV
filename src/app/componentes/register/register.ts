import { Component, signal } from '@angular/core';
import { email, form, FormField, required, min } from '@angular/forms/signals';
import { RouterLink, Router } from '@angular/router';
import { Auth } from '../../services/auth';

interface LoginData {
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  fecha_nacimiento: string;
  tipo_sangre: string;
  color_ojos: string;
  dias_vacaciones: number;
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
    nombre: '',
    apellido: '',
    fecha_nacimiento: '',
    tipo_sangre: '',
    color_ojos: '',
    dias_vacaciones: 0
  });

  registerForm = form(this.registerModel, (schemaPath) => {
    required(schemaPath.email, {message: 'Email requerido'});
    email(schemaPath.email, {message: 'Ingrese un email válido'});
    required(schemaPath.password, {message: 'Password requerido'});
    required(schemaPath.nombre, {message: 'Nombre requerido'});
    required(schemaPath.apellido, {message: 'Apellido requerido'});
    required(schemaPath.fecha_nacimiento, {message: 'Fecha de nacimiento requerida'});
    required(schemaPath.tipo_sangre, {message: 'Tipo de sangre requerido'});
    required(schemaPath.color_ojos, {message: 'Color de ojos requerido'});
    required(schemaPath.dias_vacaciones, {message: 'Días de vacaciones requeridos'});
    min(schemaPath.dias_vacaciones, 0, {message: 'Días de vacaciones no puede ser negativo'});
  });

  constructor(private auth: Auth,private router: Router) {}

    onSubmit(event: Event) {
      event.preventDefault();
      const data = this.registerModel();

      this.auth.signUp(
        data.email, 
        data.password,
        data.nombre,
        data.apellido,
        data.fecha_nacimiento,
        data.tipo_sangre,
        data.color_ojos,
        data.dias_vacaciones
        ).then(resultado => {
          if (resultado.error) {
            alert('Error: ' + resultado.error.message);
          } else {
            alert('¡Registro exitoso!');
            this.router.navigate(['/login']);
          }
      });
    }
  }