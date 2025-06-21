/**
 * Input Component
 * 
 * Reusable input component with validation and accessibility features
 * Supports various input types and states
 */

import { EventBus } from '../../services/EventBus.js';
import { logger } from '../../utils/logger.js';

export class Input {
  constructor(config = {}) {
    this.config = {
      type: config.type || 'text',
      placeholder: config.placeholder || '',
      value: config.value || '',
      label: config.label || '',
      required: config.required || false,
      disabled: config.disabled || false,
      readonly: config.readonly || false,
      maxLength: config.maxLength || null,
      minLength: config.minLength || null,
      pattern: config.pattern || null,
      autocomplete: config.autocomplete || null,
      className: config.className || '',
      containerClassName: config.containerClassName || '',
      validation: config.validation || {},
      onInput: config.onInput || null,
      onChange: config.onChange || null,
      onFocus: config.onFocus || null,
      onBlur: config.onBlur || null,
      ...config
    };

    this.eventBus = new EventBus();
    this.container = null;
    this.input = null;
    this.label = null;
    this.errorElement = null;
    this.isValid = true;
    this.validationErrors = [];
  }

  /**
   * Create the input element and container
   */
  createElement() {
    // Create container
    this.container = document.createElement('div');
    this.container.className = `input-group ${this.config.containerClassName}`.trim();

    // Create label if provided
    if (this.config.label) {
      this.label = document.createElement('label');
      this.label.className = 'input-label';
      this.label.textContent = this.config.label;
      
      if (this.config.required) {
        this.label.innerHTML += ' <span class="input-required" aria-label="required">*</span>';
      }
      
      this.container.appendChild(this.label);
    }

    // Create input
    this.input = document.createElement('input');
    this.input.type = this.config.type;
    this.input.className = `input ${this.config.className}`.trim();
    this.input.placeholder = this.config.placeholder;
    this.input.value = this.config.value;

    // Set attributes
    if (this.config.required) this.input.required = true;
    if (this.config.disabled) this.input.disabled = true;
    if (this.config.readonly) this.input.readOnly = true;
    if (this.config.maxLength) this.input.maxLength = this.config.maxLength;
    if (this.config.minLength) this.input.minLength = this.config.minLength;
    if (this.config.pattern) this.input.pattern = this.config.pattern;
    if (this.config.autocomplete) this.input.autocomplete = this.config.autocomplete;

    // Accessibility attributes
    if (this.label) {
      const labelId = `label-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      this.label.id = labelId;
      this.input.setAttribute('aria-labelledby', labelId);
    }

    this.container.appendChild(this.input);

    // Create error element
    this.errorElement = document.createElement('div');
    this.errorElement.className = 'input-error';
    this.errorElement.setAttribute('role', 'alert');
    this.errorElement.style.display = 'none';
    this.container.appendChild(this.errorElement);

    this.bindEvents();
    return this.container;
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    if (!this.input) return;

    this.input.addEventListener('input', (e) => {
      if (this.config.onInput) {
        this.config.onInput(e, this);
      }
      this.validate();
      this.eventBus.emit('input:input', { input: this, event: e });
    });

    this.input.addEventListener('change', (e) => {
      if (this.config.onChange) {
        this.config.onChange(e, this);
      }
      this.validate();
      this.eventBus.emit('input:change', { input: this, event: e });
    });

    this.input.addEventListener('focus', (e) => {
      this.container.classList.add('input-group--focused');
      if (this.config.onFocus) {
        this.config.onFocus(e, this);
      }
      this.eventBus.emit('input:focus', { input: this, event: e });
    });

    this.input.addEventListener('blur', (e) => {
      this.container.classList.remove('input-group--focused');
      if (this.config.onBlur) {
        this.config.onBlur(e, this);
      }
      this.validate();
      this.eventBus.emit('input:blur', { input: this, event: e });
    });
  }

  /**
   * Validate the input value
   */
  validate() {
    this.validationErrors = [];
    this.isValid = true;

    const value = this.getValue();

    // Required validation
    if (this.config.required && !value.trim()) {
      this.addValidationError('This field is required');
    }

    // Length validation
    if (this.config.minLength && value.length < this.config.minLength) {
      this.addValidationError(`Minimum length is ${this.config.minLength} characters`);
    }

    if (this.config.maxLength && value.length > this.config.maxLength) {
      this.addValidationError(`Maximum length is ${this.config.maxLength} characters`);
    }

    // Pattern validation
    if (this.config.pattern && value && !new RegExp(this.config.pattern).test(value)) {
      this.addValidationError('Invalid format');
    }

    // Custom validation
    if (this.config.validation.custom && typeof this.config.validation.custom === 'function') {
      const customError = this.config.validation.custom(value, this);
      if (customError) {
        this.addValidationError(customError);
      }
    }

    this.updateValidationDisplay();
    return this.isValid;
  }

  /**
   * Add a validation error
   */
  addValidationError(message) {
    this.validationErrors.push(message);
    this.isValid = false;
  }

  /**
   * Update validation display
   */
  updateValidationDisplay() {
    if (!this.container || !this.errorElement) return;

    if (this.isValid) {
      this.container.classList.remove('input-group--error');
      this.errorElement.style.display = 'none';
      this.errorElement.textContent = '';
      this.input.setAttribute('aria-invalid', 'false');
    } else {
      this.container.classList.add('input-group--error');
      this.errorElement.style.display = 'block';
      this.errorElement.textContent = this.validationErrors[0] || 'Invalid input';
      this.input.setAttribute('aria-invalid', 'true');
      this.input.setAttribute('aria-describedby', this.errorElement.id || '');
    }
  }

  /**
   * Get the input value
   */
  getValue() {
    return this.input ? this.input.value : this.config.value;
  }

  /**
   * Set the input value
   */
  setValue(value) {
    this.config.value = value;
    if (this.input) {
      this.input.value = value;
      this.validate();
    }
  }

  /**
   * Clear the input
   */
  clear() {
    this.setValue('');
  }

  /**
   * Focus the input
   */
  focus() {
    if (this.input) {
      this.input.focus();
    }
  }

  /**
   * Set disabled state
   */
  setDisabled(disabled) {
    this.config.disabled = disabled;
    if (this.input) {
      this.input.disabled = disabled;
    }
    if (this.container) {
      this.container.classList.toggle('input-group--disabled', disabled);
    }
  }

  /**
   * Set readonly state
   */
  setReadonly(readonly) {
    this.config.readonly = readonly;
    if (this.input) {
      this.input.readOnly = readonly;
    }
    if (this.container) {
      this.container.classList.toggle('input-group--readonly', readonly);
    }
  }

  /**
   * Show validation error
   */
  showError(message) {
    this.validationErrors = [message];
    this.isValid = false;
    this.updateValidationDisplay();
  }

  /**
   * Clear validation errors
   */
  clearErrors() {
    this.validationErrors = [];
    this.isValid = true;
    this.updateValidationDisplay();
  }

  /**
   * Destroy the input
   */
  destroy() {
    if (this.container) {
      this.container.remove();
      this.container = null;
      this.input = null;
      this.label = null;
      this.errorElement = null;
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

// Export input factory functions for common use cases
export const createTextInput = (config = {}) => {
  return new Input({ type: 'text', ...config });
};

export const createEmailInput = (config = {}) => {
  return new Input({ 
    type: 'email', 
    pattern: '[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$',
    ...config 
  });
};

export const createPasswordInput = (config = {}) => {
  return new Input({ type: 'password', ...config });
};

export const createSearchInput = (config = {}) => {
  return new Input({ type: 'search', ...config });
};

export const createNumberInput = (config = {}) => {
  return new Input({ type: 'number', ...config });
};
