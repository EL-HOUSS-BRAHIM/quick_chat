/**
 * Log Viewer Module
 * Handles viewing and filtering system logs
 */

import apiClient from '../../api/api-client.js';
import errorHandler from '../../core/error-handler.js';
import { eventBus } from '../../core/event-bus.js';
import { state } from '../../core/state.js';
import * as utils from '../../core/utils.js';

class LogViewer {
  constructor() {
    this.logs = [];
    this.filteredLogs = [];
    this.logTypes = ['all', 'info', 'warning', 'error', 'security', 'user'];
    this.currentFilter = 'all';
    this.pageSize = 20;
    this.currentPage = 1;
  }

  /**
   * Initialize log viewer
   */
  async init() {
    try {
      // Find elements
      this.elements = {
        logsTable: document.getElementById('logsTable') || document.querySelector('.logs-table tbody'),
        logTypeFilter: document.getElementById('logTypeFilter'),
        logSearch: document.getElementById('logSearch'),
        logPagination: document.getElementById('logPagination'),
        exportLogsBtn: document.getElementById('exportLogsBtn'),
        clearLogsBtn: document.getElementById('clearLogsBtn')
      };

      // Set up event listeners
      this.setupEventListeners();

      // Subscribe to global events
      this.setupGlobalEvents();
    } catch (error) {
      errorHandler.handleError(error, 'Failed to initialize log viewer');
    }
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Log type filter
    if (this.elements.logTypeFilter) {
      this.elements.logTypeFilter.addEventListener('change', (e) => {
        this.currentFilter = e.target.value;
        this.filterLogs();
      });
    }

    // Log search
    if (this.elements.logSearch) {
      this.elements.logSearch.addEventListener('input', (e) => {
        this.filterLogs(e.target.value);
      });
    }

    // Export logs button
    if (this.elements.exportLogsBtn) {
      this.elements.exportLogsBtn.addEventListener('click', this.exportLogs.bind(this));
    }

    // Clear logs button
    if (this.elements.clearLogsBtn) {
      this.elements.clearLogsBtn.addEventListener('click', this.clearLogs.bind(this));
    }
  }

  /**
   * Setup global event subscriptions
   */
  setupGlobalEvents() {
    // Listen for admin search events
    eventBus.subscribe('admin:search', ({ query }) => {
      if (this.elements.logSearch) {
        this.elements.logSearch.value = query;
        this.filterLogs(query);
      }
    });

    // Listen for tab changes
    eventBus.subscribe('admin:tabChanged', ({ tab }) => {
      if (tab === 'logs' && this.logs.length === 0) {
        this.loadLogs();
      }
    });
  }

  /**
   * Load logs from API
   */
  async loadLogs() {
    try {
      state.update('admin', { isLoading: true });

      const response = await apiClient.get('/api/admin.php', {
        action: 'get_logs'
      });

      if (response.success) {
        this.logs = response.data;
        this.filteredLogs = [...this.logs];
        state.update('admin', { logs: this.logs });
        this.currentPage = 1;
        this.renderLogs();
      } else {
        throw new Error(response.error || 'Failed to load logs');
      }
    } catch (error) {
      errorHandler.handleError(error, 'Failed to load logs');
    } finally {
      state.update('admin', { isLoading: false });
    }
  }

  /**
   * Filter logs based on type and search term
   */
  filterLogs(searchTerm = '') {
    // Start with all logs
    let filtered = [...this.logs];
    
    // Filter by type if not 'all'
    if (this.currentFilter !== 'all') {
      filtered = filtered.filter(log => log.type === this.currentFilter);
    }
    
    // Filter by search term if provided
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(log =>
        log.message.toLowerCase().includes(term) ||
        log.user_id.toString().includes(term) ||
        log.ip_address.includes(term)
      );
    }
    
