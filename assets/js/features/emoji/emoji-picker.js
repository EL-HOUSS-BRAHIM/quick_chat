/**
 * Emoji Picker Module
 * 
 * A modular, reusable emoji picker component for the chat interface.
 * Supports emoji categorization, search, and recent emojis.
 */

import eventBus from '../../core/event-bus.js';
import storageService from '../../services/storage-service.js';

class EmojiPicker {
  constructor(options = {}) {
    this.options = {
      container: null,
      targetInput: null,
      recentCount: 36,
      showCategories: true,
      showSearch: true,
      position: 'bottom',
      ...options
    };
    
    this.element = null;
    this.searchInput = null;
    this.emojiContainer = null;
    this.categoriesContainer = null;
    this.visible = false;
    this.activeCategory = 'recent';
    
    // Store reference to bound handlers for event removal
    this.handleDocumentClick = this._handleDocumentClick.bind(this);
    
    // Categories and their icons
    this.categories = [
      { id: 'recent', name: 'Recently Used', icon: 'history' },
      { id: 'smileys', name: 'Smileys & Emotion', icon: 'smile' },
      { id: 'people', name: 'People & Body', icon: 'user' },
      { id: 'nature', name: 'Animals & Nature', icon: 'leaf' },
      { id: 'food', name: 'Food & Drink', icon: 'utensils' },
      { id: 'activities', name: 'Activities', icon: 'futbol' },
      { id: 'travel', name: 'Travel & Places', icon: 'plane' },
      { id: 'objects', name: 'Objects', icon: 'lightbulb' },
      { id: 'symbols', name: 'Symbols', icon: 'hashtag' },
      { id: 'flags', name: 'Flags', icon: 'flag' }
    ];
  }
  
  /**
   * Initialize the emoji picker
   * @returns {EmojiPicker} - The emoji picker instance
   */
  init() {
    this._createElements();
    this._loadEmojis();
    this._loadRecentEmojis();
    this._addEventListeners();
    
    return this;
  }
  
  /**
   * Show the emoji picker
   * @param {HTMLElement} targetElement - Element to position the picker relative to
   */
  show(targetElement = null) {
    if (this.visible) return;
    
    // If target element provided, use it for positioning
    if (targetElement) {
      this._positionPickerByElement(targetElement);
    }
    
    // Show the picker
    this.element.classList.add('show');
    this.visible = true;
    
    // Add document click handler to close when clicking outside
    document.addEventListener('click', this.handleDocumentClick);
    
    // Focus search input if present
    if (this.searchInput) {
      setTimeout(() => this.searchInput.focus(), 100);
    }
    
    // Trigger event
    eventBus.emit('emoji:picker:show');
  }
  
  /**
   * Hide the emoji picker
   */
  hide() {
    if (!this.visible) return;
    
    this.element.classList.remove('show');
    this.visible = false;
    
    // Remove document click handler
    document.removeEventListener('click', this.handleDocumentClick);
    
    // Clear search
    if (this.searchInput) {
      this.searchInput.value = '';
      this._handleSearch('');
    }
    
    // Trigger event
    eventBus.emit('emoji:picker:hide');
  }
  
  /**
   * Toggle the emoji picker visibility
   * @param {HTMLElement} targetElement - Element to position the picker relative to
   */
  toggle(targetElement = null) {
    if (this.visible) {
      this.hide();
    } else {
      this.show(targetElement);
    }
  }
  
