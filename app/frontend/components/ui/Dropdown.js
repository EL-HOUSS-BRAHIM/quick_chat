/**
 * Dropdown Component
 * 
 * Reusable dropdown/select component with search and accessibility features
 */

import { EventBus } from '../../services/EventBus.js';
import { logger } from '../../utils/logger.js';

export class Dropdown {
  constructor(config = {}) {
    this.config = {
      options: config.options || [],
      value: config.value || null,
      placeholder: config.placeholder || 'Select an option',
      label: config.label || '',
      required: config.required || false,
      disabled: config.disabled || false,
      searchable: config.searchable || false,
      clearable: config.clearable || false,
      multiple: config.multiple || false,
      maxHeight: config.maxHeight || '200px',
      className: config.className || '',
      containerClassName: config.containerClassName || '',
      onChange: config.onChange || null,
      onSearch: config.onSearch || null,
      ...config
    };

    this.eventBus = new EventBus();
    this.container = null;
    this.button = null;
    this.dropdown = null;
    this.searchInput = null;
    this.optionsList = null;
    this.label = null;
    this.isOpen = false;
    this.selectedOptions = this.config.multiple ? (Array.isArray(this.config.value) ? this.config.value : []) : [];
    this.filteredOptions = [...this.config.options];
    this.focusedIndex = -1;
  }

  /**
   * Create the dropdown element
   */
  createElement() {
    this.container = document.createElement('div');
    this.container.className = `dropdown-group ${this.config.containerClassName}`.trim();

    // Create label if provided
    if (this.config.label) {
      this.label = document.createElement('label');
      this.label.className = 'dropdown-label';
      this.label.textContent = this.config.label;
      
      if (this.config.required) {
        this.label.innerHTML += ' <span class="dropdown-required" aria-label="required">*</span>';
      }
      
      this.container.appendChild(this.label);
    }

    // Create dropdown button
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = `dropdown-button ${this.config.className}`.trim();
    this.button.setAttribute('aria-expanded', 'false');
    this.button.setAttribute('aria-haspopup', 'listbox');

    if (this.config.disabled) {
      this.button.disabled = true;
    }

    // Create dropdown content
    this.dropdown = document.createElement('div');
    this.dropdown.className = 'dropdown-content';
    this.dropdown.style.maxHeight = this.config.maxHeight;
    this.dropdown.style.display = 'none';

    // Create search input if searchable
    if (this.config.searchable) {
      this.searchInput = document.createElement('input');
      this.searchInput.type = 'text';
      this.searchInput.className = 'dropdown-search';
      this.searchInput.placeholder = 'Search...';
      this.dropdown.appendChild(this.searchInput);
    }

    // Create options list
    this.optionsList = document.createElement('ul');
    this.optionsList.className = 'dropdown-options';
    this.optionsList.setAttribute('role', 'listbox');
    
    if (this.config.multiple) {
      this.optionsList.setAttribute('aria-multiselectable', 'true');
    }

    this.dropdown.appendChild(this.optionsList);

    this.container.appendChild(this.button);
    this.container.appendChild(this.dropdown);

    this.updateButtonText();
    this.renderOptions();
    this.bindEvents();

    return this.container;
  }

  /**
   * Render options in the dropdown
   */
  renderOptions() {
    if (!this.optionsList) return;

    this.optionsList.innerHTML = '';

    if (this.filteredOptions.length === 0) {
      const noOptions = document.createElement('li');
      noOptions.className = 'dropdown-option dropdown-option--no-results';
      noOptions.textContent = 'No options found';
      this.optionsList.appendChild(noOptions);
      return;
    }

    this.filteredOptions.forEach((option, index) => {
      const li = document.createElement('li');
      li.className = 'dropdown-option';
      li.setAttribute('role', 'option');
      li.dataset.value = option.value;
      li.dataset.index = index;

      const isSelected = this.config.multiple 
        ? this.selectedOptions.includes(option.value)
        : this.config.value === option.value;

      if (isSelected) {
        li.classList.add('dropdown-option--selected');
        li.setAttribute('aria-selected', 'true');
      } else {
        li.setAttribute('aria-selected', 'false');
      }

      li.innerHTML = `
        ${this.config.multiple ? `<span class="dropdown-checkbox" aria-hidden="true">${isSelected ? '✓' : ''}</span>` : ''}
        <span class="dropdown-option-text">${option.label}</span>
      `;

      this.optionsList.appendChild(li);
    });
  }