    this.filteredLogs = filtered;
    this.currentPage = 1;
    this.renderLogs();
  }

  /**
   * Render logs to table
   */
  renderLogs() {
    if (!this.elements.logsTable) return;

    // Calculate pagination
    const totalPages = Math.ceil(this.filteredLogs.length / this.pageSize);
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    const currentLogs = this.filteredLogs.slice(startIndex, endIndex);

    // Clear existing rows
    this.elements.logsTable.innerHTML = '';

    if (currentLogs.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="5" class="no-results">No logs found</td>';
      this.elements.logsTable.appendChild(row);
      return;
    }

    // Render logs
    currentLogs.forEach(log => {
      const row = document.createElement('tr');
      row.className = `log-row ${log.type}`;
      
      row.innerHTML = `
        <td>${utils.formatDate(log.created_at, true)}</td>
        <td>
          <span class="log-type ${log.type}">${utils.escapeHtml(log.type)}</span>
        </td>
        <td>${utils.escapeHtml(log.message)}</td>
        <td>${log.user_id ? `<a href="profile.php?id=${log.user_id}">${utils.escapeHtml(log.username || log.user_id)}</a>` : 'System'}</td>
        <td>${utils.escapeHtml(log.ip_address)}</td>
      `;
      
      this.elements.logsTable.appendChild(row);
    });

    // Update pagination
    this.renderPagination(totalPages);
  }

  /**
   * Render pagination controls
   */
  renderPagination(totalPages) {
    if (!this.elements.logPagination) return;
    
    if (totalPages <= 1) {
      this.elements.logPagination.innerHTML = '';
      return;
    }

    let html = '';
    // Previous button
    html += `<button class="pagination-btn ${this.currentPage === 1 ? 'disabled' : ''}" 
              ${this.currentPage === 1 ? 'disabled' : `onclick="changeLogPage(${this.currentPage - 1})"`}>
              <i class="fas fa-chevron-left"></i>
            </button>`;
    
    // Page buttons
    const pageToShow = 5;
    const startPage = Math.max(1, this.currentPage - Math.floor(pageToShow / 2));
    const endPage = Math.min(totalPages, startPage + pageToShow - 1);
    
    for (let i = startPage; i <= endPage; i++) {
      html += `<button class="pagination-btn ${i === this.currentPage ? 'active' : ''}" 
                onclick="changeLogPage(${i})">${i}</button>`;
    }
    
    // Next button
    html += `<button class="pagination-btn ${this.currentPage === totalPages ? 'disabled' : ''}" 
              ${this.currentPage === totalPages ? 'disabled' : `onclick="changeLogPage(${this.currentPage + 1})"`}>
              <i class="fas fa-chevron-right"></i>
            </button>`;
    
    this.elements.logPagination.innerHTML = html;
    
    // Add global function for pagination
    window.changeLogPage = (page) => {
      this.currentPage = page;
      this.renderLogs();
    };
  }

  /**
   * Export logs as CSV
   */
  async exportLogs() {
    try {
      // Prepare CSV content
      const headers = ['Date', 'Type', 'Message', 'User', 'IP Address'];
      let csvContent = headers.join(',') + '\n';
      
      // Add filtered logs to CSV
      this.filteredLogs.forEach(log => {
        const row = [
          `"${log.created_at}"`,
          `"${log.type}"`,
          `"${log.message.replace(/"/g, '""')}"`,
          `"${log.username || log.user_id || 'System'}"`,
          `"${log.ip_address}"`
        ];
        csvContent += row.join(',') + '\n';
      });
      
      // Create download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `logs_export_${new Date().toISOString().slice(0, 10)}.csv`);
      link.style.display = 'none';
      document.body.appendChild(link);
      
      // Trigger download
      link.click();
      
      // Clean up
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      utils.showToast('Logs exported successfully', 'success');
    } catch (error) {
      errorHandler.handleError(error, 'Failed to export logs');
    }
  }

  /**
   * Clear all logs
   */
  async clearLogs() {
    if (!confirm('Are you sure you want to clear all logs? This action cannot be undone.')) {
      return;
    }
    
    try {
      state.update('admin', { isLoading: true });
      
      const response = await apiClient.post('/api/admin.php', {}, { action: 'clear_logs' });
      
      if (response.success) {
        this.logs = [];
        this.filteredLogs = [];
        state.update('admin', { logs: [] });
        this.renderLogs();
        utils.showToast('Logs cleared successfully', 'success');
      } else {
        throw new Error(response.error || 'Failed to clear logs');
      }
    } catch (error) {
      errorHandler.handleError(error, 'Failed to clear logs');
    } finally {
      state.update('admin', { isLoading: false });
    }
  }
}

export default LogViewer;
