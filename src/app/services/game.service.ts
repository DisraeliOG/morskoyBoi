import { Injectable, signal, WritableSignal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
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
  shareLink?: string;
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
    if (!navigator.onLine) {
      return;
    }

    this.http.get<Game[]>(API_URL).subscribe({
      next: (games) => {
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
      },
      error: (error) => {
        if (!this.isNetworkError(error)) {
          console.error('Ошибка при получении списка игр для создания лобби:', error);
        }
      }
    });
  }

  createLobbyWithBoard(userId: string, userEmail: string, board: Cell[]): void {
    if (!navigator.onLine) {
      return;
    }

    this.http.get<Game[]>(API_URL).subscribe({
      next: (games) => {
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
      },
      error: (error) => {
        if (!this.isNetworkError(error)) {
          console.error('Ошибка при получении списка игр для создания лобби:', error);
        }
      }
    });
  }

  private isNetworkError(error: any): boolean {
    if (error instanceof HttpErrorResponse) {
      return error.status === 0;
    }
    const errorMessage = error?.message || error?.toString() || '';
    return errorMessage.includes('ERR_INTERNET_DISCONNECTED') || 
           errorMessage.includes('Failed to fetch') ||
           errorMessage.includes('NetworkError') ||
           !navigator.onLine;
  }

  listWaitingGames() {
    if (!navigator.onLine) {
      return of([] as Game[]);
    }

    return this.http.get<Game[]>(`${API_URL}?status=waiting`).pipe(
      catchError((error) => {
        if (!this.isNetworkError(error)) {
          console.error('Ошибка при получении списка игр:', error);
        }
        return of([] as Game[]);
      })
    );
  }

  joinById(gameId: string | number, userId: string, userEmail: string) {
    if (!navigator.onLine) {
      return;
    }
    this.http.get<Game>(`${API_URL}/${gameId}`).subscribe({
      next: (g) => {
        if (!g || g.status !== 'waiting' || g.player2Id) return;
        if (g.player1Id === userId) {
          return;
        }
        const board = this.generateBoard();
        this.joinGameWithBoard(g, userId, userEmail, board);
      },
      error: (error) => {
        if (!this.isNetworkError(error)) {
          console.error('Ошибка при получении игры:', error);
        }
      }
    });
  }

  joinByIdWithBoard(gameId: string | number, userId: string, userEmail: string, board: Cell[]) {
    if (!navigator.onLine) {
      return;
    }
    this.http.get<Game>(`${API_URL}/${gameId}`).subscribe({
      next: (g) => {
        if (!g || g.status !== 'waiting' || g.player2Id) return;
        if (g.player1Id === userId) {
          return;
        }
        this.joinGameWithBoard(g, userId, userEmail, board);
      },
      error: (error) => {
        if (!this.isNetworkError(error)) {
          console.error('Ошибка при получении игры:', error);
        }
      }
    });
  }

  leaveGame(): void {
    const game = this.game();
    if (!game || !game.id) {
      this.game.set(null);
      return;
    }
    if (!navigator.onLine) {
      this.game.set(null);
      return;
    }
    this.http.delete(`${API_URL}/${game.id}`).subscribe({
      next: () => {
        this.game.set(null);
      },
      error: (error) => {
        if (!this.isNetworkError(error)) {
          console.error('Ошибка при выходе из игры:', error);
        }
        this.game.set(null);
      }
    });
  }

  resetUserGames(userId: string): void {
    if (!navigator.onLine) {
      this.game.set(null);
      return;
    }
    this.http.get<Game[]>(API_URL).subscribe({
      next: (games) => {
        const mine = games.filter(g => g.player1Id === userId || g.player2Id === userId);
        mine.forEach(g => {
          if (g.id) {
            this.http.delete(`${API_URL}/${g.id}`).subscribe({
              error: (error) => {
                if (!this.isNetworkError(error)) {
                  console.error('Ошибка при удалении игры:', error);
                }
              }
            });
          }
        });
        this.game.set(null);
      },
      error: (error) => {
        if (!this.isNetworkError(error)) {
          console.error('Ошибка при получении списка игр для сброса:', error);
        }
        this.game.set(null);
      }
    });
  }

  joinGameWithBoard(game: Game, userId: string, userEmail: string, board: Cell[]): void {
    if (!navigator.onLine) {
      return;
    }

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
          if (!this.isNetworkError(error)) {
            console.error('Ошибка при присоединении к игре:', error);
          }
        }
      });
  }

  generateShareLink(gameId: number | string): string {
    const baseUrl = window.location.origin;
    return `${baseUrl}/game?join=${gameId}`;
  }

  createGameWithBoard(userId: string, userEmail: string, board: Cell[]): void {
    if (!navigator.onLine) {
      return;
    }

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
          if (createdGame.id) {
            const shareLink = this.generateShareLink(createdGame.id);
            const updatedGame = { ...createdGame, shareLink };
            this.http.put<Game>(`${API_URL}/${createdGame.id}`, updatedGame).subscribe({
              next: (gameWithLink) => {
                this.game.set(gameWithLink);
              },
              error: () => {
                this.game.set(createdGame);
              }
            });
          } else {
            this.game.set(createdGame);
          }
        },
        error: (error) => {
          if (!this.isNetworkError(error)) {
            console.error('Ошибка при создании игры:', error);
          }
        }
      });
  }

  joinByLink(gameId: string | number, userId: string, userEmail: string, board?: Cell[]): void {
    if (!navigator.onLine) {
      return;
    }

    this.http.get<Game>(`${API_URL}/${gameId}`).subscribe({
      next: (g) => {
        if (!g || g.status !== 'waiting' || g.player2Id) {
          return;
        }
        if (g.player1Id === userId) {
          return;
        }
        const boardToUse = board || this.generateBoard();
        this.joinGameWithBoard(g, userId, userEmail, boardToUse);
      },
      error: (error) => {
        if (!this.isNetworkError(error)) {
          console.error('Ошибка при получении игры по ссылке:', error);
        }
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

    if (!navigator.onLine) {
      return;
    }

    this.http.put<Game>(`${API_URL}/${game.id}`, updatedGame)
      .subscribe({
        next: (updatedGame) => {
          this.game.set(updatedGame);
        },
        error: (error) => {
          if (!this.isNetworkError(error)) {
            console.error('Ошибка при обновлении игры:', error);
          }
        }
      });
  }

  getGameUpdates(userId: string): void {
    const game = this.game();
    if (!game) return;

    if (!navigator.onLine) {
      return;
    }

    this.http.get<Game>(`${API_URL}/${game.id}`)
      .subscribe({
        next: (latestGame) => {
          this.game.set(latestGame);
        },
        error: (error) => {
          if (!this.isNetworkError(error)) {
            console.error('Ошибка при получении обновлений игры:', error);
          }
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

  private canPlaceShipAt(board: Cell[], indexes: number[]): boolean {
    for (const cellIndex of indexes) {
      if (board[cellIndex].status !== 'empty') {
        return false;
      }
    }

    for (const cellIndex of indexes) {
      const row = Math.floor(cellIndex / 10);
      const col = cellIndex % 10;

      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const newRow = row + dr;
          const newCol = col + dc;

          if (newRow >= 0 && newRow < 10 && newCol >= 0 && newCol < 10) {
            const neighborIndex = newRow * 10 + newCol;
            if (!indexes.includes(neighborIndex) && board[neighborIndex].status === 'ship') {
              return false;
            }
          }
        }
      }
    }

    return true;
  }

  private placeShip(board: Cell[], length: number, shipId: number) {
    const maxAttempts = 1000;
    let attempts = 0;
    while (attempts < maxAttempts) {
      attempts++;
      const horizontal = Math.random() > 0.5;
      const row = Math.floor(Math.random() * 10);
      const col = Math.floor(Math.random() * 10);

      let indexes: number[];
      if (horizontal) {
        if (col + length > 10) continue;
        indexes = Array.from({ length }, (_, i) => row * 10 + col + i);
      } else {
        if (row + length > 10) continue;
        indexes = Array.from({ length }, (_, i) => (row + i) * 10 + col);
      }

      if (this.canPlaceShipAt(board, indexes)) {
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
    if (!navigator.onLine) return;

    const winnerId = game.winnerId;
    const loserId = winnerId === game.player1Id ? game.player2Id : game.player1Id;

    this.http.get<any>(`http://localhost:3000/users/${winnerId}`).subscribe({
      next: (winner) => {
        if (winner) {
          const updatedWinner = {
            ...winner,
            wins: (winner.wins || 0) + 1
          };
          this.http.put(`http://localhost:3000/users/${winnerId}`, updatedWinner).subscribe({
            next: () => {
              const currentUser = this.userService.currentUser();
              if (currentUser && currentUser.id?.toString() === winnerId) {
                this.userService.setUser(updatedWinner);
              }
            },
            error: (error) => {
              if (!this.isNetworkError(error)) {
                console.error('Ошибка при обновлении статистики победителя:', error);
              }
            }
          });
        }
      },
      error: (error) => {
        if (!this.isNetworkError(error)) {
          console.error('Ошибка при получении данных победителя:', error);
        }
      }
    });

    this.http.get<any>(`http://localhost:3000/users/${loserId}`).subscribe({
      next: (loser) => {
        if (loser) {
          const updatedLoser = {
            ...loser,
            losses: (loser.losses || 0) + 1
          };
          this.http.put(`http://localhost:3000/users/${loserId}`, updatedLoser).subscribe({
            next: () => {
              const currentUser = this.userService.currentUser();
              if (currentUser && currentUser.id?.toString() === loserId) {
                this.userService.setUser(updatedLoser);
              }
            },
            error: (error) => {
              if (!this.isNetworkError(error)) {
                console.error('Ошибка при обновлении статистики проигравшего:', error);
              }
            }
          });
        }
      },
      error: (error) => {
        if (!this.isNetworkError(error)) {
          console.error('Ошибка при получении данных проигравшего:', error);
        }
      }
    });
  }
}
