/**
 * Chat Search Module
 * Handles searching through messages
 */

import apiClient from '../../api/api-client.js';
import eventBus from '../../core/event-bus.js';
import { debounce } from '../../core/utils.js';

class ChatSearch {
  constructor() {
    this.searchInput = null;
    this.searchResults = null;
    this.searchResultsContainer = null;
    this.isSearching = false;
    this.currentQuery = '';
    this.currentFilter = 'all';
    this.totalResults = 0;
    this.currentPage = 1;
    this.resultsPerPage = 10;
    
    // Bind methods
    this.performSearch = this.performSearch.bind(this);
    this.showResults = this.showResults.bind(this);
    this.hideResults = this.hideResults.bind(this);
    this.handleSearchInput = debounce(this.handleSearchInput.bind(this), 300);
    this.navigateToMessage = this.navigateToMessage.bind(this);
    
    // Initialize
    this.init();
  }
  
  /**
   * Initialize search module
   */
  init() {
    // Find search elements
    this.searchInput = document.getElementById('messageSearchInput');
    this.searchResultsContainer = document.getElementById('searchResultsContainer');
    
    if (!this.searchInput) {
      return; // No search input found
    }
    
    if (!this.searchResultsContainer) {
      this.createSearchResultsContainer();
    } else {
      this.searchResults = this.searchResultsContainer.querySelector('.search-results-list');
    }
    
    // Set up event listeners
    this.setupEventListeners();
  }
  
