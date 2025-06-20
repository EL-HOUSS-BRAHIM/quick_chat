/**
 * Group Task Management System
 * 
 * Provides task lists and collaboration features for group chats
 * Part of the Advanced Group Features initiative (TODO: 75% → 90%)
 */

import { EventBus } from '../services/EventBus.js';
import { apiClient } from '../services/apiClient.js';
import { logger } from '../utils/logger.js';

export class GroupTaskManager {
  constructor(config = {}) {
    this.config = {
      groupId: config.groupId,
      currentUserId: config.currentUserId,
      container: config.container,
      ...config
    };

    this.eventBus = new EventBus();
    this.state = {
      tasks: [],
      isLoading: false,
      filter: 'all', // 'all', 'pending', 'completed', 'assigned'
      sortBy: 'created', // 'created', 'dueDate', 'priority'
    };

    this.init();
  }

  /**
   * Initialize task manager
   */
  async init() {
    try {
      this.render();
      this.setupEventListeners();
      await this.loadTasks();
      
      logger.info('Group task manager initialized', { groupId: this.config.groupId });
    } catch (error) {
      logger.error('Failed to initialize task manager:', error);
    }
  }

  /**
   * Render task manager UI
   */
  render() {
    if (!this.config.container) return;

    this.config.container.innerHTML = `
      <div class="group-task-manager">
        <div class="task-header">
          <h3>
            <i class="fas fa-tasks" aria-hidden="true"></i>
            Group Tasks
          </h3>
          <div class="task-controls">
            <button class="btn btn-primary btn-sm" id="add-task-btn">
              <i class="fas fa-plus" aria-hidden="true"></i>
              Add Task
            </button>
            <div class="task-filters">
              <select id="task-filter" aria-label="Filter tasks">
                <option value="all">All Tasks</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="assigned">Assigned to Me</option>
              </select>
              <select id="task-sort" aria-label="Sort tasks">
                <option value="created">Created Date</option>
                <option value="dueDate">Due Date</option>
                <option value="priority">Priority</option>
              </select>
            </div>
          </div>
        </div>
        
        <div class="task-list" id="task-list" role="list">
          <div class="loading-placeholder">
            <div class="spinner"></div>
            <span>Loading tasks...</span>
          </div>
        </div>
        
        <div class="task-stats">
          <div class="stat">
            <span class="stat-number" id="pending-count">0</span>
            <span class="stat-label">Pending</span>
          </div>
          <div class="stat">
            <span class="stat-number" id="completed-count">0</span>
            <span class="stat-label">Completed</span>
          </div>
          <div class="stat">
            <span class="stat-number" id="overdue-count">0</span>
            <span class="stat-label">Overdue</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    const addBtn = document.getElementById('add-task-btn');
    const filterSelect = document.getElementById('task-filter');
    const sortSelect = document.getElementById('task-sort');

    if (addBtn) {
      addBtn.addEventListener('click', () => this.showCreateTaskModal());
    }

    if (filterSelect) {
      filterSelect.addEventListener('change', (e) => {
        this.state.filter = e.target.value;
        this.renderTaskList();
      });
    }

    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.state.sortBy = e.target.value;
        this.renderTaskList();
      });
    }
  }

  /**
   * Load tasks from API
   */
  async loadTasks() {
    this.state.isLoading = true;
    
    try {
      const response = await apiClient.get(`/api/groups/${this.config.groupId}/tasks`);
      this.state.tasks = response.tasks || [];
      this.renderTaskList();
      this.updateStats();
    } catch (error) {
      logger.error('Failed to load tasks:', error);
      this.showError('Failed to load tasks');
    } finally {
      this.state.isLoading = false;
    }
  }

  /**
   * Render task list
   */
  renderTaskList() {
    const taskList = document.getElementById('task-list');
    if (!taskList) return;

    const filteredTasks = this.getFilteredTasks();
    const sortedTasks = this.getSortedTasks(filteredTasks);

    if (sortedTasks.length === 0) {
      taskList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-clipboard-list fa-3x" aria-hidden="true"></i>
          <h4>No tasks found</h4>
          <p>Create your first task to get started!</p>
        </div>
      `;
      return;
    }

