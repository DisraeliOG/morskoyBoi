import {Component, OnDestroy, OnInit, WritableSignal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {BoardComponent} from '../board/board.component';
import {Game, GameService, Cell} from '../../services/game.service';
import {UserService} from '../../services/user.service';
import {signal, WritableSignal as NgWritableSignal} from '@angular/core';

@Component({
  selector: 'app-game',
  standalone: true,
  templateUrl: './game.component.html',
  imports: [
    CommonModule,
    BoardComponent
  ],
  styleUrls: ['./game.component.css']
})
export class GameComponent implements OnInit, OnDestroy {

  myId: string | undefined;
  myEmail: string | undefined;

  game: WritableSignal<Game | null>;
  waitingGames: NgWritableSignal<Game[]> = signal([]);
  
  placementBoard: Cell[] = [];
  selectedShip: { length: number; count: number; name: string; placed: number } | null = null;
  selectedOrientation: 'horizontal' | 'vertical' = 'horizontal';
  previewCells: number[] = [];
  private shipIdCounter = 1;
  
  shipTypes = [
    { length: 4, count: 1, name: 'Линкор (4)', placed: 0 },
    { length: 3, count: 2, name: 'Крейсер (3)', placed: 0 },
    { length: 2, count: 3, name: 'Эсминец (2)', placed: 0 },
    { length: 1, count: 4, name: 'Катер (1)', placed: 0 }
  ];
  
  placementRows = Array(10).fill(0).map((x, i) => i);
  placementCols = Array(10).fill(0).map((x, i) => i);

  private gameUpdateInterval: any;

  constructor(
    protected gameService: GameService,
    private userService: UserService
  ) {
    this.game = this.gameService.game;
    this.myId = this.userService.currentUser()?.id?.toString();
    this.myEmail = this.userService.currentUser()?.email;
  }

  ngOnInit() {
    const latestId = this.userService.currentUser()?.id?.toString();
    const latestEmail = this.userService.currentUser()?.email;
    if (latestId) this.myId = latestId;
    if (latestEmail) this.myEmail = latestEmail;

    const current = this.game();
    if (current && this.myId &&
      current.player1Id !== this.myId &&
      current.player2Id !== this.myId) {
      this.game.set(null);
    }

    this.resetPlacementBoard();
    this.refreshWaiting();

    this.gameUpdateInterval = setInterval(() => {
      const currentGame = this.game();
      if (currentGame && this.myId && 
          (currentGame.player1Id === this.myId || currentGame.player2Id === this.myId)) {
        this.gameService.getGameUpdates(this.myId);
      }
      this.refreshWaiting(false);
    }, 3000);
  }

  ngOnDestroy() {
    if (this.gameUpdateInterval) {
      clearInterval(this.gameUpdateInterval);
    }
  }

  get myBoard() {
    const g = this.game();
    if (!g || !this.myId) return [];
    return this.myId === g.player1Id ? g.board1 : g.board2;
  }

  get enemyBoard() {
    const g = this.game();
    if (!g || !this.myId) return [];
    return this.myId === g.player1Id ? g.board2 : g.board1;
  }

  fire(cellIndex: number) {
    if (this.myId) {
      this.gameService.fire(cellIndex, this.myId);
    }
  }

  startGame() {
    if (!this.myId) return;
    
    const isAllPlaced = this.isAllShipsPlaced();
    const boardToUse = isAllPlaced ? [...this.placementBoard] : null;
    
    if (boardToUse) {
      this.gameService.createLobbyWithBoard(this.myId, this.myEmail ?? '', boardToUse);
    } else {
      this.gameService.createLobby(this.myId, this.myEmail ?? '');
    }
    
    this.refreshWaiting(false);
  }

  joinGame(gameId: number | string) {
    if (!this.myId) return;
    
    const isAllPlaced = this.isAllShipsPlaced();
    const boardToUse = isAllPlaced ? [...this.placementBoard] : null;
    
    if (boardToUse) {
      this.gameService.joinByIdWithBoard(gameId, this.myId, this.myEmail ?? '', boardToUse);
    } else {
      this.gameService.joinById(gameId, this.myId, this.myEmail ?? '');
    }
  }

  resetPlacementBoard() {
    this.placementBoard = Array(100).fill(0).map(() => ({ status: 'empty' as const, shipId: null }));
    this.shipTypes.forEach(st => st.placed = 0);
    this.shipIdCounter = 1;
    this.selectedShip = null;
    this.previewCells = [];
  }

  selectShip(shipType: { length: number; count: number; name: string; placed: number }) {
    if (shipType.placed < shipType.count) {
      this.selectedShip = shipType;
      this.previewCells = [];
    }
  }

  toggleOrientation() {
    this.selectedOrientation = this.selectedOrientation === 'horizontal' ? 'vertical' : 'horizontal';
    this.previewCells = [];
  }

  getPlacementCellIndex(row: number, col: number): number {
    return row * 10 + col;
  }

  onPlacementCellHover(row: number, col: number) {
    if (!this.selectedShip || this.selectedShip.placed >= this.selectedShip.count) {
      this.previewCells = [];
      return;
    }

    const length = this.selectedShip.length;
    const cells: number[] = [];

    if (this.selectedOrientation === 'horizontal') {
      if (col + length > 10) return;
      for (let i = 0; i < length; i++) {
        cells.push(this.getPlacementCellIndex(row, col + i));
      }
    } else {
      if (row + length > 10) return;
      for (let i = 0; i < length; i++) {
        cells.push(this.getPlacementCellIndex(row + i, col));
      }
    }

    if (this.canPlaceShip(cells)) {
      this.previewCells = cells;
    } else {
      this.previewCells = [];
    }
  }

  onPlacementCellClick(row: number, col: number) {
    const cellIndex = this.getPlacementCellIndex(row, col);
    const cell = this.placementBoard[cellIndex];
    
    if (cell.status === 'ship' && cell.shipId !== null) {
      this.removeShip(cell.shipId);
      return;
    }

    if (!this.selectedShip || this.selectedShip.placed >= this.selectedShip.count) return;

    const length = this.selectedShip.length;
    const cells: number[] = [];

    if (this.selectedOrientation === 'horizontal') {
      if (col + length > 10) return;
      for (let i = 0; i < length; i++) {
        cells.push(this.getPlacementCellIndex(row, col + i));
      }
    } else {
      if (row + length > 10) return;
      for (let i = 0; i < length; i++) {
        cells.push(this.getPlacementCellIndex(row + i, col));
      }
    }

    if (this.canPlaceShip(cells)) {
      this.placeShip(cells);
    }
  }

  canPlaceShip(cells: number[]): boolean {
    for (const cellIndex of cells) {
      if (this.placementBoard[cellIndex].status !== 'empty') {
        return false;
      }
    }

    for (const cellIndex of cells) {
      const row = Math.floor(cellIndex / 10);
      const col = cellIndex % 10;

      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const newRow = row + dr;
          const newCol = col + dc;

          if (newRow >= 0 && newRow < 10 && newCol >= 0 && newCol < 10) {
            const neighborIndex = this.getPlacementCellIndex(newRow, newCol);
            if (!cells.includes(neighborIndex) && this.placementBoard[neighborIndex].status === 'ship') {
              return false;
            }
          }
        }
      }
    }

    return true;
  }

  placeShip(cells: number[]) {
    const shipId = this.shipIdCounter++;
    cells.forEach(cellIndex => {
      this.placementBoard[cellIndex] = { status: 'ship', shipId };
    });

    if (this.selectedShip) {
      this.selectedShip.placed++;
    }

    this.previewCells = [];
    this.selectedShip = null;
  }

  removeShip(shipId: number) {
    let shipLength = 0;
    this.placementBoard.forEach(cell => {
      if (cell.shipId === shipId) {
        cell.status = 'empty';
        cell.shipId = null;
        shipLength++;
      }
    });

    const shipType = this.shipTypes.find(st => st.length === shipLength);
    if (shipType && shipType.placed > 0) {
      shipType.placed--;
    }
  }

  getPlacementCellClass(index: number): string {
    if (this.previewCells.includes(index)) {
      return 'cell-preview';
    }
    const cell = this.placementBoard[index];
    if (!cell) return 'cell-default';
    switch (cell.status) {
      case 'ship': return 'cell-ship';
      default: return 'cell-default';
    }
  }

  isAllShipsPlaced(): boolean {
    return this.shipTypes.every(st => st.placed === st.count);
  }

  refreshWaiting(withClear: boolean = true) {
    if (withClear) this.waitingGames.set([]);
    this.gameService.listWaitingGames().subscribe(g => {
      const filtered = g.filter(game => 
        game.player1Id !== this.myId && game.player2Id !== this.myId
      );
      this.waitingGames.set(filtered);
    });
  }

  leaveGame() {
    this.gameService.leaveGame();
    this.refreshWaiting();
  }

  trackByGameId(index: number, game: Game): any {
    return game.id;
  }

  getShipLengthArray(length: number): number[] {
    return Array(length).fill(0);
  }

  getRowLetter(row: number): string {
    return String.fromCharCode(65 + row);
  }
}
