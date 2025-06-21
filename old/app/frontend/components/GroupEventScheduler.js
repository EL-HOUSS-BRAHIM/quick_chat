/**
 * Group Event Scheduler
 * 
 * Manages event creation, scheduling, and calendar integration for group chats
 * Part of the Advanced Group Features initiative (TODO: 60% → 75%)
 */

import { EventBus } from '../services/EventBus.js';
import { apiClient } from '../services/apiClient.js';
import { logger } from '../utils/logger.js';
import { i18nManager } from '../services/i18nManager.js';

export class GroupEventScheduler {
  constructor(config = {}) {
    this.config = {
      groupId: config.groupId,
      currentUserId: config.currentUserId,
      container: config.container,
      timezone: config.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      ...config
    };

    this.eventBus = new EventBus();
    this.state = {
      events: [],
      currentView: 'month', // 'month', 'week', 'day', 'list'
      currentDate: new Date(),
      selectedEvent: null,
      isLoading: false
    };

    this.init();
  }

  /**
   * Initialize event scheduler
   */
  async init() {
    try {
      this.render();
      this.setupEventListeners();
      await this.loadEvents();
      
      logger.info('Group event scheduler initialized', { groupId: this.config.groupId });
    } catch (error) {
      logger.error('Failed to initialize event scheduler:', error);
    }
  }