  /**
   * Insert an emoji into the target input
   * @param {string} emoji - The emoji character to insert
   */
  insertEmoji(emoji) {
    // Add to recent emojis
    this._addToRecentEmojis(emoji);
    
    // Get target input
    const input = this.options.targetInput || document.activeElement;
    
    if (input && 'selectionStart' in input) {
      // Insert at cursor position for inputs and textareas
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const text = input.value;
      
      input.value = text.substring(0, start) + emoji + text.substring(end);
      
      // Move cursor after the inserted emoji
      input.selectionStart = input.selectionEnd = start + emoji.length;
      
      // Trigger input event
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (input && input.isContentEditable) {
      // Insert at cursor position for contenteditable elements
      const selection = window.getSelection();
      const range = selection.getRangeAt(0);
      
      const node = document.createTextNode(emoji);
      range.deleteContents();
      range.insertNode(node);
      
      // Move cursor after the inserted emoji
      range.setStartAfter(node);
      range.setEndAfter(node);
      selection.removeAllRanges();
      selection.addRange(range);
      
      // Trigger input event
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    // Hide picker after selection
    this.hide();
    
    // Trigger event
    eventBus.emit('emoji:inserted', { emoji });
  }
  
  /**
   * Create the emoji picker elements
   * @private
   */
  _createElements() {
    // Create picker container
    this.element = document.createElement('div');
    this.element.className = 'emoji-picker';
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-label', 'Emoji picker');
    
    // Create header
    const header = document.createElement('div');
    header.className = 'emoji-picker-header';
    
    // Add search if enabled
    if (this.options.showSearch) {
      const searchContainer = document.createElement('div');
      searchContainer.className = 'emoji-search-container';
      
      this.searchInput = document.createElement('input');
      this.searchInput.type = 'text';
      this.searchInput.className = 'emoji-search';
      this.searchInput.placeholder = 'Search emojis...';
      this.searchInput.setAttribute('aria-label', 'Search emojis');
      
      const searchIcon = document.createElement('span');
      searchIcon.className = 'emoji-search-icon';
      searchIcon.innerHTML = '<i class="fas fa-search"></i>';
      
      searchContainer.appendChild(this.searchInput);
      searchContainer.appendChild(searchIcon);
      header.appendChild(searchContainer);
    }
    
    this.element.appendChild(header);
    
    // Create categories if enabled
    if (this.options.showCategories) {
      this.categoriesContainer = document.createElement('div');
      this.categoriesContainer.className = 'emoji-categories';
      
      // Create category buttons
      this.categories.forEach(category => {
        const button = document.createElement('button');
        button.className = 'emoji-category';
        button.dataset.category = category.id;
        button.setAttribute('aria-label', category.name);
        button.title = category.name;
        button.innerHTML = `<i class="fas fa-${category.icon}"></i>`;
        
        // Set active class for initial category
        if (category.id === this.activeCategory) {
          button.classList.add('active');
        }
        
        button.addEventListener('click', () => {
          this._switchCategory(category.id);
        });
        
        this.categoriesContainer.appendChild(button);
      });
      
      this.element.appendChild(this.categoriesContainer);
    }
    
    // Create emoji container
    this.emojiContainer = document.createElement('div');
    this.emojiContainer.className = 'emoji-container';
    this.element.appendChild(this.emojiContainer);
    
    // Append to specified container or body
    const container = this.options.container ? 
      (typeof this.options.container === 'string' ? 
        document.querySelector(this.options.container) : 
        this.options.container) : 
      document.body;
    
    container.appendChild(this.element);
  }
  
  /**
   * Load emojis data
   * @private
   */
  _loadEmojis() {
    // This is where we would typically load emoji data from a JSON file
    // For simplicity, we'll use a small subset of emojis directly in the code
    
    // In a real implementation, you would fetch this data from a file or API
    this.emojisByCategory = {
      smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚'],
      people: ['👶', '👧', '🧒', '👦', '👩', '🧑', '👨', '👵', '🧓', '👴', '👲', '👳‍♀️', '👳‍♂️', '🧕', '👮‍♀️', '👮‍♂️', '👷‍♀️', '👷‍♂️'],
      nature: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊'],
      food: ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆'],
      activities: ['⚽', '🏀', '🏈', '⚾', '🥎', '🏐', '🏉', '🎱', '🏓', '🏸', '🥅', '🏒', '🏑', '🥍', '🏏', '🥌', '🛷', '🎿'],
      travel: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎', '🚓', '🚑', '🚒', '🚐', '🚚', '🚛', '🚜', '🛴', '🚲', '🛵', '🏍', '🚨'],
      objects: ['⌚', '📱', '📲', '💻', '⌨️', '🖥', '🖨', '🖱', '🖲', '🕹', '🗜', '💽', '💾', '💿', '📀', '📼', '📷', '📸'],
      symbols: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️'],
      flags: ['🏳️', '🏴', '🏁', '🚩', '🏳️‍🌈', '🏴‍☠️', '🇦🇫', '🇦🇽', '🇦🇱', '🇩🇿', '🇦🇸', '🇦🇩', '🇦🇴', '🇦🇮', '🇦🇶', '🇦🇬', '🇦🇷', '🇦🇲']
    };
    
    // Initialize with recent emojis or smileys
    this._displayEmojiCategory(this.activeCategory);
  }
  
  /**
   * Load recent emojis from storage
   * @private
   */
  _loadRecentEmojis() {
    try {
      const recentEmojis = storageService.get('recent_emojis', []);
      this.emojisByCategory.recent = recentEmojis;
    } catch (e) {
      console.error('Error loading recent emojis:', e);
      this.emojisByCategory.recent = [];
    }
  }
  
  /**
   * Add an emoji to recent emojis
   * @private
   * @param {string} emoji - The emoji to add to recents
   */
  _addToRecentEmojis(emoji) {
    // Get current recent emojis
    let recentEmojis = [...(this.emojisByCategory.recent || [])];
    
    // Remove emoji if it already exists
    recentEmojis = recentEmojis.filter(e => e !== emoji);
    
    // Add emoji to the beginning
    recentEmojis.unshift(emoji);
    
    // Limit to recentCount
    recentEmojis = recentEmojis.slice(0, this.options.recentCount);
    
    // Update storage and category
    this.emojisByCategory.recent = recentEmojis;
    storageService.set('recent_emojis', recentEmojis);
    
    // Refresh display if on recent category
    if (this.activeCategory === 'recent' && this.visible) {
      this._displayEmojiCategory('recent');
    }
  }
  
  /**
   * Display emojis for a category
   * @private
   * @param {string} categoryId - Category ID to display
   */
  _displayEmojiCategory(categoryId) {
    // Clear container
    this.emojiContainer.innerHTML = '';
    
    // Use fallback if category doesn't exist or is empty
    const emojis = (this.emojisByCategory[categoryId] && this.emojisByCategory[categoryId].length) ? 
      this.emojisByCategory[categoryId] : 
      (categoryId === 'recent' ? this.emojisByCategory.smileys : []);
    
    // Create header for category
    const categoryHeader = document.createElement('div');
    categoryHeader.className = 'emoji-category-header';
    
    const category = this.categories.find(c => c.id === categoryId);
    categoryHeader.textContent = category ? category.name : 'Emojis';
    
    this.emojiContainer.appendChild(categoryHeader);
    
    // Display emojis
    const emojiGrid = document.createElement('div');
    emojiGrid.className = 'emoji-grid';
    
    emojis.forEach(emoji => {
      const button = document.createElement('button');
      button.className = 'emoji';
      button.textContent = emoji;
      button.setAttribute('aria-label', `Emoji ${emoji}`);
      button.title = `Emoji ${emoji}`;
      
      button.addEventListener('click', () => {
        this.insertEmoji(emoji);
      });
      
      emojiGrid.appendChild(button);
    });
    
    this.emojiContainer.appendChild(emojiGrid);
    
    // Update active category
    this.activeCategory = categoryId;
    
    // Update category buttons
    if (this.categoriesContainer) {
      const buttons = this.categoriesContainer.querySelectorAll('.emoji-category');
      buttons.forEach(button => {
        button.classList.toggle('active', button.dataset.category === categoryId);
      });
    }
  }
  
  /**
   * Switch to a different category
   * @private
   * @param {string} categoryId - Category ID to switch to
   */
  _switchCategory(categoryId) {
    // Clear search
    if (this.searchInput) {
      this.searchInput.value = '';
    }
    
    // Display category
    this._displayEmojiCategory(categoryId);
  }
  
  /**
   * Handle search input
   * @private
   * @param {string} query - Search query
   */
  _handleSearch(query) {
    if (!query) {
      // If search is cleared, show active category
      this._displayEmojiCategory(this.activeCategory);
      return;
    }
    
    // Normalize query
    const normalizedQuery = query.toLowerCase().trim();
    
    // Search in all categories
    const results = [];
    
    Object.values(this.emojisByCategory).forEach(categoryEmojis => {
      categoryEmojis.forEach(emoji => {
        // Very basic search - in a real implementation, you would search
        // emoji names, keywords, etc.
        if (results.indexOf(emoji) === -1) {
          results.push(emoji);
        }
      });
    });
    
    // Display results
    this.emojiContainer.innerHTML = '';
    
    // Create header for search results
    const searchHeader = document.createElement('div');
    searchHeader.className = 'emoji-category-header';
    searchHeader.textContent = `Search Results: "${query}"`;
    
    this.emojiContainer.appendChild(searchHeader);
    
    // Display results
    const emojiGrid = document.createElement('div');
    emojiGrid.className = 'emoji-grid';
    
    if (results.length > 0) {
      results.forEach(emoji => {
        const button = document.createElement('button');
        button.className = 'emoji';
        button.textContent = emoji;
        button.setAttribute('aria-label', `Emoji ${emoji}`);
        button.title = `Emoji ${emoji}`;
        
        button.addEventListener('click', () => {
          this.insertEmoji(emoji);
        });
        
        emojiGrid.appendChild(button);
      });
    } else {
      // No results
      const noResults = document.createElement('div');
      noResults.className = 'emoji-no-results';
      noResults.textContent = 'No emojis found';
      emojiGrid.appendChild(noResults);
    }
    
    this.emojiContainer.appendChild(emojiGrid);
  }
  
  /**
   * Add event listeners
   * @private
   */
  _addEventListeners() {
    // Search input
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        this._handleSearch(e.target.value);
      });
    }
    
