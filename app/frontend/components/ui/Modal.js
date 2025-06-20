/**
 * Modal Component
 * 
 * Provides modal dialog functionality for the application
 */

import { EventBus } from '../../services/EventBus.js';
import { logger } from '../../utils/logger.js';

export class Modal {
  constructor(config = {}) {
    this.config = {
      container: config.container || document.body,
      closable: config.closable !== false,
      closeOnBackdrop: config.closeOnBackdrop !== false,
      closeOnEscape: config.closeOnEscape !== false,
      ...config
    };

    this.eventBus = new EventBus();
    this.element = null;
    this.isOpen = false;
    this.currentModal = null;
  }

  /**
   * Initialize the modal system
   */
  async init() {
    try {
      this.setupEventListeners();
      logger.debug('Modal system initialized');
    } catch (error) {
      logger.error('Failed to initialize modal system:', error);
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Listen for global modal events
    this.eventBus.on('modal:show', (data) => {
      this.show(data.content, data.options);
    });

    this.eventBus.on('modal:hide', () => {
      this.hide();
    });

    // Keyboard events
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen && this.config.closeOnEscape) {
        this.hide();
      }
    });
  }

  /**
   * Show modal with content
   */
  show(content, options = {}) {
    if (this.isOpen) {
      this.hide();
    }

    this.currentModal = { content, options };
    this.createElement();
    this.render();
    this.isOpen = true;

    // Emit show event
    this.eventBus.emit('modal:shown', { content, options });
  }

  /**
   * Hide modal
   */
  hide() {
    if (!this.isOpen) return;

    if (this.element) {
      this.element.classList.add('hiding');
      setTimeout(() => {
        this.destroyElement();
      }, 300);
    }

    this.isOpen = false;
    this.currentModal = null;

    // Emit hide event
    this.eventBus.emit('modal:hidden');
  }

  /**
   * Create modal element
   */
  createElement() {
    this.element = document.createElement('div');
    this.element.className = 'modal-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    
    this.element.appendChild(modal);
    this.config.container.appendChild(this.element);

    // Backdrop click handler
    if (this.config.closeOnBackdrop) {
      this.element.addEventListener('click', (e) => {
        if (e.target === this.element) {
          this.hide();
        }
      });
    }
  }

  /**
   * Render modal content
   */
  render() {
    const modal = this.element.querySelector('.modal');
    const { content, options } = this.currentModal;

    let headerHTML = '';
    if (options.title) {
      headerHTML = `
        <div class="modal-header">
          <h3 class="modal-title">${options.title}</h3>
          ${this.config.closable ? '<button class="modal-close"><i class="fas fa-times"></i></button>' : ''}
        </div>
      `;
    }

    let footerHTML = '';
    if (options.buttons && options.buttons.length > 0) {
      const buttonsHTML = options.buttons.map(button => 
        `<button class="btn ${button.class || 'btn-secondary'}" data-action="${button.action}">${button.text}</button>`
      ).join('');
      
      footerHTML = `<div class="modal-footer">${buttonsHTML}</div>`;
    }

    modal.innerHTML = `
      ${headerHTML}
      <div class="modal-body">
        ${typeof content === 'string' ? content : ''}
      </div>
      ${footerHTML}
    `;

    // If content is an element, append it
    if (content instanceof HTMLElement) {
      modal.querySelector('.modal-body').appendChild(content);
    }

    // Add button handlers
    if (options.buttons) {
      options.buttons.forEach(button => {
        const btnElement = modal.querySelector(`[data-action="${button.action}"]`);
        if (btnElement && button.handler) {
          btnElement.addEventListener('click', (e) => {
            button.handler(e, this);
          });
        }
      });
    }

    // Add close button handler
    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.hide();
      });
    }

    // Animate in
    setTimeout(() => {
      this.element.classList.add('show');
    }, 10);
  }

  /**
   * Destroy modal element
   */
  destroyElement() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
      this.element = null;
    }
  }

  /**
   * Show confirmation dialog
   */
  confirm(message, title = 'Confirm', options = {}) {
    return new Promise((resolve) => {
      this.show(message, {
        title,
        buttons: [
          {
            text: options.cancelText || 'Cancel',
            class: 'btn-secondary',
            action: 'cancel',
            handler: () => {
              this.hide();
              resolve(false);
            }
          },
          {
            text: options.confirmText || 'Confirm',
            class: 'btn-primary',
            action: 'confirm',
            handler: () => {
              this.hide();
              resolve(true);
            }
          }
        ],
        ...options
      });
    });
  }

  /**
   * Show alert dialog
   */
  alert(message, title = 'Alert', options = {}) {
    return new Promise((resolve) => {
      this.show(message, {
        title,
        buttons: [
          {
            text: options.okText || 'OK',
            class: 'btn-primary',
            action: 'ok',
            handler: () => {
              this.hide();
              resolve(true);
            }
          }
        ],
        ...options
      });
    });
  }

  /**
   * Destroy the modal system
   */
  destroy() {
    this.hide();
  }
}

export default Modal;
