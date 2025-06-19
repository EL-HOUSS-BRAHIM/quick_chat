/**
 * User Manager Module
 * Handles user management in the admin panel
 */

import apiClient from '../../api/api-client.js';
import errorHandler from '../../core/error-handler.js';
import eventBus from '../../core/event-bus.js';
import { state } from '../../core/state.js';
import * as utils from '../../core/utils.js';

class UserManager {
  constructor() {
    this.users = [];
    this.filteredUsers = [];
    this.roles = ['user', 'moderator', 'admin'];
    this.pageSize = 10;
    this.currentPage = 1;
  }

  /**
   * Initialize user manager
   */
  async init() {
    try {
      // Find elements
      this.elements = {
        usersList: document.querySelector('.users-table tbody'),
        userSearch: document.getElementById('userSearch'),
        addUserBtn: document.querySelector('button[onclick="showAddUserModal()"]'),
        userModal: document.getElementById('userModal'),
        userForm: document.getElementById('userForm'),
        userPagination: document.getElementById('userPagination')
      };

      // Set up event listeners
      this.setupEventListeners();

      // Subscribe to global events
      this.setupGlobalEvents();
    } catch (error) {
      errorHandler.handleError(error, 'Failed to initialize user manager');
    }
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Add user button
    if (this.elements.addUserBtn) {
      this.elements.addUserBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.showUserModal();
      });
    }

    // User form submit
    if (this.elements.userForm) {
      this.elements.userForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleUserFormSubmit(e.target);
      });
    }

    // User search
    if (this.elements.userSearch) {
      this.elements.userSearch.addEventListener('input', (e) => {
        this.filterUsers(e.target.value);
      });
    }

    // Delegate for user actions (edit, delete)
    document.addEventListener('click', (e) => {
      // Edit user button
      if (e.target.matches('button[onclick^="editUser("]') || e.target.closest('button[onclick^="editUser("]')) {
        e.preventDefault();
        const userId = parseInt(e.target.getAttribute('onclick').match(/editUser\((\d+)\)/)[1] || 
                      e.target.closest('button').getAttribute('onclick').match(/editUser\((\d+)\)/)[1]);
        this.editUser(userId);
      }

      // Delete user button
      if (e.target.matches('button[onclick^="deleteUser("]') || e.target.closest('button[onclick^="deleteUser("]')) {
        e.preventDefault();
        const userId = parseInt(e.target.getAttribute('onclick').match(/deleteUser\((\d+)\)/)[1] || 
                      e.target.closest('button').getAttribute('onclick').match(/deleteUser\((\d+)\)/)[1]);
        this.deleteUser(userId);
      }
    });
  }

  /**
   * Setup global event subscriptions
   */
  setupGlobalEvents() {
    // Listen for admin search events
    eventBus.subscribe('admin:search', ({ query }) => {
      if (this.elements.userSearch) {
        this.elements.userSearch.value = query;
        this.filterUsers(query);
      }
    });

    // Listen for tab changes
    eventBus.subscribe('admin:tabChanged', ({ tab }) => {
      if (tab === 'users' && this.users.length === 0) {
        this.loadUsers();
      }
    });
  }

  /**
   * Load users from API
   */
  async loadUsers() {
    try {
      state.update('admin', { isLoading: true });

      const response = await apiClient.get('/api/admin.php', {
        action: 'get_users'
      });

      if (response.success) {
        this.users = response.data;
        this.filteredUsers = [...this.users];
        state.update('admin', { users: this.users });
        this.renderUsers();
      } else {
        throw new Error(response.error || 'Failed to load users');
      }
    } catch (error) {
      errorHandler.handleError(error, 'Failed to load users');
    } finally {
      state.update('admin', { isLoading: false });
    }
  }

  /**
   * Filter users based on search term
   */
  filterUsers(searchTerm = '') {
    if (!searchTerm.trim()) {
      this.filteredUsers = [...this.users];
    } else {
      const term = searchTerm.toLowerCase().trim();
      this.filteredUsers = this.users.filter(user =>
        user.username.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term) ||
        (user.display_name && user.display_name.toLowerCase().includes(term))
      );
    }

    this.currentPage = 1;
    this.renderUsers();
  }

  /**
   * Render users to the table
   */
  renderUsers() {
    if (!this.elements.usersList) return;

    // Calculate pagination
    const totalPages = Math.ceil(this.filteredUsers.length / this.pageSize);
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    const currentUsers = this.filteredUsers.slice(startIndex, endIndex);

    // Render users
    this.elements.usersList.innerHTML = '';

    if (currentUsers.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="5" class="no-results">No users found</td>';
      this.elements.usersList.appendChild(row);
      return;
    }

    currentUsers.forEach(user => {
      const row = document.createElement('tr');
      
      // Format the row with user data
      row.innerHTML = `
        <td>
          <div class="user-info">
            <div class="user-avatar-small">
              <img src="${user.avatar || 'assets/images/default-avatar.png'}" 
                   alt="${utils.escapeHtml(user.display_name || user.username)}">
            </div>
            <div>
              <div class="user-name">${utils.escapeHtml(user.display_name || user.username)}</div>
              <div class="username">@${utils.escapeHtml(user.username)}</div>
            </div>
          </div>
        </td>
        <td>
          ${utils.escapeHtml(user.email)}
          ${!user.email_verified ? '<span class="badge unverified">Unverified</span>' : ''}
        </td>
        <td>
          <span class="status-badge ${user.is_online ? 'online' : 'offline'}">
            ${user.is_online ? 'Online' : 'Offline'}
          </span>
        </td>
        <td>${utils.formatDate(user.created_at)}</td>
        <td>
          <div class="action-buttons">
            <button class="btn-small" onclick="editUser(${user.id})" title="Edit">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn-small danger" onclick="deleteUser(${user.id})" title="Delete">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      `;
      
      this.elements.usersList.appendChild(row);
    });

    // Render pagination if needed
    this.renderPagination(totalPages);
  }

  /**
   * Render pagination controls
   */
  renderPagination(totalPages) {
    if (!this.elements.userPagination) return;
    
    if (totalPages <= 1) {
      this.elements.userPagination.innerHTML = '';
      return;
    }

    let html = '';
    // Previous button
    html += `<button class="pagination-btn ${this.currentPage === 1 ? 'disabled' : ''}" 
              ${this.currentPage === 1 ? 'disabled' : `onclick="changePage(${this.currentPage - 1})"`}>
              <i class="fas fa-chevron-left"></i>
            </button>`;
    
    // Page buttons
    const pageToShow = 5;
    const startPage = Math.max(1, this.currentPage - Math.floor(pageToShow / 2));
    const endPage = Math.min(totalPages, startPage + pageToShow - 1);
    
    for (let i = startPage; i <= endPage; i++) {
      html += `<button class="pagination-btn ${i === this.currentPage ? 'active' : ''}" 
                onclick="changePage(${i})">${i}</button>`;
    }
    
    // Next button
    html += `<button class="pagination-btn ${this.currentPage === totalPages ? 'disabled' : ''}" 
              ${this.currentPage === totalPages ? 'disabled' : `onclick="changePage(${this.currentPage + 1})"`}>
              <i class="fas fa-chevron-right"></i>
            </button>`;
    
    this.elements.userPagination.innerHTML = html;
    
    // Add event listener for pagination
    window.changePage = (page) => {
      this.currentPage = page;
      this.renderUsers();
    };
  }

  /**
   * Show user modal for adding or editing a user
   */
  showUserModal(userId = null) {
    const modal = this.elements.userModal;
    if (!modal) return;

    const user = userId ? this.users.find(u => u.id === userId) : null;
    const title = user ? 'Edit User' : 'Add New User';
    
    // Update modal title and form
    modal.querySelector('.modal-title').textContent = title;
    
    const form = modal.querySelector('form');
    if (form) {
      // Reset form
      form.reset();
      
      // Set user data if editing
      if (user) {
        form.elements.userId.value = user.id;
        form.elements.username.value = user.username;
        form.elements.email.value = user.email;
        form.elements.displayName.value = user.display_name || '';
        
        // Set role if it exists
        if (form.elements.role && user.role) {
          form.elements.role.value = user.role;
        }
        
        // Disable username if editing
        form.elements.username.disabled = true;
      } else {
        form.elements.userId.value = '';
        form.elements.username.disabled = false;
      }
    }
    
    // Show modal
    modal.classList.add('show');
  }

  /**
   * Handle user form submit (add or edit)
   */
  async handleUserFormSubmit(form) {
    try {
      const userId = form.elements.userId.value;
      const userData = {
        username: form.elements.username.value,
        email: form.elements.email.value,
        display_name: form.elements.displayName.value,
        role: form.elements.role ? form.elements.role.value : 'user'
      };
      
      // Add password for new users
      if (!userId) {
        userData.password = form.elements.password.value;
      }
      
      const endpoint = '/api/admin.php';
      const action = userId ? 'update_user' : 'create_user';
      const params = userId ? { id: userId, ...userData } : userData;
      
      const response = await apiClient.post(endpoint, params, { action });
      
      if (response.success) {
        // Close modal
        this.elements.userModal.classList.remove('show');
        
        // Reload users
        await this.loadUsers();
        
        // Show success message
        utils.showToast(userId ? 'User updated successfully' : 'User created successfully', 'success');
        
        // Notify other modules
        eventBus.publish('admin:userUpdated', { userId: response.data.id });
      } else {
        throw new Error(response.error || 'Failed to save user');
      }
    } catch (error) {
      errorHandler.handleError(error, 'Failed to save user');
    }
  }

  /**
   * Edit user
   */
  editUser(userId) {
    this.showUserModal(userId);
  }

  /**
   * Delete user
   */
  async deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }
    
    try {
      const response = await apiClient.post('/api/admin.php', { id: userId }, { action: 'delete_user' });
      
      if (response.success) {
        // Remove from local array
        this.users = this.users.filter(u => u.id !== userId);
        this.filteredUsers = this.filteredUsers.filter(u => u.id !== userId);
        
        // Update state
        state.update('admin', { users: this.users });
        
        // Re-render
        this.renderUsers();
        
        // Show success message
        utils.showToast('User deleted successfully', 'success');
        
        // Notify other modules
        eventBus.publish('admin:userUpdated');
      } else {
        throw new Error(response.error || 'Failed to delete user');
      }
    } catch (error) {
      errorHandler.handleError(error, 'Failed to delete user');
    }
  }
}

export default UserManager;
