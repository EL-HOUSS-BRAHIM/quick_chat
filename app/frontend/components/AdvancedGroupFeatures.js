/**
 * Advanced Group Features Component
 * Provides task management, event scheduling, polls, and enhanced group functionality
 */

import { EventBus } from '../services/EventBus.js';
import { apiClient } from '../services/apiClient.js';
import { logger } from '../utils/logger.js';
import { Modal } from './ui/Modal.js';
import { Toast } from './ui/Toast.js';

export class AdvancedGroupFeatures {
  constructor(groupId, container) {
    this.groupId = groupId;
    this.container = container;
    this.eventBus = new EventBus();
    
    this.activeFeature = null;
    this.features = {
      tasks: new GroupTaskManager(groupId),
      events: new GroupEventScheduler(groupId),
      polls: new GroupPollManager(groupId),
      files: new GroupFileManager(groupId),
      templates: new GroupTemplateManager(groupId)
    };

    this.init();
  }

  /**
   * Initialize advanced group features
   */
  async init() {
    try {
      logger.info('Initializing Advanced Group Features...');

      await this.render();
      this.setupEventListeners();

      // Initialize individual features
      for (const [name, feature] of Object.entries(this.features)) {
        if (typeof feature.init === 'function') {
          await feature.init();
        }
      }

      logger.info('Advanced Group Features initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize Advanced Group Features:', error);
    }
  }

  /**
   * Render the component
   */
  async render() {
    this.container.innerHTML = `
      <div class="advanced-group-features">
        <div class="features-header">
          <h3>Group Features</h3>
          <div class="features-tabs">
            <button class="feature-tab active" data-feature="tasks">
              <i class="fas fa-tasks"></i>
              <span>Tasks</span>
            </button>
            <button class="feature-tab" data-feature="events">
              <i class="fas fa-calendar"></i>
              <span>Events</span>
            </button>
            <button class="feature-tab" data-feature="polls">
              <i class="fas fa-poll"></i>
              <span>Polls</span>
            </button>
            <button class="feature-tab" data-feature="files">
              <i class="fas fa-folder"></i>
              <span>Files</span>
            </button>
            <button class="feature-tab" data-feature="templates">
              <i class="fas fa-layer-group"></i>
              <span>Templates</span>
            </button>
          </div>
        </div>
        
        <div class="features-content">
          <div class="feature-panel active" data-feature="tasks">
            <div id="tasks-container"></div>
          </div>
          
          <div class="feature-panel" data-feature="events">
            <div id="events-container"></div>
          </div>
          
          <div class="feature-panel" data-feature="polls">
            <div id="polls-container"></div>
          </div>
          
          <div class="feature-panel" data-feature="files">
            <div id="files-container"></div>
          </div>
          
          <div class="feature-panel" data-feature="templates">
            <div id="templates-container"></div>
          </div>
        </div>
      </div>
    `;

    // Initialize feature containers
    await this.initializeFeatureContainers();
  }

  /**
   * Initialize feature containers
   */
  async initializeFeatureContainers() {
    // Render tasks
    const tasksContainer = this.container.querySelector('#tasks-container');
    await this.features.tasks.render(tasksContainer);

    // Render events
    const eventsContainer = this.container.querySelector('#events-container');
    await this.features.events.render(eventsContainer);

    // Render polls
    const pollsContainer = this.container.querySelector('#polls-container');
    await this.features.polls.render(pollsContainer);

    // Render files
    const filesContainer = this.container.querySelector('#files-container');
    await this.features.files.render(filesContainer);

    // Render templates
    const templatesContainer = this.container.querySelector('#templates-container');
    await this.features.templates.render(templatesContainer);
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Tab switching
    this.container.addEventListener('click', (e) => {
      if (e.target.closest('.feature-tab')) {
        const tab = e.target.closest('.feature-tab');
        const feature = tab.dataset.feature;
        this.switchFeature(feature);
      }
    });

    // Feature events
    Object.entries(this.features).forEach(([name, feature]) => {
      if (feature.eventBus) {
        feature.eventBus.on('*', (event, data) => {
          this.eventBus.emit(`feature:${name}:${event}`, data);
        });
      }
    });
  }

