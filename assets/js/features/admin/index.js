/**
 * Admin Module
 * Handles admin dashboard functionality
 */

import app from '../../core/app.js';
import apiClient from '../../api/api-client.js';
import errorHandler from '../../core/error-handler.js';
import { eventBus } from '../../core/event-bus.js';
import { state } from '../../core/state.js';
import UserManager from './user-manager.js';
import StatsManager from './stats-manager.js';
import ConfigManager from './config-manager.js';
import LogViewer from './log-viewer.js';

class AdminModule {
  constructor() {
    this.state = {
      currentTab: 'dashboard',
      isLoading: false
    };
    
    // Initialize sub-modules
    this.userManager = new UserManager();
    this.statsManager = new StatsManager();
    this.configManager = new ConfigManager();
    this.logViewer = new LogViewer();

    // Register in global state
    state.register('admin', {
      currentTab: 'dashboard',
      users: [],
      stats: {},
      logs: [],
      isLoading: false
    });
  }

  /**
   * Initialize admin module
   */
  async init() {
    try {
      // Find tab elements
      this.elements = {
        tabButtons: document.querySelectorAll('.tab-btn'),
        tabContents: document.querySelectorAll('.tab-content'),
        loadingIndicator: document.querySelector('.admin-loading-indicator')
      };
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Initialize sub-modules
      await Promise.all([
        this.userManager.init(),
        this.statsManager.init(),
        this.configManager.init(),
        this.logViewer.init()
      ]);
      
      // Load initial data
      await this.loadData();

      // Add global event listeners
      this.addGlobalEventListeners();
    } catch (error) {
      console.error('Error initializing admin module:', error);
      errorHandler.handleError(error, 'Failed to initialize admin panel');
    }
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Implement tab switching through delegation
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab-btn') || e.target.closest('.tab-btn')) {
        const btn = e.target.classList.contains('tab-btn') ? e.target : e.target.closest('.tab-btn');
        const tabName = btn.getAttribute('onclick').match(/switchTab\('(.+?)'\)/)[1];
        this.switchTab(tabName);
        e.preventDefault();
      }
    });

    // Search functionality
    const searchInput = document.getElementById('adminSearch');
    if (searchInput) {
      searchInput.addEventListener('input', this.handleSearch.bind(this));
    }

    // Refresh data button
    const refreshBtn = document.getElementById('refreshDataBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadData());
    }
  }

  /**
   * Add global event listeners for communication between modules
   */
  addGlobalEventListeners() {
    // Listen for user updates from user manager
    eventBus.subscribe('admin:userUpdated', () => {
      this.statsManager.loadStats();
    });
    
    // Listen for settings updates
    eventBus.subscribe('admin:settingsUpdated', () => {
      // Reload necessary data after settings change
      this.loadData();
    });
  }

  /**
   * Switch between admin tabs
   */
  switchTab(tabName) {
    // Update state
    this.state.currentTab = tabName;
    state.update('admin', { currentTab: tabName });
    
    // Update UI
    this.elements.tabButtons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('onclick').includes(`'${tabName}'`));
    });
    
    this.elements.tabContents.forEach(content => {
      const contentId = content.id;
      content.classList.toggle('active', contentId === `${tabName}Tab`);
    });
    
    // Trigger event for sub-modules
    eventBus.publish('admin:tabChanged', { tab: tabName });
    
    // Load tab-specific data if needed
    this.loadTabData(tabName);
  }
  
  /**
   * Load data specific to the selected tab
   */
  async loadTabData(tabName) {
    switch (tabName) {
      case 'users':
        await this.userManager.loadUsers();
        break;
      case 'logs':
        await this.logViewer.loadLogs();
        break;
      case 'settings':
        await this.configManager.loadSettings();
        break;
      case 'system':
        await this.statsManager.loadSystemInfo();
        break;
      // other tabs can be added here
    }
  }

  /**
   * Handle search across admin panel
   */
  handleSearch(e) {
    const query = e.target.value.toLowerCase().trim();
    eventBus.publish('admin:search', { query });
  }

  /**
   * Load admin data
   */
  async loadData() {
    try {
      this.state.isLoading = true;
      state.update('admin', { isLoading: true });
      this.updateLoadingState();
      
      // Load essential data
      await Promise.all([
        this.statsManager.loadStats(),
        this.userManager.loadUsers()
      ]);
      
      // Load data for current tab
      await this.loadTabData(this.state.currentTab);
      
      this.state.isLoading = false;
      state.update('admin', { isLoading: false });
      this.updateLoadingState();
    } catch (error) {
      this.state.isLoading = false;
      state.update('admin', { isLoading: false });
      this.updateLoadingState();
      errorHandler.handleError(error, 'Failed to load admin data');
    }
  }

  /**
   * Update loading state
   */
  updateLoadingState() {
    if (this.elements.loadingIndicator) {
      this.elements.loadingIndicator.style.display = this.state.isLoading ? 'block' : 'none';
    }
  }
}

export default AdminModule;
