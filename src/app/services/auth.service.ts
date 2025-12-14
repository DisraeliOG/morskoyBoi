import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of, switchMap } from 'rxjs';
import { UserService, User } from './user.service';
import { toObservable } from '@angular/core/rxjs-interop';

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

  login(email: string, password: string): Observable<boolean> {
    return this.http.get<User[]>(`${this.apiUrl}?email=${email}&password=${password}`)
      .pipe(
        map(users => {
          if (users.length > 0) {
            const user = users[0];
            localStorage.setItem('currentUserId', user.id!.toString());
            this.userService.setUser(user);
            return true;
          }
          return false;
        }),
        catchError(() => of(false))
      );
  }

  register(email: string, password: string): Observable<boolean> {
    const newUser: Omit<User, 'id'> = {
      email: email,
      password: password,
      wins: 0,
      losses: 0
    };

    return this.http.get<User[]>(`${this.apiUrl}?email=${email}`).pipe(
      switchMap(existingUsers => {
        if (existingUsers.length > 0) {
          return of(false);
        }

        return this.http.post<User>(this.apiUrl, newUser).pipe(
          map(() => true),
          catchError(() => of(false))
        );
      }),
      catchError(() => of(false))
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
}
