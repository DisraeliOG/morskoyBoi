import { Component, OnInit } from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import {Router, RouterLink} from '@angular/router';
import {CommonModule, NgClass} from '@angular/common';

@Component({
  selector: 'app-register',
  standalone: true,
  templateUrl: './register.component.html',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NgClass,
    RouterLink
  ],
  styleUrls: ['./register.component.css']
})
export class RegisterComponent implements OnInit {
  registerForm!: FormGroup;
  errorMessage: string = '';
  successMessage: string = '';
  isLoading: boolean = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.registerForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, {
      validators: this.passwordMatchValidator
    });
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;

    if (password && confirmPassword && password !== confirmPassword) {
      form.get('confirmPassword')?.setErrors({ passwordMismatch: true });
    } else {
      form.get('confirmPassword')?.setErrors(null);
    }
    return null;
  }

  onSubmit() {
    if (this.registerForm.valid) {
      this.errorMessage = '';
      this.successMessage = '';
      this.isLoading = true;
      this.registerForm.disable();
      
      const subscription = this.authService.register(
        this.registerForm.value.email,
        this.registerForm.value.password
      ).subscribe({
        next: (result) => {
          this.isLoading = false;
          this.registerForm.enable();
          if (result.success) {
            this.successMessage = 'Регистрация прошла успешно! Выполните вход.';
            setTimeout(() => {
              this.router.navigate(['/login']);
            }, 2000);
          } else {
            this.errorMessage = result.error || 'Произошла ошибка при регистрации.';
          }
          subscription.unsubscribe();
        },
        error: (error) => {
          this.isLoading = false;
          this.registerForm.enable();
          this.errorMessage = 'Произошла ошибка при подключении к серверу.';
          console.error('Ошибка регистрации:', error);
          subscription.unsubscribe();
        },
        complete: () => {
          this.isLoading = false;
          this.registerForm.enable();
        }
      });
    }
  }
}
