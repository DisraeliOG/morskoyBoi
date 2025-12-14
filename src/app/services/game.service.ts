import { Injectable, signal, WritableSignal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { UserService } from './user.service';

export interface Cell {
  status: 'empty' | 'ship' | 'hit' | 'miss' | 'sunk';
  shipId: number | null;
}

export interface Game {
  id?: number | string;
  player1Id: string;
  player2Id: string | null;
  player1Email?: string;
  player2Email?: string | null;
  board1: Cell[];
  board2: Cell[];
  turn: string;
  status: 'waiting' | 'active' | 'finished';
  winnerId: string | null;
}

const BOARD_SIZE = 100;
const API_URL = 'http://localhost:3000/games';

@Injectable({
  providedIn: 'root'
})
export class GameService {

  public game: WritableSignal<Game | null> = signal(null);

  constructor(
    private http: HttpClient,
    private userService: UserService
  ) {}

  createLobby(userId: string, userEmail: string): void {
    this.http.get<Game[]>(API_URL).subscribe(games => {
      const mine = games.filter(g => g.player1Id === userId || g.player2Id === userId);
      let deleted = 0;
      const toDelete = mine.length;

      const finishCreate = () => {
        const board = this.generateBoard();
        this.createGameWithBoard(userId, userEmail, board);
      };

      if (toDelete === 0) {
        finishCreate();
        return;
      }

      mine.forEach(g => {
        if (g.id) {
          this.http.delete(`${API_URL}/${g.id}`).subscribe({
            next: () => { deleted++; if (deleted === toDelete) finishCreate(); },
            error: () => { deleted++; if (deleted === toDelete) finishCreate(); }
          });
        } else {
          deleted++; if (deleted === toDelete) finishCreate();
        }
      });
    });
  }

  createLobbyWithBoard(userId: string, userEmail: string, board: Cell[]): void {
    this.http.get<Game[]>(API_URL).subscribe(games => {
      const mine = games.filter(g => g.player1Id === userId || g.player2Id === userId);
      let deleted = 0;
      const toDelete = mine.length;

      const finishCreate = () => this.createGameWithBoard(userId, userEmail, board);

      if (toDelete === 0) {
        finishCreate();
        return;
      }

      mine.forEach(g => {
        if (g.id) {
          this.http.delete(`${API_URL}/${g.id}`).subscribe({
            next: () => { deleted++; if (deleted === toDelete) finishCreate(); },
            error: () => { deleted++; if (deleted === toDelete) finishCreate(); }
          });
        } else {
          deleted++; if (deleted === toDelete) finishCreate();
        }
      });
    });
  }

  listWaitingGames() {
    return this.http.get<Game[]>(`${API_URL}?status=waiting`).pipe(
      catchError((error) => {
        console.error('Ошибка при получении списка игр:', error);
        return of([] as Game[]);
      })
    );
  }

  joinById(gameId: string | number, userId: string, userEmail: string) {
    this.http.get<Game>(`${API_URL}/${gameId}`).subscribe(g => {
      if (!g || g.status !== 'waiting' || g.player1Id === userId || g.player2Id) return;
      const board = this.generateBoard();
      this.joinGameWithBoard(g, userId, userEmail, board);
    });
  }

  joinByIdWithBoard(gameId: string | number, userId: string, userEmail: string, board: Cell[]) {
    this.http.get<Game>(`${API_URL}/${gameId}`).subscribe(g => {
      if (!g || g.status !== 'waiting' || g.player1Id === userId || g.player2Id) return;
      this.joinGameWithBoard(g, userId, userEmail, board);
    });
  }

  leaveGame(): void {
    const game = this.game();
    if (!game || !game.id) {
      this.game.set(null);
      return;
    }
    this.http.delete(`${API_URL}/${game.id}`).subscribe({
      next: () => {
        this.game.set(null);
      },
      error: (error) => {
        console.error('Ошибка при выходе из игры:', error);
        this.game.set(null);
      }
    });
  }

  resetUserGames(userId: string): void {
    this.http.get<Game[]>(API_URL).subscribe(games => {
      const mine = games.filter(g => g.player1Id === userId || g.player2Id === userId);
      mine.forEach(g => {
        if (g.id) {
          this.http.delete(`${API_URL}/${g.id}`).subscribe();
        }
      });
      this.game.set(null);
    });
  }

  joinGameWithBoard(game: Game, userId: string, userEmail: string, board: Cell[]): void {
    const updatedGame = {
      ...game,
      player2Id: userId,
      player2Email: userEmail,
      board2: board,
      status: 'active',
      turn: game.player1Id
    };

    this.http.put<Game>(`${API_URL}/${game.id}`, updatedGame)
      .subscribe({
        next: (updatedGame) => {
          this.game.set(updatedGame);
        },
        error: (error) => {
          console.error('Ошибка при присоединении к игре:', error);
        }
      });
  }

  createGameWithBoard(userId: string, userEmail: string, board: Cell[]): void {
    const emptyBoard = this.generateEmptyBoard();

    const newGame: Omit<Game, 'id'> = {
      player1Id: userId,
      player1Email: userEmail,
      player2Id: null,
      player2Email: null,
      board1: board,
      board2: emptyBoard,
      turn: userId,
      status: 'waiting',
      winnerId: null
    };

    this.http.post<Game>(API_URL, newGame)
      .subscribe({
        next: (createdGame) => {
          this.game.set(createdGame);
        },
        error: (error) => {
          console.error('Ошибка при создании игры:', error);
        }
      });
  }

  fire(cellIndex: number, userId: string): void {
    const game = this.game();
    if (!game) return;

    if (game.status !== 'active') return;
    if (!game.player2Id) return;
    if (game.turn !== userId) return;

    const targetBoardKey: 'board1' | 'board2' =
      userId === game.player1Id ? 'board2' : 'board1';

    let targetBoard = [...game[targetBoardKey]];
    const cell = targetBoard[cellIndex];

    if (cell.status === 'hit' || cell.status === 'miss' || cell.status === 'sunk') {
      return;
    }

    let isHit = false;
    if (cell.status === 'ship') {
      cell.status = 'hit';
      isHit = true;
      
      const shipId = cell.shipId;
      if (shipId !== null) {
        const shipCells = targetBoard.filter(c => c.shipId === shipId);
        const allHit = shipCells.every(c => c.status === 'hit' || c.status === 'sunk');
        if (allHit) {
          shipCells.forEach(c => {
            if (c.status === 'hit') c.status = 'sunk';
          });
        }
      }
    } else {
      cell.status = 'miss';
    }

    const updatedGame: any = {
      ...game,
      [targetBoardKey]: targetBoard
    };

    if (!isHit) {
      updatedGame.turn = userId === game.player1Id ? game.player2Id! : game.player1Id;
    }

    const opponentBoard = userId === game.player1Id ? game.board2 : game.board1;
    if (this.checkWinCondition(opponentBoard)) {
      updatedGame.status = 'finished';
      updatedGame.winnerId = userId;
      this.updateGameStats(updatedGame);
    }

    this.http.put<Game>(`${API_URL}/${game.id}`, updatedGame)
      .subscribe({
        next: (updatedGame) => {
          this.game.set(updatedGame);
        },
        error: (error) => {
          console.error('Ошибка при обновлении игры:', error);
        }
      });
  }

  getGameUpdates(userId: string): void {
    const game = this.game();
    if (!game) return;

    this.http.get<Game>(`${API_URL}/${game.id}`)
      .subscribe({
        next: (latestGame) => {
          this.game.set(latestGame);
        },
        error: (error) => {
          console.error('Ошибка при получении обновлений игры:', error);
        }
      });
  }

  private generateEmptyBoard(): Cell[] {
    return Array(BOARD_SIZE).fill(0).map(() => ({ status: 'empty', shipId: null }));
  }

  private generateBoard(): Cell[] {
    const board = this.generateEmptyBoard();
    const shipLengths = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1];
    let shipId = 1;

    for (const len of shipLengths) {
      this.placeShip(board, len, shipId);
      shipId++;
    }
    return board;
  }

  private placeShip(board: Cell[], length: number, shipId: number) {
    const maxAttempts = 100;
    let attempts = 0;
    while (attempts < maxAttempts) {
      attempts++;
      const horizontal = Math.random() > 0.5;
      const row = Math.floor(Math.random() * 10);
      const col = Math.floor(Math.random() * 10);

      if (horizontal) {
        if (col + length > 10) continue;
        const indexes = Array.from({ length }, (_, i) => row * 10 + col + i);
        if (indexes.some(i => board[i].status !== 'empty')) continue;
        indexes.forEach(i => board[i] = { status: 'ship', shipId });
        return;
      } else {
        if (row + length > 10) continue;
        const indexes = Array.from({ length }, (_, i) => (row + i) * 10 + col);
        if (indexes.some(i => board[i].status !== 'empty')) continue;
        indexes.forEach(i => board[i] = { status: 'ship', shipId });
        return;
      }
    }
  }

  private checkWinCondition(board: Cell[]): boolean {
    return !board.some(cell => cell.status === 'ship');
  }

  private updateGameStats(game: Game): void {
    if (!game.winnerId || !game.player1Id || !game.player2Id) return;

    const winnerId = game.winnerId;
    const loserId = winnerId === game.player1Id ? game.player2Id : game.player1Id;

    this.http.get<any>(`http://localhost:3000/users/${winnerId}`).subscribe(winner => {
      if (winner) {
        const updatedWinner = {
          ...winner,
          wins: (winner.wins || 0) + 1
        };
        this.http.put(`http://localhost:3000/users/${winnerId}`, updatedWinner).subscribe(() => {
          const currentUser = this.userService.currentUser();
          if (currentUser && currentUser.id?.toString() === winnerId) {
            this.userService.setUser(updatedWinner);
          }
        });
      }
    });

    this.http.get<any>(`http://localhost:3000/users/${loserId}`).subscribe(loser => {
      if (loser) {
        const updatedLoser = {
          ...loser,
          losses: (loser.losses || 0) + 1
        };
        this.http.put(`http://localhost:3000/users/${loserId}`, updatedLoser).subscribe(() => {
          const currentUser = this.userService.currentUser();
          if (currentUser && currentUser.id?.toString() === loserId) {
            this.userService.setUser(updatedLoser);
          }
        });
      }
    });
  }
}