    taskList.innerHTML = sortedTasks.map(task => this.renderTaskItem(task)).join('');
  }

  /**
   * Render individual task item
   */
  renderTaskItem(task) {
    const isOverdue = new Date(task.dueDate) < new Date() && task.status !== 'completed';
    const priorityClass = task.priority ? `priority-${task.priority}` : '';
    
    return `
      <div class="task-item ${priorityClass} ${task.status}" 
           data-task-id="${task.id}" 
           role="listitem">
        <div class="task-checkbox">
          <input type="checkbox" 
                 id="task-${task.id}" 
                 ${task.status === 'completed' ? 'checked' : ''}
                 onchange="window.taskManager.toggleTaskStatus('${task.id}')">
          <label for="task-${task.id}" class="sr-only">
            Mark task as ${task.status === 'completed' ? 'incomplete' : 'complete'}
          </label>
        </div>
        
        <div class="task-content">
          <div class="task-title">${this.escapeHtml(task.title)}</div>
          ${task.description ? `<div class="task-description">${this.escapeHtml(task.description)}</div>` : ''}
          
          <div class="task-meta">
            ${task.assignedTo ? `
              <span class="task-assignee">
                <i class="fas fa-user" aria-hidden="true"></i>
                ${this.escapeHtml(task.assignedToName)}
              </span>
            ` : ''}
            
            ${task.dueDate ? `
              <span class="task-due-date ${isOverdue ? 'overdue' : ''}">
                <i class="fas fa-calendar" aria-hidden="true"></i>
                ${this.formatDate(task.dueDate)}
                ${isOverdue ? '<span class="overdue-badge">Overdue</span>' : ''}
              </span>
            ` : ''}
            
            ${task.priority ? `
              <span class="task-priority priority-${task.priority}">
                ${this.getPriorityIcon(task.priority)}
                ${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
              </span>
            ` : ''}
          </div>
        </div>
        
        <div class="task-actions">
          <button class="btn btn-sm btn-outline" 
                  onclick="window.taskManager.editTask('${task.id}')"
                  aria-label="Edit task">
            <i class="fas fa-edit" aria-hidden="true"></i>
          </button>
          <button class="btn btn-sm btn-outline" 
                  onclick="window.taskManager.deleteTask('${task.id}')"
                  aria-label="Delete task">
            <i class="fas fa-trash" aria-hidden="true"></i>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Show create task modal
   */
  showCreateTaskModal() {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Create New Task</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <form id="create-task-form">
              <div class="mb-3">
                <label for="task-title" class="form-label">Title *</label>
                <input type="text" class="form-control" id="task-title" required>
              </div>
              
              <div class="mb-3">
                <label for="task-description" class="form-label">Description</label>
                <textarea class="form-control" id="task-description" rows="3"></textarea>
              </div>
              
              <div class="row">
                <div class="col-md-6">
                  <label for="task-assignee" class="form-label">Assign to</label>
                  <select class="form-control" id="task-assignee">
                    <option value="">Select member...</option>
                    <!-- Group members will be populated here -->
                  </select>
                </div>
                
                <div class="col-md-6">
                  <label for="task-priority" class="form-label">Priority</label>
                  <select class="form-control" id="task-priority">
                    <option value="low">Low</option>
                    <option value="medium" selected>Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              
              <div class="mb-3 mt-3">
                <label for="task-due-date" class="form-label">Due Date</label>
                <input type="datetime-local" class="form-control" id="task-due-date">
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" onclick="window.taskManager.createTask()">
              Create Task
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Load group members for assignment
    this.loadGroupMembers();
    
    // Show modal (assuming Bootstrap is available)
    if (window.bootstrap) {
      const bsModal = new bootstrap.Modal(modal);
      bsModal.show();
    }
  }

  /**
   * Create new task
   */
  async createTask() {
    const form = document.getElementById('create-task-form');
    const formData = new FormData(form);
    
    const taskData = {
      title: document.getElementById('task-title').value,
      description: document.getElementById('task-description').value,
      assignedTo: document.getElementById('task-assignee').value || null,
      priority: document.getElementById('task-priority').value,
      dueDate: document.getElementById('task-due-date').value || null,
      groupId: this.config.groupId,
      createdBy: this.config.currentUserId
    };

    try {
      const response = await apiClient.post(`/api/groups/${this.config.groupId}/tasks`, taskData);
      
      if (response.success) {
        this.state.tasks.push(response.task);
        this.renderTaskList();
        this.updateStats();
        
        // Close modal
        const modal = document.querySelector('.modal');
        if (modal && window.bootstrap) {
          bootstrap.Modal.getInstance(modal).hide();
        }
        
        // Emit event for real-time updates
        this.eventBus.emit('taskCreated', response.task);
        
        logger.info('Task created successfully', { taskId: response.task.id });
      }
    } catch (error) {
      logger.error('Failed to create task:', error);
      this.showError('Failed to create task');
    }
  }

  /**
   * Toggle task completion status
   */
  async toggleTaskStatus(taskId) {
    const task = this.state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const newStatus = task.status === 'completed' ? 'pending' : 'completed';

    try {
      const response = await apiClient.put(`/api/groups/${this.config.groupId}/tasks/${taskId}/status`, {
        status: newStatus
      });

      if (response.success) {
        task.status = newStatus;
        task.completedAt = newStatus === 'completed' ? new Date().toISOString() : null;
        
        this.renderTaskList();
        this.updateStats();
        
        // Emit event for real-time updates
        this.eventBus.emit('taskStatusChanged', { taskId, status: newStatus });
      }
    } catch (error) {
      logger.error('Failed to update task status:', error);
      // Revert checkbox state
      const checkbox = document.getElementById(`task-${taskId}`);
      if (checkbox) {
        checkbox.checked = task.status === 'completed';
      }
    }
  }

  /**
   * Get filtered tasks based on current filter
   */
  getFilteredTasks() {
    switch (this.state.filter) {
      case 'pending':
        return this.state.tasks.filter(task => task.status !== 'completed');
      case 'completed':
        return this.state.tasks.filter(task => task.status === 'completed');
      case 'assigned':
        return this.state.tasks.filter(task => task.assignedTo === this.config.currentUserId);
      default:
        return this.state.tasks;
    }
  }

  /**
   * Get sorted tasks based on current sort criteria
   */
  getSortedTasks(tasks) {
    return [...tasks].sort((a, b) => {
      switch (this.state.sortBy) {
        case 'dueDate':
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate) - new Date(b.dueDate);
        case 'priority':
          const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
          return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
        default:
          return new Date(b.createdAt) - new Date(a.createdAt);
      }
    });
  }

  /**
   * Update task statistics
   */
  updateStats() {
    const pending = this.state.tasks.filter(t => t.status !== 'completed').length;
    const completed = this.state.tasks.filter(t => t.status === 'completed').length;
    const overdue = this.state.tasks.filter(t => 
      t.status !== 'completed' && t.dueDate && new Date(t.dueDate) < new Date()
    ).length;

    const pendingEl = document.getElementById('pending-count');
    const completedEl = document.getElementById('completed-count');
    const overdueEl = document.getElementById('overdue-count');

    if (pendingEl) pendingEl.textContent = pending;
    if (completedEl) completedEl.textContent = completed;
    if (overdueEl) overdueEl.textContent = overdue;
  }

  /**
   * Utility methods
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  formatDate(dateString) {
    return new Date(dateString).toLocaleDateString();
  }

  getPriorityIcon(priority) {
    const icons = {
      low: '<i class="fas fa-chevron-down" aria-hidden="true"></i>',
      medium: '<i class="fas fa-minus" aria-hidden="true"></i>',
      high: '<i class="fas fa-chevron-up" aria-hidden="true"></i>',
      urgent: '<i class="fas fa-exclamation-triangle" aria-hidden="true"></i>'
    };
    return icons[priority] || '';
  }

  showError(message) {
    // This would integrate with the notification system
    console.error(message);
  }

  async loadGroupMembers() {
    // Implementation to load group members for task assignment
    try {
      const response = await apiClient.get(`/api/groups/${this.config.groupId}/members`);
      const select = document.getElementById('task-assignee');
      
      if (select && response.members) {
        response.members.forEach(member => {
          const option = document.createElement('option');
          option.value = member.id;
          option.textContent = member.name;
          select.appendChild(option);
        });
      }
    } catch (error) {
      logger.error('Failed to load group members:', error);
    }
  }
}

// Make it globally accessible for event handlers
window.taskManager = null;