  /**
   * Render event scheduler UI
   */
  render() {
    if (!this.config.container) return;

    this.config.container.innerHTML = `
      <div class="group-event-scheduler">
        <div class="scheduler-header">
          <div class="scheduler-title">
            <h3>
              <i class="fas fa-calendar-alt" aria-hidden="true"></i>
              Group Events
            </h3>
          </div>
          
          <div class="scheduler-controls">
            <div class="view-selector">
              <button class="btn btn-sm ${this.state.currentView === 'month' ? 'active' : ''}" 
                      data-view="month">Month</button>
              <button class="btn btn-sm ${this.state.currentView === 'week' ? 'active' : ''}" 
                      data-view="week">Week</button>
              <button class="btn btn-sm ${this.state.currentView === 'day' ? 'active' : ''}" 
                      data-view="day">Day</button>
              <button class="btn btn-sm ${this.state.currentView === 'list' ? 'active' : ''}" 
                      data-view="list">List</button>
            </div>
            
            <div class="date-navigation">
              <button class="btn btn-sm btn-outline" id="prev-period">
                <i class="fas fa-chevron-left" aria-hidden="true"></i>
              </button>
              <button class="btn btn-sm btn-outline" id="today-btn">Today</button>
              <button class="btn btn-sm btn-outline" id="next-period">
                <i class="fas fa-chevron-right" aria-hidden="true"></i>
              </button>
            </div>
            
            <button class="btn btn-primary btn-sm" id="create-event-btn">
              <i class="fas fa-plus" aria-hidden="true"></i>
              Create Event
            </button>
          </div>
        </div>
        
        <div class="scheduler-content">
          <div class="calendar-header" id="calendar-header"></div>
          <div class="calendar-body" id="calendar-body"></div>
        </div>
        
        <div class="upcoming-events">
          <h4>Upcoming Events</h4>
          <div class="event-list" id="upcoming-events-list"></div>
        </div>
      </div>
    `;

    this.renderCurrentView();
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // View selector
    this.config.container.addEventListener('click', (e) => {
      if (e.target.dataset.view) {
        this.state.currentView = e.target.dataset.view;
        this.updateViewButtons();
        this.renderCurrentView();
      }
    });

    // Navigation
    const prevBtn = document.getElementById('prev-period');
    const nextBtn = document.getElementById('next-period');
    const todayBtn = document.getElementById('today-btn');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.navigatePeriod(-1));
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.navigatePeriod(1));
    }
    if (todayBtn) {
      todayBtn.addEventListener('click', () => this.goToToday());
    }

    // Create event
    const createBtn = document.getElementById('create-event-btn');
    if (createBtn) {
      createBtn.addEventListener('click', () => this.showCreateEventModal());
    }
  }

  /**
   * Render current calendar view
   */
  renderCurrentView() {
    switch (this.state.currentView) {
      case 'month':
        this.renderMonthView();
        break;
      case 'week':
        this.renderWeekView();
        break;
      case 'day':
        this.renderDayView();
        break;
      case 'list':
        this.renderListView();
        break;
    }
    
    this.renderUpcomingEvents();
  }

  /**
   * Render month view
   */
  renderMonthView() {
    const header = document.getElementById('calendar-header');
    const body = document.getElementById('calendar-body');
    
    const monthName = this.state.currentDate.toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
    
    header.innerHTML = `<h4>${monthName}</h4>`;
    
    const firstDay = new Date(this.state.currentDate.getFullYear(), this.state.currentDate.getMonth(), 1);
    const lastDay = new Date(this.state.currentDate.getFullYear(), this.state.currentDate.getMonth() + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    let calendar = '<div class="calendar-grid month-view">';
    
    // Day headers
    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    calendar += '<div class="calendar-row header-row">';
    dayHeaders.forEach(day => {
      calendar += `<div class="calendar-cell header-cell">${day}</div>`;
    });
    calendar += '</div>';
    
    // Calendar days
    const currentDate = new Date(startDate);
    for (let week = 0; week < 6; week++) {
      calendar += '<div class="calendar-row">';
      
      for (let day = 0; day < 7; day++) {
        const isCurrentMonth = currentDate.getMonth() === this.state.currentDate.getMonth();
        const isToday = this.isToday(currentDate);
        const dayEvents = this.getEventsForDate(currentDate);
        
        let cellClass = 'calendar-cell day-cell';
        if (!isCurrentMonth) cellClass += ' other-month';
        if (isToday) cellClass += ' today';
        if (dayEvents.length > 0) cellClass += ' has-events';
        
        calendar += `
          <div class="${cellClass}" data-date="${currentDate.toISOString().split('T')[0]}">
            <div class="day-number">${currentDate.getDate()}</div>
            <div class="day-events">
              ${dayEvents.slice(0, 3).map(event => 
                `<div class="mini-event ${event.type || ''}" title="${event.title}">
                  ${event.title.length > 15 ? event.title.substring(0, 15) + '...' : event.title}
                </div>`
              ).join('')}
              ${dayEvents.length > 3 ? `<div class="more-events">+${dayEvents.length - 3} more</div>` : ''}
            </div>
          </div>
        `;
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      calendar += '</div>';
    }
    
    calendar += '</div>';
    body.innerHTML = calendar;
  }

  /**
   * Show create event modal
   */
  showCreateEventModal() {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Create Group Event</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <form id="create-event-form">
              <div class="row">
                <div class="col-md-8">
                  <div class="mb-3">
                    <label for="event-title" class="form-label">Event Title *</label>
                    <input type="text" class="form-control" id="event-title" required>
                  </div>
                  
                  <div class="mb-3">
                    <label for="event-description" class="form-label">Description</label>
                    <textarea class="form-control" id="event-description" rows="3"></textarea>
                  </div>
                  
                  <div class="mb-3">
                    <label for="event-location" class="form-label">Location</label>
                    <input type="text" class="form-control" id="event-location" 
                           placeholder="Virtual, address, or meeting link">
                  </div>
                </div>
                
                <div class="col-md-4">
                  <div class="mb-3">
                    <label for="event-type" class="form-label">Event Type</label>
                    <select class="form-control" id="event-type">
                      <option value="meeting">Meeting</option>
                      <option value="social">Social</option>
                      <option value="deadline">Deadline</option>
                      <option value="reminder">Reminder</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  
                  <div class="mb-3">
                    <label class="form-label">Privacy</label>
                    <div class="form-check">
                      <input class="form-check-input" type="radio" name="privacy" 
                             id="privacy-group" value="group" checked>
                      <label class="form-check-label" for="privacy-group">
                        Group Members Only
                      </label>
                    </div>
                    <div class="form-check">
                      <input class="form-check-input" type="radio" name="privacy" 
                             id="privacy-public" value="public">
                      <label class="form-check-label" for="privacy-public">
                        Public (Shareable)
                      </label>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="row">
                <div class="col-md-6">
                  <div class="mb-3">
                    <label for="event-start-date" class="form-label">Start Date & Time *</label>
                    <input type="datetime-local" class="form-control" id="event-start-date" required>
                  </div>
                </div>
                
                <div class="col-md-6">
                  <div class="mb-3">
                    <label for="event-end-date" class="form-label">End Date & Time</label>
                    <input type="datetime-local" class="form-control" id="event-end-date">
                  </div>
                </div>
              </div>
              
              <div class="mb-3">
                <label class="form-label">Reminders</label>
                <div class="reminder-options">
                  <div class="form-check form-check-inline">
                    <input class="form-check-input" type="checkbox" id="reminder-15min" value="15">
                    <label class="form-check-label" for="reminder-15min">15 minutes</label>
                  </div>
                  <div class="form-check form-check-inline">
                    <input class="form-check-input" type="checkbox" id="reminder-1hour" value="60">
                    <label class="form-check-label" for="reminder-1hour">1 hour</label>
                  </div>
                  <div class="form-check form-check-inline">
                    <input class="form-check-input" type="checkbox" id="reminder-1day" value="1440">
                    <label class="form-check-label" for="reminder-1day">1 day</label>
                  </div>
                </div>
              </div>
              
              <div class="mb-3">
                <label for="event-attendees" class="form-label">Invite Specific Members</label>
                <select class="form-control" id="event-attendees" multiple>
                  <!-- Group members will be populated here -->
                </select>
                <small class="form-text text-muted">
                  Leave empty to invite all group members
                </small>
              </div>
              
              <div class="form-check mb-3">
                <input class="form-check-input" type="checkbox" id="event-recurring">
                <label class="form-check-label" for="event-recurring">
                  Recurring Event
                </label>
              </div>
              
              <div id="recurring-options" class="recurring-options" style="display: none;">
                <div class="row">
                  <div class="col-md-6">
                    <label for="recurrence-pattern" class="form-label">Repeat</label>
                    <select class="form-control" id="recurrence-pattern">
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                  <div class="col-md-6">
                    <label for="recurrence-end" class="form-label">Until</label>
                    <input type="date" class="form-control" id="recurrence-end">
                  </div>
                </div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" onclick="window.eventScheduler.createEvent()">
              Create Event
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Setup recurring event toggle
    const recurringCheck = document.getElementById('event-recurring');
    const recurringOptions = document.getElementById('recurring-options');
    
    if (recurringCheck && recurringOptions) {
      recurringCheck.addEventListener('change', () => {
        recurringOptions.style.display = recurringCheck.checked ? 'block' : 'none';
      });
    }
    
    // Load group members
    this.loadGroupMembers();
    
    // Show modal
    if (window.bootstrap) {
      const bsModal = new bootstrap.Modal(modal);
      bsModal.show();
    }
  }

  /**
   * Create new event
   */
  async createEvent() {
    const eventData = {
      title: document.getElementById('event-title').value,
      description: document.getElementById('event-description').value,
      location: document.getElementById('event-location').value,
      type: document.getElementById('event-type').value,
      privacy: document.querySelector('input[name="privacy"]:checked').value,
      startDate: document.getElementById('event-start-date').value,
      endDate: document.getElementById('event-end-date').value,
      groupId: this.config.groupId,
      createdBy: this.config.currentUserId,
      timezone: this.config.timezone
    };

    // Get reminders
    const reminders = [];
    document.querySelectorAll('.reminder-options input:checked').forEach(checkbox => {
      reminders.push(parseInt(checkbox.value));
    });
    eventData.reminders = reminders;

    // Get attendees
    const attendeeSelect = document.getElementById('event-attendees');
    if (attendeeSelect.selectedOptions.length > 0) {
      eventData.attendees = Array.from(attendeeSelect.selectedOptions).map(option => option.value);
    }

    // Handle recurring events
    if (document.getElementById('event-recurring').checked) {
      eventData.recurring = {
        pattern: document.getElementById('recurrence-pattern').value,
        endDate: document.getElementById('recurrence-end').value
      };
    }

    try {
      const response = await apiClient.post(`/api/groups/${this.config.groupId}/events`, eventData);
      
      if (response.success) {
        this.state.events.push(...(response.events || [response.event]));
        this.renderCurrentView();
        
        // Close modal
        const modal = document.querySelector('.modal');
        if (modal && window.bootstrap) {
          bootstrap.Modal.getInstance(modal).hide();
        }
        
        // Emit event for real-time updates
        this.eventBus.emit('eventCreated', response.event);
        
        logger.info('Event created successfully', { eventId: response.event.id });
      }
    } catch (error) {
      logger.error('Failed to create event:', error);
      this.showError('Failed to create event');
    }
  }

  /**
   * Load events from API
   */
  async loadEvents() {
    this.state.isLoading = true;
    
    try {
      const startDate = new Date(this.state.currentDate);
      startDate.setMonth(startDate.getMonth() - 1);
      const endDate = new Date(this.state.currentDate);
      endDate.setMonth(endDate.getMonth() + 2);
      
      const response = await apiClient.get(`/api/groups/${this.config.groupId}/events`, {
        params: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        }
      });
      
      this.state.events = response.events || [];
      this.renderCurrentView();
    } catch (error) {
      logger.error('Failed to load events:', error);
      this.showError('Failed to load events');
    } finally {
      this.state.isLoading = false;
    }
  }

  /**
   * Utility methods
   */
  getEventsForDate(date) {
    const dateStr = date.toISOString().split('T')[0];
    return this.state.events.filter(event => {
      const eventDate = new Date(event.startDate).toISOString().split('T')[0];
      return eventDate === dateStr;
    });
  }

  isToday(date) {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  navigatePeriod(direction) {
    const newDate = new Date(this.state.currentDate);
    
    switch (this.state.currentView) {
      case 'month':
        newDate.setMonth(newDate.getMonth() + direction);
        break;
      case 'week':
        newDate.setDate(newDate.getDate() + (direction * 7));
        break;
      case 'day':
        newDate.setDate(newDate.getDate() + direction);
        break;
    }
    
    this.state.currentDate = newDate;
    this.renderCurrentView();
  }

  goToToday() {
    this.state.currentDate = new Date();
    this.renderCurrentView();
  }

  updateViewButtons() {
    this.config.container.querySelectorAll('[data-view]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === this.state.currentView);
    });
  }

  renderUpcomingEvents() {
    const container = document.getElementById('upcoming-events-list');
    if (!container) return;

    const now = new Date();
    const upcoming = this.state.events
      .filter(event => new Date(event.startDate) > now)
      .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
      .slice(0, 5);

    if (upcoming.length === 0) {
      container.innerHTML = '<p class="text-muted">No upcoming events</p>';
      return;
    }

    container.innerHTML = upcoming.map(event => `
      <div class="upcoming-event-item">
        <div class="event-date">
          ${new Date(event.startDate).toLocaleDateString()}
        </div>
        <div class="event-details">
          <h6>${event.title}</h6>
          <small class="text-muted">
            ${new Date(event.startDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            ${event.location ? ` • ${event.location}` : ''}
          </small>
        </div>
      </div>
    `).join('');
  }

  async loadGroupMembers() {
    try {
      const response = await apiClient.get(`/api/groups/${this.config.groupId}/members`);
      const select = document.getElementById('event-attendees');
      
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

  showError(message) {
    console.error(message);
  }

  // Additional view rendering methods would be implemented here
  renderWeekView() { /* Implementation */ }
  renderDayView() { /* Implementation */ }
  renderListView() { /* Implementation */ }
}

// Make it globally accessible for event handlers
window.eventScheduler = null;
