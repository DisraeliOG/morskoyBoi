import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Cell } from '../../services/game.service';

@Component({
  selector: 'app-board',
  standalone: true,
  templateUrl: './board.component.html',
  styleUrls: ['./board.component.css'],
  imports: [CommonModule]
})
export class BoardComponent {

  @Input() cells: Cell[] = [];
  @Input() isEnemy: boolean = false;
  @Input() disabled: boolean = true;
  @Output() cellClick = new EventEmitter<number>();

  rows = Array(10).fill(0).map((x, i) => i);
  cols = Array(10).fill(0).map((x, i) => i);

  getCellIndex(row: number, col: number): number {
    return row * 10 + col;
  }

  onCellClick(index: number): void {
    if (!this.disabled && this.isEnemy) {
      this.cellClick.emit(index);
    }
  }

  getCellClass(cell: Cell): string {
    if (this.isEnemy) {
      switch (cell.status) {
        case 'miss': return 'cell-miss';
        case 'hit': return 'cell-hit';
        case 'sunk': return 'cell-sunk';
        default: return 'cell-default';
      }
    } else {
      switch (cell.status) {
        case 'ship': return 'cell-ship';
        case 'hit': return 'cell-hit';
        case 'miss': return 'cell-miss';
        case 'sunk': return 'cell-sunk';
        default: return 'cell-default';
      }
    }
  }
}
