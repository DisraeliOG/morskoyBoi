import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import {Router, RouterLink} from '@angular/router';
import {NgClass, CommonModule} from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.component.html',
  imports: [
    CommonModule,
    NgClass,
    ReactiveFormsModule,
    RouterLink
  ],
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  errorMessage: string = '';
  isLoading: boolean = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(3)]]
    });
  }

  onSubmit() {
    if (this.loginForm.valid) {
      this.errorMessage = '';
      this.isLoading = true;
      this.loginForm.disable();
      
      this.authService.login(
        this.loginForm.value.email,
        this.loginForm.value.password
      ).subscribe({
        next: (result) => {
          console.log('Login result:', result);
          this.isLoading = false;
          this.loginForm.enable();
          if (result.success) {
            this.router.navigate(['/dashboard']);
          } else {
            this.errorMessage = result.error || 'Произошла ошибка при входе.';
          }
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Login error:', error);
          this.isLoading = false;
          this.loginForm.enable();
          this.errorMessage = 'Произошла ошибка при подключении к серверу.';
          this.cdr.detectChanges();
        },
        complete: () => {
          console.log('Login complete');
          this.isLoading = false;
          this.loginForm.enable();
          this.cdr.detectChanges();
        }
      });
    }
  }
}
