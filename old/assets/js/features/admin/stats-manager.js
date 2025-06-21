/**
 * Stats Manager Module
 * Handles admin statistics and charts
 */

import apiClient from '../../api/api-client.js';
import errorHandler from '../../core/error-handler.js';
import { state } from '../../core/state.js';
import * as utils from '../../core/utils.js';

class StatsManager {
  constructor() {
    this.stats = {};
    this.systemInfo = {};
    this.charts = {};
  }

  /**
   * Initialize stats manager
   */
  async init() {
    try {
      // Find elements
      this.elements = {
        statsGrid: document.querySelector('.stats-grid'),
        userStatsChart: document.getElementById('userStatsChart'),
        messageStatsChart: document.getElementById('messageStatsChart'),
        systemInfoContainer: document.getElementById('systemInfoContainer')
      };

      // Load and initialize charts library if needed
      await this.ensureChartLibrary();
    } catch (error) {
      errorHandler.handleError(error, 'Failed to initialize stats manager');
    }
  }

  /**
   * Ensure Chart.js is loaded
   */
  async ensureChartLibrary() {
    if (window.Chart) return;

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'assets/js/chart.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Chart.js'));
      document.head.appendChild(script);
    });
  }

  /**
   * Load stats from API
   */
  async loadStats() {
    try {
      state.update('admin', { isLoading: true });

      const response = await apiClient.get('/api/admin.php', {
        action: 'get_stats'
      });

      if (response.success) {
        this.stats = response.data;
        state.update('admin', { stats: this.stats });
        this.updateStatsDisplay();
        this.initCharts();
      } else {
        throw new Error(response.error || 'Failed to load stats');
      }
    } catch (error) {
      errorHandler.handleError(error, 'Failed to load statistics');
    } finally {
      state.update('admin', { isLoading: false });
    }
  }

  /**
   * Load system information
   */
  async loadSystemInfo() {
    try {
      state.update('admin', { isLoading: true });

      const response = await apiClient.get('/api/admin.php', {
        action: 'get_system_info'
      });

      if (response.success) {
        this.systemInfo = response.data;
        this.updateSystemInfoDisplay();
      } else {
        throw new Error(response.error || 'Failed to load system information');
      }
    } catch (error) {
      errorHandler.handleError(error, 'Failed to load system information');
    } finally {
      state.update('admin', { isLoading: false });
    }
  }

  /**
   * Update stats cards display
   */
  updateStatsDisplay() {
    // Update stats cards if they exist
    const statsCards = document.querySelectorAll('.stat-card');
    if (statsCards.length > 0) {
      // Map stats data to cards
      const statsMap = {
        'total_users': { selector: '.stat-card:nth-child(1) h3', formatter: utils.formatNumber },
        'online_users': { selector: '.stat-card:nth-child(2) h3', formatter: utils.formatNumber },
        'total_messages': { selector: '.stat-card:nth-child(3) h3', formatter: utils.formatNumber },
        'total_sessions': { selector: '.stat-card:nth-child(4) h3', formatter: utils.formatNumber }
      };
      
      // Update each stat card
      Object.entries(statsMap).forEach(([key, { selector, formatter }]) => {
        const element = document.querySelector(selector);
        if (element && this.stats[key] !== undefined) {
          element.textContent = formatter(this.stats[key]);
        }
      });
      
      // Update weekly change
      const weeklyUserChange = document.querySelector('.stat-card:nth-child(1) .stat-change');
      if (weeklyUserChange && this.stats.new_users_week !== undefined) {
        weeklyUserChange.textContent = `+${utils.formatNumber(this.stats.new_users_week)} this week`;
      }
      
      // Update daily active users
      const dailyActive = document.querySelector('.stat-card:nth-child(2) .stat-change');
      if (dailyActive && this.stats.active_users !== undefined) {
        dailyActive.textContent = `${utils.formatNumber(this.stats.active_users)} active today`;
      }
      
      // Update daily messages
      const dailyMessages = document.querySelector('.stat-card:nth-child(3) .stat-change');
      if (dailyMessages && this.stats.messages_today !== undefined) {
        dailyMessages.textContent = `+${utils.formatNumber(this.stats.messages_today)} today`;
      }
    }
  }

  /**
   * Update system info display
   */
  updateSystemInfoDisplay() {
    if (!this.elements.systemInfoContainer) return;
    
    const infoItems = [
      { label: 'PHP Version', value: this.systemInfo.php_version },
      { label: 'MySQL Version', value: this.systemInfo.mysql_version },
      { label: 'Server Software', value: this.systemInfo.server_software },
      { label: 'Server OS', value: this.systemInfo.server_os },
      { label: 'Memory Usage', value: `${this.systemInfo.memory_usage}MB / ${this.systemInfo.memory_limit}MB` },
      { label: 'Disk Usage', value: `${this.systemInfo.disk_used}GB / ${this.systemInfo.disk_total}GB (${this.systemInfo.disk_percent}%)` },
      { label: 'Upload Max Size', value: this.systemInfo.upload_max_size },
      { label: 'Post Max Size', value: this.systemInfo.post_max_size },
      { label: 'Max Execution Time', value: `${this.systemInfo.max_execution_time} seconds` }
    ];
    
    // Create system info table
    let html = '<table class="system-info-table">';
    infoItems.forEach(item => {
      html += `
        <tr>
          <td>${utils.escapeHtml(item.label)}</td>
          <td>${utils.escapeHtml(item.value || 'N/A')}</td>
        </tr>
      `;
    });
    html += '</table>';
    
    this.elements.systemInfoContainer.innerHTML = html;
  }

  /**
   * Initialize charts
   */
  initCharts() {
    if (!window.Chart) return;
    
    this.initUserChart();
    this.initMessageChart();
  }

  /**
   * Initialize user statistics chart
   */
  initUserChart() {
    if (!this.elements.userStatsChart) return;
    
    // Destroy existing chart if it exists
    if (this.charts.userChart) {
      this.charts.userChart.destroy();
    }
    
    const ctx = this.elements.userStatsChart.getContext('2d');
    
    // Use the data from stats
    const labels = this.stats.user_timeline ? this.stats.user_timeline.map(item => item.date) : [];
    const signups = this.stats.user_timeline ? this.stats.user_timeline.map(item => item.signups) : [];
    const active = this.stats.user_timeline ? this.stats.user_timeline.map(item => item.active) : [];
    
    this.charts.userChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'New Signups',
            data: signups,
            borderColor: '#4CAF50',
            backgroundColor: 'rgba(76, 175, 80, 0.1)',
            borderWidth: 2,
            tension: 0.3,
            fill: true
          },
          {
            label: 'Active Users',
            data: active,
            borderColor: '#2196F3',
            backgroundColor: 'rgba(33, 150, 243, 0.1)',
            borderWidth: 2,
            tension: 0.3,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
          },
          tooltip: {
            mode: 'index',
            intersect: false,
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }

  /**
   * Initialize message statistics chart
   */
  initMessageChart() {
    if (!this.elements.messageStatsChart) return;
    
    // Destroy existing chart if it exists
    if (this.charts.messageChart) {
      this.charts.messageChart.destroy();
    }
    
    const ctx = this.elements.messageStatsChart.getContext('2d');
    
    // Use the data from stats
    const labels = this.stats.message_timeline ? this.stats.message_timeline.map(item => item.date) : [];
    const messages = this.stats.message_timeline ? this.stats.message_timeline.map(item => item.count) : [];
    
    this.charts.messageChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Messages',
            data: messages,
            backgroundColor: 'rgba(255, 159, 64, 0.7)',
            borderColor: 'rgba(255, 159, 64, 1)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
          },
          tooltip: {
            mode: 'index',
            intersect: false,
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }
}

export default StatsManager;
