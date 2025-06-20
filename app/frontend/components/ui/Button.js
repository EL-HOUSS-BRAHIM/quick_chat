/**
 * Button Component
 * 
 * Reusable button component with various styles and states
 * Supports accessibility features and loading states
 */

import { EventBus } from '../../services/EventBus.js';
import { logger } from '../../utils/logger.js';

export class Button {
  constructor(config = {}) {
    this.config = {
      text: config.text || 'Button',
      type: config.type || 'button', // button, submit, reset
      variant: config.variant || 'primary', // primary, secondary, danger, success, warning
      size: config.size || 'medium', // small, medium, large
      disabled: config.disabled || false,
      loading: config.loading || false,
      icon: config.icon || null,
      iconPosition: config.iconPosition || 'left', // left, right
      fullWidth: config.fullWidth || false,
      onClick: config.onClick || null,
      ariaLabel: config.ariaLabel || config.text,
      className: config.className || '',
      ...config
    };

    this.eventBus = new EventBus();
    this.element = null;
    this.isLoading = false;
  }

  /**
   * Create the button element
   */
  createElement() {
    this.element = document.createElement('button');
    this.element.type = this.config.type;
    this.element.className = this.getButtonClasses();
    this.element.setAttribute('aria-label', this.config.ariaLabel);
    
    if (this.config.disabled) {
      this.element.disabled = true;
    }

    this.updateContent();
    this.bindEvents();

    return this.element;
  }

  /**
   * Get CSS classes for the button
   */
  getButtonClasses() {
    const classes = ['btn'];
    
    // Variant classes
    classes.push(`btn--${this.config.variant}`);
    
    // Size classes
    classes.push(`btn--${this.config.size}`);
    
    // State classes
    if (this.config.disabled) classes.push('btn--disabled');
    if (this.config.loading || this.isLoading) classes.push('btn--loading');
    if (this.config.fullWidth) classes.push('btn--full-width');
    
    // Custom classes
    if (this.config.className) classes.push(this.config.className);

    return classes.join(' ');
  }

  /**
   * Update button content
   */
  updateContent() {
    if (!this.element) return;

    const content = [];
    
    // Loading spinner
    if (this.config.loading || this.isLoading) {
      content.push('<span class="btn__spinner" aria-hidden="true"></span>');
    }
    
    // Icon
    if (this.config.icon && this.config.iconPosition === 'left' && !this.isLoading) {
      content.push(`<span class="btn__icon btn__icon--left" aria-hidden="true">${this.config.icon}</span>`);
    }
    
    // Text
    content.push(`<span class="btn__text">${this.config.text}</span>`);
    
    // Right icon
    if (this.config.icon && this.config.iconPosition === 'right' && !this.isLoading) {
      content.push(`<span class="btn__icon btn__icon--right" aria-hidden="true">${this.config.icon}</span>`);
    }

    this.element.innerHTML = content.join('');
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    if (!this.element) return;

    this.element.addEventListener('click', (e) => {
      if (this.config.disabled || this.isLoading) {
        e.preventDefault();
        return;
      }

      if (this.config.onClick) {
        this.config.onClick(e);
      }

      this.eventBus.emit('button:click', { 
        button: this, 
        event: e 
      });
    });

    // Keyboard accessibility
    this.element.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        if (!this.config.disabled && !this.isLoading) {
          e.preventDefault();
          this.element.click();
        }
      }
    });
  }

  /**
   * Set loading state
   */
  setLoading(loading) {
    this.isLoading = loading;
    
    if (this.element) {
      this.element.disabled = loading || this.config.disabled;
      this.element.className = this.getButtonClasses();
      this.updateContent();
    }
  }

  /**
   * Set disabled state
   */
  setDisabled(disabled) {
    this.config.disabled = disabled;
    
    if (this.element) {
      this.element.disabled = disabled || this.isLoading;
      this.element.className = this.getButtonClasses();
    }
  }

  /**
   * Update button text
   */
  setText(text) {
    this.config.text = text;
    this.updateContent();
  }

  /**
   * Update button variant
   */
  setVariant(variant) {
    this.config.variant = variant;
    
    if (this.element) {
      this.element.className = this.getButtonClasses();
    }
  }

  /**
   * Destroy the button
   */
  destroy() {
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
    this.eventBus.removeAllListeners();
  }

  /**
   * Get the button element
   */
  getElement() {
    return this.element || this.createElement();
  }
}

// Export button factory functions for common use cases
export const createPrimaryButton = (text, onClick, config = {}) => {
  return new Button({ 
    text, 
    onClick, 
    variant: 'primary', 
    ...config 
  });
};

export const createSecondaryButton = (text, onClick, config = {}) => {
  return new Button({ 
    text, 
    onClick, 
    variant: 'secondary', 
    ...config 
  });
};

export const createDangerButton = (text, onClick, config = {}) => {
  return new Button({ 
    text, 
    onClick, 
    variant: 'danger', 
    ...config 
  });
};

export const createIconButton = (icon, onClick, config = {}) => {
  return new Button({ 
    text: '', 
    icon, 
    onClick, 
    variant: 'secondary',
    className: 'btn--icon-only',
    ...config 
  });
};
