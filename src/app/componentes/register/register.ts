import { Component, signal } from '@angular/core';
import { email, form, FormField, required, min, pattern, maxLength, minLength } from '@angular/forms/signals';
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
  fechaHoy = new Date().toISOString().split('T')[0];
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
    maxLength(schemaPath.email, 30, { message: 'Email no puede superar los 30 caracteres'});
    minLength(schemaPath.email, 6, { message: 'Longitud de email minima es de 6 caracteres'} )

    required(schemaPath.password, {message: 'Password requerido'});
    maxLength(schemaPath.password, 15, { message: 'Contraseña no debe superar los 15 caracteres'});
    minLength(schemaPath.password, 4, { message: 'Contraseña debe tener al menos 4 caracteres'})
    

    required(schemaPath.nombre, {message: 'Nombre requerido'});
    pattern(schemaPath.nombre, /^[a-zA-Z]+$/, {message: 'Nombre solo puede contener letras'});
    maxLength(schemaPath.nombre, 20, { message: 'Nombre no puede superar los 20 caracteres'});
    minLength(schemaPath.nombre, 2, { message: 'Nombre debe contener al menos 2 caracteres'})

    required(schemaPath.apellido, {message: 'Apellido requerido'});
    pattern(schemaPath.apellido, /^[a-zA-Z]+$/, {message: 'Apellido solo puede contener letras'});
    maxLength(schemaPath.apellido, 20, { message: 'Apellido no puede superar los 20 caracteres'});
    minLength(schemaPath.apellido, 2, { message: 'Apellido debe contener al menos 2 caracteres'})

    required(schemaPath.fecha_nacimiento, {message: 'Fecha de nacimiento requerida'});

    required(schemaPath.tipo_sangre, {message: 'Tipo de sangre requerido'});

    required(schemaPath.color_ojos, {message: 'Color de ojos requerido'});


    required(schemaPath.dias_vacaciones, {message: 'Días de vacaciones requeridos'});

    min(schemaPath.dias_vacaciones, 0, {message: 'Días de vacaciones no puede ser negativo'});
  });

  constructor(private auth: Auth,private router: Router) {}

    onSubmit(event: Event) {
      event.preventDefault();
      if (this.registerForm().valid()) {

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
}