  /**
   * Create search results container
   */
  createSearchResultsContainer() {
    const container = document.createElement('div');
    container.id = 'searchResultsContainer';
    container.className = 'search-results-container';
    container.innerHTML = `
      <div class="search-results-header">
        <h3>Search Results</h3>
        <div class="search-filters">
          <select id="searchFilterSelect">
            <option value="all">All Messages</option>
            <option value="text">Text Only</option>
            <option value="media">Media</option>
            <option value="files">Files</option>
          </select>
        </div>
        <button class="close-search" aria-label="Close search">×</button>
      </div>
      <div class="search-results-list"></div>
      <div class="search-results-footer">
        <div class="search-results-count">No results</div>
        <div class="search-results-pagination">
          <button class="prev-page" disabled>Previous</button>
          <span class="page-info">Page 1</span>
          <button class="next-page" disabled>Next</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(container);
    this.searchResultsContainer = container;
    this.searchResults = container.querySelector('.search-results-list');
    
    // Add close button handler
    const closeBtn = container.querySelector('.close-search');
    if (closeBtn) {
      closeBtn.addEventListener('click', this.hideResults);
    }
    
    // Add filter change handler
    const filterSelect = container.querySelector('#searchFilterSelect');
    if (filterSelect) {
      filterSelect.addEventListener('change', () => {
        this.currentFilter = filterSelect.value;
        this.currentPage = 1;
        this.performSearch();
      });
    }
    
    // Add pagination handlers
    const prevBtn = container.querySelector('.prev-page');
    const nextBtn = container.querySelector('.next-page');
    
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (this.currentPage > 1) {
          this.currentPage--;
          this.performSearch();
        }
      });
    }
    
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(this.totalResults / this.resultsPerPage);
        if (this.currentPage < totalPages) {
          this.currentPage++;
          this.performSearch();
        }
      });
    }
  }
  
  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Search input handler
    this.searchInput.addEventListener('input', this.handleSearchInput);
    
    // Clear search
    this.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.clearSearch();
      }
    });
    
    // Global delegation for result clicks
    document.addEventListener('click', (e) => {
      const resultItem = e.target.closest('.search-result-item');
      if (resultItem) {
        const messageId = resultItem.dataset.messageId;
        if (messageId) {
          this.navigateToMessage(messageId);
        }
      }
    });
    
    // Subscribe to events
    eventBus.subscribe('chat:search:perform', ({ query }) => {
      this.searchInput.value = query;
      this.handleSearchInput();
    });
  }
  
  /**
   * Handle search input
   */
  handleSearchInput() {
    const query = this.searchInput.value.trim();
    this.currentQuery = query;
    
    if (query.length >= 2) {
      this.currentPage = 1;
      this.performSearch();
    } else if (query.length === 0) {
      this.clearSearch();
    }
  }
  
  /**
   * Perform search
   */
  async performSearch() {
    if (!this.currentQuery || this.currentQuery.length < 2) return;
    
    this.isSearching = true;
    
    try {
      // Show loading state
      this.showResults();
      this.searchResults.innerHTML = '<div class="search-loading">Searching...</div>';
      
      const response = await apiClient.get('/api/messages.php', {
        action: 'search',
        query: this.currentQuery,
        filter: this.currentFilter,
        page: this.currentPage,
        limit: this.resultsPerPage
      });
      
      if (response.success) {
        this.renderSearchResults(response.data.results);
        this.totalResults = response.data.total;
        this.updatePagination();
      } else {
        this.searchResults.innerHTML = `<div class="search-error">${response.error || 'Search failed'}</div>`;
      }
    } catch (error) {
      console.error('Search error:', error);
      this.searchResults.innerHTML = '<div class="search-error">Failed to perform search</div>';
    } finally {
      this.isSearching = false;
    }
  }
  
  /**
   * Render search results
   * @param {Array} results Search results
   */
  renderSearchResults(results) {
    if (!results || results.length === 0) {
      this.searchResults.innerHTML = '<div class="no-results">No messages found</div>';
      return;
    }
    
    const resultItems = results.map(message => {
      const date = new Date(message.timestamp * 1000);
      const formattedDate = date.toLocaleString();
      
      return `
        <div class="search-result-item" data-message-id="${message.id}">
          <div class="result-sender">${message.sender}</div>
          <div class="result-content">${this.highlightQuery(message.content)}</div>
          <div class="result-time">${formattedDate}</div>
        </div>
      `;
    }).join('');
    
    this.searchResults.innerHTML = resultItems;
  }
  
  /**
   * Highlight search query in content
   * @param {string} content Message content
   * @returns {string} Highlighted content
   */
  highlightQuery(content) {
    if (!this.currentQuery) return content;
    
    const regex = new RegExp(`(${this.currentQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return content.replace(regex, '<mark>$1</mark>');
  }
  
  /**
   * Update pagination controls
   */
  updatePagination() {
    const totalPages = Math.ceil(this.totalResults / this.resultsPerPage);
    
    // Update count
    const countElem = this.searchResultsContainer.querySelector('.search-results-count');
    if (countElem) {
      countElem.textContent = this.totalResults === 1 
        ? '1 result found' 
        : `${this.totalResults} results found`;
    }
    
    // Update page info
    const pageInfoElem = this.searchResultsContainer.querySelector('.page-info');
    if (pageInfoElem) {
      pageInfoElem.textContent = `Page ${this.currentPage} of ${totalPages || 1}`;
    }
    
    // Update buttons
    const prevBtn = this.searchResultsContainer.querySelector('.prev-page');
    const nextBtn = this.searchResultsContainer.querySelector('.next-page');
    
    if (prevBtn) {
      prevBtn.disabled = this.currentPage <= 1;
    }
    
    if (nextBtn) {
      nextBtn.disabled = this.currentPage >= totalPages;
    }
  }
  
  /**
   * Navigate to a specific message
   * @param {string} messageId Message ID
   */
  navigateToMessage(messageId) {
    eventBus.publish('chat:navigate:message', { messageId });
    this.hideResults();
  }
  
  /**
   * Show search results
   */
  showResults() {
    if (this.searchResultsContainer) {
      this.searchResultsContainer.classList.add('visible');
    }
  }
  
  /**
   * Hide search results
   */
  hideResults() {
    if (this.searchResultsContainer) {
      this.searchResultsContainer.classList.remove('visible');
    }
  }
  
  /**
   * Clear search
   */
  clearSearch() {
    if (this.searchInput) {
      this.searchInput.value = '';
    }
    
    this.currentQuery = '';
    this.hideResults();
    
    // Reset state
    this.totalResults = 0;
    this.currentPage = 1;
  }
}

export default ChatSearch;
