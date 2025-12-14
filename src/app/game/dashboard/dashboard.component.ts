import { Component, OnInit, signal, WritableSignal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ChartConfiguration, ChartType, Chart, registerables } from 'chart.js';
import { UserService, User } from '../../services/user.service';
import { BaseChartDirective } from 'ng2-charts';
import { CommonModule } from '@angular/common';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  templateUrl: './dashboard.component.html',
  imports: [
    CommonModule,
    BaseChartDirective
  ],
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {

  usersList: WritableSignal<User[]> = signal([]);

  public pieChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { 
        display: true, 
        position: 'top' 
      },
      title: { 
        display: true, 
        text: 'Моя статистика',
        font: {
          size: 16
        }
      },
      tooltip: {
        enabled: true
      }
    }
  };
  public pieChartData: ChartConfiguration['data'] = {
    labels: ['Победы', 'Поражения'],
    datasets: [{
      label: 'Игры',
      data: [0, 0],
      backgroundColor: ['#4CAF50', '#F44336'],
      hoverBackgroundColor: ['#66BB6A', '#E57373'],
      borderWidth: 2,
      borderColor: '#fff'
    }]
  };
  public pieChartType: ChartType = 'pie';

  constructor(
    private http: HttpClient,
    private userService: UserService
  ) {}

  ngOnInit() {
    this.loadLeaderboard();
    this.updatePieChart();
  }

  get currentUser() {
    return this.userService.currentUser();
  }

  loadLeaderboard() {
    this.http.get<User[]>('http://localhost:3000/users').subscribe({
      next: (users) => {
        const sortedUsers = users.sort((a, b) => b.wins - a.wins);
        this.usersList.set(sortedUsers);
      },
      error: (error) => {
        console.error('Ошибка при загрузке таблицы лидеров:', error);
      }
    });
  }

  trackByUserId(index: number, user: User) {
    return user.id ?? index;
  }

  updatePieChart() {
    const user = this.userService.currentUser();
    if (user) {
      const wins = user.wins || 0;
      const losses = user.losses || 0;
      
      this.pieChartData = {
        labels: ['Победы', 'Поражения'],
        datasets: [{
          data: [wins, losses],
          backgroundColor: ['#4CAF50', '#F44336'],
          hoverBackgroundColor: ['#66BB6A', '#E57373']
        }]
      };
    } else {
      this.pieChartData = {
        labels: ['Победы', 'Поражения'],
        datasets: [{
          data: [0, 0],
          backgroundColor: ['#4CAF50', '#F44336'],
          hoverBackgroundColor: ['#66BB6A', '#E57373']
        }]
      };
    }
  }
}