  /**
   * Update button text based on selection
   */
  updateButtonText() {
    if (!this.button) return;

    let text = this.config.placeholder;

    if (this.config.multiple) {
      if (this.selectedOptions.length === 0) {
        text = this.config.placeholder;
      } else if (this.selectedOptions.length === 1) {
        const option = this.config.options.find(opt => opt.value === this.selectedOptions[0]);
        text = option ? option.label : this.selectedOptions[0];
      } else {
        text = `${this.selectedOptions.length} items selected`;
      }
    } else {
      if (this.config.value) {
        const option = this.config.options.find(opt => opt.value === this.config.value);
        text = option ? option.label : this.config.value;
      }
    }

    this.button.innerHTML = `
      <span class="dropdown-button-text">${text}</span>
      <span class="dropdown-arrow" aria-hidden="true">▼</span>
    `;
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    if (!this.button || !this.dropdown) return;

    // Button click
    this.button.addEventListener('click', () => {
      if (!this.config.disabled) {
        this.toggle();
      }
    });

    // Options click
    this.optionsList.addEventListener('click', (e) => {
      const option = e.target.closest('.dropdown-option');
      if (option && !option.classList.contains('dropdown-option--no-results')) {
        const value = option.dataset.value;
        this.selectOption(value);
      }
    });

    // Search input
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        this.filterOptions(e.target.value);
      });

      this.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.close();
        }
      });
    }

    // Keyboard navigation
    this.button.addEventListener('keydown', (e) => {
      this.handleKeydown(e);
    });

    this.optionsList.addEventListener('keydown', (e) => {
      this.handleKeydown(e);
    });

    // Click outside to close
    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target)) {
        this.close();
      }
    });
  }

  /**
   * Handle keyboard navigation
   */
  handleKeydown(e) {
    switch (e.key) {
      case 'Enter':
      case ' ':
        if (!this.isOpen) {
          e.preventDefault();
          this.open();
        } else if (this.focusedIndex >= 0) {
          e.preventDefault();
          const option = this.filteredOptions[this.focusedIndex];
          if (option) {
            this.selectOption(option.value);
          }
        }
        break;

      case 'Escape':
        e.preventDefault();
        this.close();
        break;

      case 'ArrowDown':
        e.preventDefault();
        if (!this.isOpen) {
          this.open();
        } else {
          this.focusNext();
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (this.isOpen) {
          this.focusPrevious();
        }
        break;
    }
  }

  /**
   * Focus next option
   */
  focusNext() {
    this.focusedIndex = Math.min(this.focusedIndex + 1, this.filteredOptions.length - 1);
    this.updateFocusedOption();
  }

  /**
   * Focus previous option
   */
  focusPrevious() {
    this.focusedIndex = Math.max(this.focusedIndex - 1, 0);
    this.updateFocusedOption();
  }

  /**
   * Update visually focused option
   */
  updateFocusedOption() {
    const options = this.optionsList.querySelectorAll('.dropdown-option:not(.dropdown-option--no-results)');
    options.forEach((option, index) => {
      option.classList.toggle('dropdown-option--focused', index === this.focusedIndex);
    });
  }

  /**
   * Filter options based on search
   */
  filterOptions(searchTerm) {
    const term = searchTerm.toLowerCase();
    
    if (this.config.onSearch) {
      this.config.onSearch(term);
    } else {
      this.filteredOptions = this.config.options.filter(option =>
        option.label.toLowerCase().includes(term) ||
        option.value.toString().toLowerCase().includes(term)
      );
    }

    this.focusedIndex = -1;
    this.renderOptions();
  }

  /**
   * Select an option
   */
  selectOption(value) {
    if (this.config.multiple) {
      const index = this.selectedOptions.indexOf(value);
      if (index > -1) {
        this.selectedOptions.splice(index, 1);
      } else {
        this.selectedOptions.push(value);
      }
    } else {
      this.config.value = value;
      this.close();
    }

    this.updateButtonText();
    this.renderOptions();

    if (this.config.onChange) {
      const selectedValue = this.config.multiple ? this.selectedOptions : this.config.value;
      this.config.onChange(selectedValue, this);
    }

    this.eventBus.emit('dropdown:change', {
      dropdown: this,
      value: this.config.multiple ? this.selectedOptions : this.config.value
    });
  }

  /**
   * Open dropdown
   */
  open() {
    if (this.config.disabled || this.isOpen) return;

    this.isOpen = true;
    this.dropdown.style.display = 'block';
    this.button.setAttribute('aria-expanded', 'true');
    this.container.classList.add('dropdown-group--open');

    if (this.searchInput) {
      this.searchInput.focus();
    }

    this.eventBus.emit('dropdown:open', { dropdown: this });
  }

  /**
   * Close dropdown
   */
  close() {
    if (!this.isOpen) return;

    this.isOpen = false;
    this.dropdown.style.display = 'none';
    this.button.setAttribute('aria-expanded', 'false');
    this.container.classList.remove('dropdown-group--open');
    this.focusedIndex = -1;

    if (this.searchInput) {
      this.searchInput.value = '';
      this.filterOptions('');
    }

    this.updateFocusedOption();
    this.button.focus();

    this.eventBus.emit('dropdown:close', { dropdown: this });
  }

  /**
   * Toggle dropdown
   */
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Set options
   */
  setOptions(options) {
    this.config.options = options;
    this.filteredOptions = [...options];
    this.renderOptions();
    this.updateButtonText();
  }

  /**
   * Get selected value(s)
   */
  getValue() {
    return this.config.multiple ? this.selectedOptions : this.config.value;
  }

  /**
   * Set selected value(s)
   */
  setValue(value) {
    if (this.config.multiple) {
      this.selectedOptions = Array.isArray(value) ? value : [];
    } else {
      this.config.value = value;
    }
    this.updateButtonText();
    this.renderOptions();
  }

  /**
   * Clear selection
   */
  clear() {
    if (this.config.multiple) {
      this.selectedOptions = [];
    } else {
      this.config.value = null;
    }
    this.updateButtonText();
    this.renderOptions();
  }

  /**
   * Set disabled state
   */
  setDisabled(disabled) {
    this.config.disabled = disabled;
    if (this.button) {
      this.button.disabled = disabled;
    }
    if (this.container) {
      this.container.classList.toggle('dropdown-group--disabled', disabled);
    }
    if (disabled && this.isOpen) {
      this.close();
    }
  }

  /**
   * Destroy the dropdown
   */
  destroy() {
    if (this.container) {
      this.container.remove();
      this.container = null;
      this.button = null;
      this.dropdown = null;
      this.searchInput = null;
      this.optionsList = null;
      this.label = null;
    }
    this.eventBus.removeAllListeners();
  }

  /**
   * Get the container element
   */
  getElement() {
    return this.container || this.createElement();
  }
}
