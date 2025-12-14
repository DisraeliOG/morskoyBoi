import { Injectable, signal, WritableSignal } from '@angular/core';

export interface User {
  id?: number;
  email: string;
  password: string;
  wins: number;
  losses: number;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  public currentUser: WritableSignal<User | null> = signal(null);

  constructor() {}

  setUser(user: User): void {
    this.currentUser.set(user);
  }

  updateStats(wins: number, losses: number): void {
    const user = this.currentUser();
    if (user) {
      const updatedUser = { ...user, wins: user.wins + wins, losses: user.losses + losses };
      this.currentUser.set(updatedUser);
    }
  }
}
