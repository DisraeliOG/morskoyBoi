import { Injectable, signal, WritableSignal } from '@angular/core';

export interface User {
  id?: number;
  email: string;
  password: string;
  wins: number;
  losses: number;
  isGuest?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  public currentUser: WritableSignal<User | null> = signal(null);

  constructor() {
    const guestId = sessionStorage.getItem('guestId');
    if (guestId && !this.currentUser()) {
      this.setGuestUser(guestId);
    }
  }

  setUser(user: User): void {
    this.currentUser.set(user);
    if (!user.isGuest && user.id) {
      localStorage.setItem('currentUserId', user.id.toString());
      sessionStorage.removeItem('guestId');
    }
  }

  setGuestUser(guestId?: string): void {
    const id = guestId || this.generateGuestId();
    const shortId = id.split('_').pop()?.substring(0, 8) || Math.random().toString(36).substring(2, 10);
    const guestUser: User = {
      id: undefined,
      email: `Гость_${shortId}`,
      password: '',
      wins: 0,
      losses: 0,
      isGuest: true
    };
    this.currentUser.set(guestUser);
    sessionStorage.setItem('guestId', id);
    localStorage.removeItem('currentUserId');
  }

  private generateGuestId(): string {
    return 'guest_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15) + '_' + Math.random().toString(36).substring(2, 15);
  }

  getGuestId(): string | null {
    return sessionStorage.getItem('guestId');
  }

  updateStats(wins: number, losses: number): void {
    const user = this.currentUser();
    if (user && !user.isGuest) {
      const updatedUser = { ...user, wins: user.wins + wins, losses: user.losses + losses };
      this.currentUser.set(updatedUser);
    }
  }
}
