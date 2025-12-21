import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, map, catchError, of, switchMap, timeout, first, finalize } from 'rxjs';
import { UserService, User } from './user.service';
import { toObservable } from '@angular/core/rxjs-interop';

export interface AuthResult {
  success: boolean;
  error?: string;
  errorType?: 'invalid_credentials' | 'network_error' | 'server_error' | 'user_exists' | 'unknown';
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:3000/users';

  constructor(private http: HttpClient, private userService: UserService) {
    this.checkInitialAuthStatus();
  }

  private checkInitialAuthStatus(): void {
    const userId = localStorage.getItem('currentUserId');
    if (userId) {
      this.http.get<User>(`${this.apiUrl}/${userId}`)
        .pipe(
          catchError(() => of(null as any))
        )
        .subscribe(user => {
          if (user) {
            this.userService.setUser(user);
          } else {
            localStorage.removeItem('currentUserId');
          }
        });
    }
  }

  private getErrorMessage(error: any): { message: string; type: 'invalid_credentials' | 'network_error' | 'server_error' | 'user_exists' | 'unknown' } {
    if (error && error.name === 'TimeoutError') {
      return { message: 'Превышено время ожидания ответа сервера. Проверьте подключение к интернету и убедитесь, что сервер запущен.', type: 'network_error' };
    }
    
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return { message: 'Нет подключения к интернету. Проверьте соединение и убедитесь, что сервер запущен.', type: 'network_error' };
      }
      if (error.status === 504 || error.status === 408) {
        return { message: 'Превышено время ожидания ответа сервера. Проверьте подключение к интернету.', type: 'network_error' };
      }
      if (error.status >= 500) {
        return { message: 'Ошибка сервера. Попробуйте позже.', type: 'server_error' };
      }
      if (error.status >= 400) {
        return { message: 'Ошибка при выполнении запроса.', type: 'server_error' };
      }
    }
    
    const errorMessage = error?.message || error?.toString() || '';
    const errorString = errorMessage.toLowerCase();
    
    if (errorString.includes('failed to fetch') || 
        errorString.includes('networkerror') || 
        errorString.includes('network request failed') ||
        errorString.includes('load failed') ||
        errorString.includes('networkerror when attempting to fetch resource') ||
        (!navigator.onLine)) {
      return { message: 'Нет подключения к интернету. Проверьте соединение и убедитесь, что сервер запущен.', type: 'network_error' };
    }
    
    return { message: 'Произошла неизвестная ошибка.', type: 'unknown' };
  }

  login(email: string, password: string): Observable<AuthResult> {
    if (!navigator.onLine) {
      return of({
        success: false,
        error: 'Нет подключения к интернету. Проверьте соединение.',
        errorType: 'network_error'
      });
    }

    return this.http.get<User[]>(`${this.apiUrl}?email=${email}&password=${password}`)
      .pipe(
        timeout(10000),
        first(),
        map((users): AuthResult => {
          if (users.length > 0) {
            const user = users[0];
            localStorage.setItem('currentUserId', user.id!.toString());
            this.userService.setUser(user);
            return { success: true };
          }
          return { 
            success: false, 
            error: 'Неверный email или пароль.', 
            errorType: 'invalid_credentials' 
          };
        }),
        catchError((error) => {
          const errorInfo = this.getErrorMessage(error);
          const result: AuthResult = { 
            success: false, 
            error: errorInfo.message, 
            errorType: errorInfo.type 
          };
          return of(result);
        })
      );
  }

  register(email: string, password: string): Observable<AuthResult> {
    if (!navigator.onLine) {
      return of({
        success: false,
        error: 'Нет подключения к интернету. Проверьте соединение.',
        errorType: 'network_error'
      });
    }

    const newUser: Omit<User, 'id'> = {
      email: email,
      password: password,
      wins: 0,
      losses: 0
    };

    return this.http.get<User[]>(`${this.apiUrl}?email=${email}`).pipe(
      switchMap(existingUsers => {
        if (existingUsers.length > 0) {
          return of<AuthResult>({ 
            success: false, 
            error: 'Пользователь с таким email уже существует.', 
            errorType: 'user_exists' 
          });
        }

        return this.http.post<User>(this.apiUrl, newUser).pipe(
          map(() => ({ success: true })),
          catchError((error) => {
            const errorInfo = this.getErrorMessage(error);
            const result: AuthResult = { 
              success: false, 
              error: errorInfo.message, 
              errorType: errorInfo.type 
            };
            return of(result);
          })
        );
      }),
      catchError((error) => {
        const errorInfo = this.getErrorMessage(error);
        const result: AuthResult = { 
          success: false, 
          error: errorInfo.message, 
          errorType: errorInfo.type 
        };
        return of(result);
      })
    );
  }

  logout(): void {
    localStorage.removeItem('currentUserId');
    this.userService.currentUser.set(null);
  }

  isLoggedIn(): Observable<boolean> {
    return toObservable(this.userService.currentUser).pipe(
      map(user => !!user)
    );
  }

  loginAsGuest(): void {
    this.userService.setGuestUser();
  }
}