  /**
   * Switch active feature
   */
  switchFeature(featureName) {
    // Update active tab
    this.container.querySelectorAll('.feature-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.feature === featureName);
    });

    // Update active panel
    this.container.querySelectorAll('.feature-panel').forEach(panel => {
      panel.classList.toggle('active', panel.dataset.feature === featureName);
    });

    this.activeFeature = featureName;
    this.eventBus.emit('feature:switched', { feature: featureName });
  }

  /**
   * Get feature instance
   */
  getFeature(name) {
    return this.features[name];
  }

  /**
   * Add CSS styles
   */
  addStyles() {
    const styles = `
      <style>
        .advanced-group-features {
          background: var(--bg-secondary);
          border-radius: 8px;
          overflow: hidden;
        }
        
        .features-header {
          background: var(--bg-primary);
          padding: 1rem;
          border-bottom: 1px solid var(--border-color);
        }
        
        .features-header h3 {
          margin: 0 0 1rem 0;
          color: var(--text-primary);
          font-size: 1.1rem;
        }
        
        .features-tabs {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        
        .feature-tab {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 0.85rem;
        }
        
        .feature-tab:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        
        .feature-tab.active {
          background: var(--primary-color);
          color: white;
          border-color: var(--primary-color);
        }
        
        .feature-tab i {
          font-size: 0.9rem;
        }
        
        .features-content {
          position: relative;
          min-height: 400px;
        }
        
        .feature-panel {
          display: none;
          padding: 1rem;
        }
        
        .feature-panel.active {
          display: block;
        }
        
        @media (max-width: 768px) {
          .features-tabs {
            justify-content: center;
          }
          
          .feature-tab span {
            display: none;
          }
          
          .feature-tab {
            padding: 0.5rem;
            min-width: 40px;
            justify-content: center;
          }
        }
      </style>
    `;

    if (!document.querySelector('#advanced-group-features-styles')) {
      const styleSheet = document.createElement('div');
      styleSheet.id = 'advanced-group-features-styles';
      styleSheet.innerHTML = styles;
      document.head.appendChild(styleSheet);
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    // Cleanup features
    Object.values(this.features).forEach(feature => {
      if (typeof feature.destroy === 'function') {
        feature.destroy();
      }
    });

    // Clear container
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

/**
 * Group Task Manager
 * Manages tasks and to-do lists within groups
 */
class GroupTaskManager {
  constructor(groupId) {
    this.groupId = groupId;
    this.eventBus = new EventBus();
    this.tasks = [];
    this.categories = ['General', 'Planning', 'Development', 'Review'];
    this.container = null;
  }

  async init() {
    await this.loadTasks();
  }

  async render(container) {
    this.container = container;
    
    container.innerHTML = `
      <div class="task-manager">
        <div class="task-header">
          <h4>Group Tasks</h4>
          <button class="btn btn-primary btn-sm create-task-btn">
            <i class="fas fa-plus"></i> New Task
          </button>
        </div>
        
        <div class="task-filters">
          <select class="task-category-filter">
            <option value="">All Categories</option>
            ${this.categories.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
          </select>
          
          <select class="task-status-filter">
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        
        <div class="task-list">
          ${await this.renderTaskList()}
        </div>
      </div>
    `;

    this.setupTaskEventListeners();
  }

  async renderTaskList() {
    if (this.tasks.length === 0) {
      return `
        <div class="empty-state">
          <i class="fas fa-tasks"></i>
          <p>No tasks yet. Create your first task to get started!</p>
        </div>
      `;
    }

    return this.tasks.map(task => `
      <div class="task-item" data-task-id="${task.id}">
        <div class="task-checkbox">
          <input type="checkbox" ${task.status === 'completed' ? 'checked' : ''} 
                 onchange="window.taskManager.toggleTaskStatus('${task.id}')">
        </div>
        
        <div class="task-content">
          <div class="task-title ${task.status === 'completed' ? 'completed' : ''}">${task.title}</div>
          <div class="task-description">${task.description}</div>
          <div class="task-meta">
            <span class="task-category">${task.category}</span>
            <span class="task-assignee">@${task.assignee}</span>
            <span class="task-due-date">${this.formatDate(task.dueDate)}</span>
          </div>
        </div>
        
        <div class="task-actions">
          <button class="btn-icon edit-task" onclick="window.taskManager.editTask('${task.id}')">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-icon delete-task" onclick="window.taskManager.deleteTask('${task.id}')">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `).join('');
  }

  setupTaskEventListeners() {
    const createBtn = this.container.querySelector('.create-task-btn');
    createBtn.addEventListener('click', () => this.showCreateTaskModal());

    // Setup global task manager reference
    window.taskManager = this;
  }

  async showCreateTaskModal() {
    const modal = new Modal({
      title: 'Create New Task',
      content: await this.getTaskForm(),
      size: 'medium'
    });

    modal.show();
  }

  async getTaskForm(task = null) {
    const members = await this.getGroupMembers();
    
    return `
      <form class="task-form">
        <div class="form-group">
          <label>Task Title</label>
          <input type="text" name="title" value="${task?.title || ''}" required>
        </div>
        
        <div class="form-group">
          <label>Description</label>
          <textarea name="description" rows="3">${task?.description || ''}</textarea>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label>Category</label>
            <select name="category">
              ${this.categories.map(cat => 
                `<option value="${cat}" ${task?.category === cat ? 'selected' : ''}>${cat}</option>`
              ).join('')}
            </select>
          </div>
          
          <div class="form-group">
            <label>Assignee</label>
            <select name="assignee">
              ${members.map(member => 
                `<option value="${member.id}" ${task?.assignee === member.id ? 'selected' : ''}>${member.name}</option>`
              ).join('')}
            </select>
          </div>
        </div>
        
        <div class="form-group">
          <label>Due Date</label>
          <input type="datetime-local" name="dueDate" value="${task?.dueDate || ''}">
        </div>
        
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">${task ? 'Update' : 'Create'} Task</button>
        </div>
      </form>
    `;
  }

  async loadTasks() {
    try {
      const response = await apiClient.get(`/api/groups/${this.groupId}/tasks`);
      this.tasks = response.tasks || [];
    } catch (error) {
      logger.error('Failed to load tasks:', error);
      this.tasks = [];
    }
  }

  async getGroupMembers() {
    try {
      const response = await apiClient.get(`/api/groups/${this.groupId}/members`);
      return response.members || [];
    } catch (error) {
      logger.error('Failed to load group members:', error);
      return [];
    }
  }

  formatDate(dateString) {
    if (!dateString) return 'No due date';
    return new Date(dateString).toLocaleDateString();
  }

  async toggleTaskStatus(taskId) {
    // Implementation for toggling task status
  }

  async editTask(taskId) {
    // Implementation for editing tasks
  }

  async deleteTask(taskId) {
    // Implementation for deleting tasks
  }

  destroy() {
    if (window.taskManager === this) {
      delete window.taskManager;
    }
  }
}

/**
 * Group Event Scheduler
 * Manages events and meetings within groups
 */
class GroupEventScheduler {
  constructor(groupId) {
    this.groupId = groupId;
    this.eventBus = new EventBus();
    this.events = [];
    this.calendar = null;
    this.container = null;
  }

  async init() {
    await this.loadEvents();
  }

  async render(container) {
    this.container = container;
    
    container.innerHTML = `
      <div class="event-scheduler">
        <div class="event-header">
          <h4>Group Events</h4>
          <button class="btn btn-primary btn-sm create-event-btn">
            <i class="fas fa-plus"></i> New Event
          </button>
        </div>
        
        <div class="event-views">
          <button class="view-btn active" data-view="calendar">Calendar</button>
          <button class="view-btn" data-view="list">List</button>
        </div>
        
        <div class="event-calendar" id="event-calendar">
          ${await this.renderCalendar()}
        </div>
        
        <div class="event-list" style="display: none;">
          ${await this.renderEventList()}
        </div>
      </div>
    `;

    this.setupEventListeners();
  }

  async renderCalendar() {
    // Simple calendar implementation
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    return `
      <div class="calendar-header">
        <button class="btn-icon prev-month"><i class="fas fa-chevron-left"></i></button>
        <span class="current-month">${this.getMonthName(month)} ${year}</span>
        <button class="btn-icon next-month"><i class="fas fa-chevron-right"></i></button>
      </div>
      
      <div class="calendar-grid">
        ${this.renderCalendarDays(year, month)}
      </div>
    `;
  }

  async renderEventList() {
    if (this.events.length === 0) {
      return `
        <div class="empty-state">
          <i class="fas fa-calendar"></i>
          <p>No events scheduled. Create your first event!</p>
        </div>
      `;
    }

    return this.events.map(event => `
      <div class="event-item">
        <div class="event-date">
          <div class="event-day">${new Date(event.startDate).getDate()}</div>
          <div class="event-month">${this.getMonthName(new Date(event.startDate).getMonth(), true)}</div>
        </div>
        
        <div class="event-content">
          <div class="event-title">${event.title}</div>
          <div class="event-time">${this.formatTime(event.startDate)} - ${this.formatTime(event.endDate)}</div>
          <div class="event-description">${event.description}</div>
        </div>
        
        <div class="event-actions">
          <button class="btn-icon"><i class="fas fa-edit"></i></button>
          <button class="btn-icon"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    `).join('');
  }

  setupEventListeners() {
    const createBtn = this.container.querySelector('.create-event-btn');
    createBtn.addEventListener('click', () => this.showCreateEventModal());

    // View switching
    this.container.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.switchView(e.target.dataset.view);
      });
    });
  }

  switchView(view) {
    this.container.querySelectorAll('.view-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });

    const calendar = this.container.querySelector('.event-calendar');
    const list = this.container.querySelector('.event-list');

    if (view === 'calendar') {
      calendar.style.display = 'block';
      list.style.display = 'none';
    } else {
      calendar.style.display = 'none';
      list.style.display = 'block';
    }
  }

  async showCreateEventModal() {
    const modal = new Modal({
      title: 'Create New Event',
      content: await this.getEventForm(),
      size: 'medium'
    });

    modal.show();
  }

  async getEventForm(event = null) {
    return `
      <form class="event-form">
        <div class="form-group">
          <label>Event Title</label>
          <input type="text" name="title" value="${event?.title || ''}" required>
        </div>
        
        <div class="form-group">
          <label>Description</label>
          <textarea name="description" rows="3">${event?.description || ''}</textarea>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label>Start Date & Time</label>
            <input type="datetime-local" name="startDate" value="${event?.startDate || ''}" required>
          </div>
          
          <div class="form-group">
            <label>End Date & Time</label>
            <input type="datetime-local" name="endDate" value="${event?.endDate || ''}" required>
          </div>
        </div>
        
        <div class="form-group">
          <label>Location</label>
          <input type="text" name="location" value="${event?.location || ''}" placeholder="Optional">
        </div>
        
        <div class="form-group">
          <label>
            <input type="checkbox" name="allDay" ${event?.allDay ? 'checked' : ''}> All Day Event
          </label>
        </div>
        
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">${event ? 'Update' : 'Create'} Event</button>
        </div>
      </form>
    `;
  }

  renderCalendarDays(year, month) {
    // Calendar rendering logic
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    let html = '<div class="calendar-weekdays">';
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    weekdays.forEach(day => {
      html += `<div class="weekday">${day}</div>`;
    });
    html += '</div><div class="calendar-days">';

    for (let i = 0; i < 42; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      
      const isCurrentMonth = currentDate.getMonth() === month;
      const isToday = this.isSameDay(currentDate, new Date());
      const hasEvents = this.getEventsForDate(currentDate).length > 0;

      html += `
        <div class="calendar-day ${isCurrentMonth ? '' : 'other-month'} ${isToday ? 'today' : ''} ${hasEvents ? 'has-events' : ''}"
             data-date="${currentDate.toISOString().split('T')[0]}">
          <span class="day-number">${currentDate.getDate()}</span>
          ${hasEvents ? '<div class="event-indicator"></div>' : ''}
        </div>
      `;
    }

    html += '</div>';
    return html;
  }

  getEventsForDate(date) {
    return this.events.filter(event => 
      this.isSameDay(new Date(event.startDate), date)
    );
  }

  isSameDay(date1, date2) {
    return date1.toDateString() === date2.toDateString();
  }

  getMonthName(month, short = false) {
    const months = short 
      ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return months[month];
  }

  formatTime(dateString) {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  async loadEvents() {
    try {
      const response = await apiClient.get(`/api/groups/${this.groupId}/events`);
      this.events = response.events || [];
    } catch (error) {
      logger.error('Failed to load events:', error);
      this.events = [];
    }
  }

  destroy() {
    // Cleanup
  }
}

/**
 * Group Poll Manager
 * Manages polls and voting within groups
 */
class GroupPollManager {
  constructor(groupId) {
    this.groupId = groupId;
    this.eventBus = new EventBus();
    this.polls = [];
    this.container = null;
  }

  async init() {
    await this.loadPolls();
  }

  async render(container) {
    this.container = container;
    
    container.innerHTML = `
      <div class="poll-manager">
        <div class="poll-header">
          <h4>Group Polls</h4>
          <button class="btn btn-primary btn-sm create-poll-btn">
            <i class="fas fa-plus"></i> New Poll
          </button>
        </div>
        
        <div class="poll-list">
          ${await this.renderPollList()}
        </div>
      </div>
    `;

    this.setupPollEventListeners();
  }

  async renderPollList() {
    if (this.polls.length === 0) {
      return `
        <div class="empty-state">
          <i class="fas fa-poll"></i>
          <p>No polls yet. Create your first poll to gather opinions!</p>
        </div>
      `;
    }

    return this.polls.map(poll => `
      <div class="poll-item">
        <div class="poll-header">
          <h5>${poll.question}</h5>
          <span class="poll-status ${poll.status}">${poll.status}</span>
        </div>
        
        <div class="poll-options">
          ${poll.options.map((option, index) => `
            <div class="poll-option">
              <div class="option-text">${option.text}</div>
              <div class="option-votes">
                <div class="vote-bar" style="width: ${this.calculatePercentage(option.votes, poll.totalVotes)}%"></div>
                <span class="vote-count">${option.votes} votes</span>
              </div>
            </div>
          `).join('')}
        </div>
        
        <div class="poll-footer">
          <div class="poll-meta">
            Total votes: ${poll.totalVotes} • Created by ${poll.creator}
          </div>
          
          ${poll.status === 'active' ? `
            <div class="poll-actions">
              <button class="btn btn-sm btn-primary vote-btn" data-poll-id="${poll.id}">Vote</button>
              <button class="btn btn-sm btn-secondary close-poll-btn" data-poll-id="${poll.id}">Close Poll</button>
            </div>
          ` : ''}
        </div>
      </div>
    `).join('');
  }

  setupPollEventListeners() {
    const createBtn = this.container.querySelector('.create-poll-btn');
    createBtn.addEventListener('click', () => this.showCreatePollModal());

    // Vote buttons
    this.container.addEventListener('click', (e) => {
      if (e.target.classList.contains('vote-btn')) {
        const pollId = e.target.dataset.pollId;
        this.showVoteModal(pollId);
      }
      
      if (e.target.classList.contains('close-poll-btn')) {
        const pollId = e.target.dataset.pollId;
        this.closePoll(pollId);
      }
    });
  }

  async showCreatePollModal() {
    const modal = new Modal({
      title: 'Create New Poll',
      content: await this.getPollForm(),
      size: 'medium'
    });

    modal.show();
  }

  async getPollForm() {
    return `
      <form class="poll-form">
        <div class="form-group">
          <label>Poll Question</label>
          <input type="text" name="question" required placeholder="What would you like to ask?">
        </div>
        
        <div class="form-group">
          <label>Poll Options</label>
          <div class="poll-options-input">
            <div class="option-input">
              <input type="text" name="option[]" placeholder="Option 1" required>
              <button type="button" class="btn-icon remove-option" style="display: none;">
                <i class="fas fa-trash"></i>
              </button>
            </div>
            
            <div class="option-input">
              <input type="text" name="option[]" placeholder="Option 2" required>
              <button type="button" class="btn-icon remove-option" style="display: none;">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
          
          <button type="button" class="btn btn-sm btn-secondary add-option-btn">
            <i class="fas fa-plus"></i> Add Option
          </button>
        </div>
        
        <div class="form-group">
          <label>
            <input type="checkbox" name="multipleChoice"> Allow multiple selections
          </label>
        </div>
        
        <div class="form-group">
          <label>
            <input type="checkbox" name="anonymous"> Anonymous voting
          </label>
        </div>
        
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Create Poll</button>
        </div>
      </form>
    `;
  }

  calculatePercentage(votes, total) {
    return total > 0 ? Math.round((votes / total) * 100) : 0;
  }

  async loadPolls() {
    try {
      const response = await apiClient.get(`/api/groups/${this.groupId}/polls`);
      this.polls = response.polls || [];
    } catch (error) {
      logger.error('Failed to load polls:', error);
      this.polls = [];
    }
  }

  async showVoteModal(pollId) {
    // Implementation for voting modal
  }

  async closePoll(pollId) {
    // Implementation for closing polls
  }

  destroy() {
    // Cleanup
  }
}

/**
 * Group File Manager
 * Manages shared files within groups
 */
class GroupFileManager {
  constructor(groupId) {
    this.groupId = groupId;
    this.eventBus = new EventBus();
    this.files = [];
    this.currentFolder = null;
    this.container = null;
  }

  async init() {
    await this.loadFiles();
  }

  async render(container) {
    this.container = container;
    
    container.innerHTML = `
      <div class="file-manager">
        <div class="file-header">
          <h4>Shared Files</h4>
          <div class="file-actions">
            <button class="btn btn-primary btn-sm upload-file-btn">
              <i class="fas fa-upload"></i> Upload
            </button>
            <button class="btn btn-secondary btn-sm create-folder-btn">
              <i class="fas fa-folder-plus"></i> New Folder
            </button>
          </div>
        </div>
        
        <div class="file-breadcrumb">
          <span class="breadcrumb-item active">Files</span>
        </div>
        
        <div class="file-list">
          ${await this.renderFileList()}
        </div>
      </div>
    `;

    this.setupFileEventListeners();
  }

  async renderFileList() {
    if (this.files.length === 0) {
      return `
        <div class="empty-state">
          <i class="fas fa-folder-open"></i>
          <p>No files yet. Upload your first file to share with the group!</p>
        </div>
      `;
    }

    return this.files.map(file => `
      <div class="file-item" data-file-id="${file.id}">
        <div class="file-icon">
          <i class="fas ${this.getFileIcon(file.type)}"></i>
        </div>
        
        <div class="file-info">
          <div class="file-name">${file.name}</div>
          <div class="file-meta">
            ${this.formatFileSize(file.size)} • 
            Uploaded by ${file.uploader} • 
            ${this.formatDate(file.uploadDate)}
          </div>
        </div>
        
        <div class="file-actions">
          <button class="btn-icon download-file" data-file-id="${file.id}">
            <i class="fas fa-download"></i>
          </button>
          <button class="btn-icon share-file" data-file-id="${file.id}">
            <i class="fas fa-share"></i>
          </button>
          <button class="btn-icon delete-file" data-file-id="${file.id}">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `).join('');
  }

  setupFileEventListeners() {
    const uploadBtn = this.container.querySelector('.upload-file-btn');
    uploadBtn.addEventListener('click', () => this.showUploadModal());

    const createFolderBtn = this.container.querySelector('.create-folder-btn');
    createFolderBtn.addEventListener('click', () => this.showCreateFolderModal());

    // File actions
    this.container.addEventListener('click', (e) => {
      const fileId = e.target.dataset.fileId;
      
      if (e.target.classList.contains('download-file')) {
        this.downloadFile(fileId);
      } else if (e.target.classList.contains('share-file')) {
        this.shareFile(fileId);
      } else if (e.target.classList.contains('delete-file')) {
        this.deleteFile(fileId);
      }
    });
  }

  getFileIcon(type) {
    const iconMap = {
      'image': 'fa-image',
      'video': 'fa-video',
      'audio': 'fa-music',
      'document': 'fa-file-alt',
      'pdf': 'fa-file-pdf',
      'spreadsheet': 'fa-file-excel',
      'presentation': 'fa-file-powerpoint',
      'archive': 'fa-file-archive',
      'code': 'fa-file-code',
      'default': 'fa-file'
    };

    return iconMap[type] || iconMap.default;
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatDate(dateString) {
    return new Date(dateString).toLocaleDateString();
  }

  async loadFiles() {
    try {
      const response = await apiClient.get(`/api/groups/${this.groupId}/files`);
      this.files = response.files || [];
    } catch (error) {
      logger.error('Failed to load files:', error);
      this.files = [];
    }
  }

  async showUploadModal() {
    // Implementation for file upload
  }

  async showCreateFolderModal() {
    // Implementation for folder creation
  }

  async downloadFile(fileId) {
    // Implementation for file download
  }

  async shareFile(fileId) {
    // Implementation for file sharing
  }

  async deleteFile(fileId) {
    // Implementation for file deletion
  }

  destroy() {
    // Cleanup
  }
}

/**
 * Group Template Manager
 * Manages group templates and themes
 */
class GroupTemplateManager {
  constructor(groupId) {
    this.groupId = groupId;
    this.eventBus = new EventBus();
    this.templates = [];
    this.container = null;
  }

  async init() {
    await this.loadTemplates();
  }

  async render(container) {
    this.container = container;
    
    container.innerHTML = `
      <div class="template-manager">
        <div class="template-header">
          <h4>Group Templates</h4>
          <button class="btn btn-primary btn-sm create-template-btn">
            <i class="fas fa-plus"></i> New Template
          </button>
        </div>
        
        <div class="template-categories">
          <button class="category-btn active" data-category="all">All</button>
          <button class="category-btn" data-category="themes">Themes</button>
          <button class="category-btn" data-category="layouts">Layouts</button>
          <button class="category-btn" data-category="workflows">Workflows</button>
        </div>
        
        <div class="template-grid">
          ${await this.renderTemplateGrid()}
        </div>
      </div>
    `;

    this.setupTemplateEventListeners();
  }

  async renderTemplateGrid() {
    if (this.templates.length === 0) {
      return `
        <div class="empty-state">
          <i class="fas fa-layer-group"></i>
          <p>No templates yet. Create your first template to customize the group!</p>
        </div>
      `;
    }

    return this.templates.map(template => `
      <div class="template-card" data-template-id="${template.id}">
        <div class="template-preview">
          <img src="${template.preview}" alt="${template.name}" loading="lazy">
        </div>
        
        <div class="template-info">
          <div class="template-name">${template.name}</div>
          <div class="template-category">${template.category}</div>
          <div class="template-description">${template.description}</div>
        </div>
        
        <div class="template-actions">
          <button class="btn btn-sm btn-primary apply-template" data-template-id="${template.id}">
            Apply
          </button>
          <button class="btn btn-sm btn-secondary preview-template" data-template-id="${template.id}">
            Preview
          </button>
        </div>
      </div>
    `).join('');
  }

  setupTemplateEventListeners() {
    const createBtn = this.container.querySelector('.create-template-btn');
    createBtn.addEventListener('click', () => this.showCreateTemplateModal());

    // Category filtering
    this.container.querySelectorAll('.category-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.filterTemplates(e.target.dataset.category);
      });
    });

    // Template actions
    this.container.addEventListener('click', (e) => {
      const templateId = e.target.dataset.templateId;
      
      if (e.target.classList.contains('apply-template')) {
        this.applyTemplate(templateId);
      } else if (e.target.classList.contains('preview-template')) {
        this.previewTemplate(templateId);
      }
    });
  }

  async loadTemplates() {
    try {
      const response = await apiClient.get(`/api/groups/${this.groupId}/templates`);
      this.templates = response.templates || [];
    } catch (error) {
      logger.error('Failed to load templates:', error);
      this.templates = [];
    }
  }

  async showCreateTemplateModal() {
    // Implementation for template creation
  }

  filterTemplates(category) {
    this.container.querySelectorAll('.category-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.category === category);
    });

    // Filter template cards
    const cards = this.container.querySelectorAll('.template-card');
    cards.forEach(card => {
      const template = this.templates.find(t => t.id === card.dataset.templateId);
      const show = category === 'all' || template.category === category;
      card.style.display = show ? 'block' : 'none';
    });
  }

  async applyTemplate(templateId) {
    // Implementation for applying templates
  }

  async previewTemplate(templateId) {
    // Implementation for template preview
  }

  destroy() {
    // Cleanup
  }
}