    // Prevent clicks inside picker from closing it
    this.element.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
  
  /**
   * Handle document click to close picker when clicking outside
   * @private
   * @param {Event} e - Click event
   */
  _handleDocumentClick(e) {
    // Check if click is outside the picker
    if (!this.element.contains(e.target)) {
      this.hide();
    }
  }
  
  /**
   * Position picker next to a target element
   * @private
   * @param {HTMLElement} targetElement - Element to position relative to
   */
  _positionPickerByElement(targetElement) {
    const rect = targetElement.getBoundingClientRect();
    const pickerHeight = 320; // Approximate height
    const pickerWidth = 280; // Approximate width
    
    // Check if there's enough space below
    const spaceBelow = window.innerHeight - rect.bottom;
    const position = this.options.position === 'auto' ?
      (spaceBelow >= pickerHeight ? 'bottom' : 'top') :
      this.options.position;
    
    // Position based on available space
    if (position === 'bottom') {
      this.element.style.top = `${rect.bottom}px`;
    } else if (position === 'top') {
      this.element.style.top = `${rect.top - pickerHeight}px`;
    }
    
    // Center horizontally with constraints
    const left = Math.max(0, Math.min(window.innerWidth - pickerWidth, rect.left + rect.width / 2 - pickerWidth / 2));
    this.element.style.left = `${left}px`;
  }
}

// Export the class and a factory function
export default EmojiPicker;

// Create a singleton instance for common use
const emojiPickerInstance = new EmojiPicker();

export { emojiPickerInstance };
