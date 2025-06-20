/**
 * Progress Indicator Component - Organized Architecture
 * 
 * Flexible progress indicator for various use cases:
 * - Loading states
 * - Upload progress
 * - Process completion
 * - Indeterminate progress
 */

import { EventBus } from '../../services/EventBus.js';
import { logger } from '../../utils/logger.js';

export class ProgressIndicator {
  constructor(config = {}) {
    this.config = {
      container: config.container || null,
      type: config.type || 'circular', // 'circular', 'linear', 'dots'
      size: config.size || 'medium', // 'small', 'medium', 'large'
      color: config.color || 'primary',
      showPercentage: config.showPercentage !== false,
      showLabel: config.showLabel !== false,
      label: config.label || 'Loading...',
      determinate: config.determinate !== false,
      value: config.value || 0,
      max: config.max || 100,
      className: config.className || '',
      ...config
    };

    this.eventBus = new EventBus();
    this.element = null;
    this.progressElement = null;
    this.labelElement = null;
    this.percentageElement = null;
    this.animationFrame = null;
    this.isVisible = false;
  }

  /**
   * Create and render the progress indicator
   */
  render() {
    this.element = document.createElement('div');
    this.element.className = this.getContainerClasses();
    
    // Create progress element based on type
    switch (this.config.type) {
      case 'circular':
        this.createCircularProgress();
        break;
      case 'linear':
        this.createLinearProgress();
        break;
      case 'dots':
        this.createDotsProgress();
        break;
      default:
        this.createCircularProgress();
    }

    // Add label if enabled
    if (this.config.showLabel) {
      this.createLabel();
    }

    // Add percentage if enabled and determinate
    if (this.config.showPercentage && this.config.determinate) {
      this.createPercentage();
    }

    // Update initial value
    this.updateProgress(this.config.value);

    return this.element;
  }

  /**
   * Get container CSS classes
   */
  getContainerClasses() {
    const classes = [
      'progress-indicator',
      `progress-indicator--${this.config.type}`,
      `progress-indicator--${this.config.size}`,
      `progress-indicator--${this.config.color}`
    ];

    if (this.config.className) {
      classes.push(this.config.className);
    }

    if (!this.config.determinate) {
      classes.push('progress-indicator--indeterminate');
    }

    return classes.join(' ');
  }

  /**
   * Create circular progress indicator
   */
  createCircularProgress() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    const progressCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');

    // Set SVG attributes
    const size = this.getSizeValue();
    const strokeWidth = this.getStrokeWidth();
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.classList.add('progress-indicator__svg');

    // Background circle
    circle.setAttribute('cx', size / 2);
    circle.setAttribute('cy', size / 2);
    circle.setAttribute('r', radius);
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke-width', strokeWidth);
    circle.classList.add('progress-indicator__circle-bg');

    // Progress circle
    progressCircle.setAttribute('cx', size / 2);
    progressCircle.setAttribute('cy', size / 2);
    progressCircle.setAttribute('r', radius);
    progressCircle.setAttribute('fill', 'none');
    progressCircle.setAttribute('stroke-width', strokeWidth);
    progressCircle.setAttribute('stroke-dasharray', circumference);
    progressCircle.setAttribute('stroke-dashoffset', circumference);
    progressCircle.setAttribute('stroke-linecap', 'round');
    progressCircle.classList.add('progress-indicator__circle-progress');

    // Store reference for updates
    this.progressElement = progressCircle;
    this.circumference = circumference;

    svg.appendChild(circle);
    svg.appendChild(progressCircle);
    this.element.appendChild(svg);
  }

  /**
   * Create linear progress indicator
   */
  createLinearProgress() {
    const track = document.createElement('div');
    const fill = document.createElement('div');

    track.classList.add('progress-indicator__track');
    fill.classList.add('progress-indicator__fill');

    this.progressElement = fill;

    track.appendChild(fill);
    this.element.appendChild(track);
  }

  /**
   * Create dots progress indicator
   */
  createDotsProgress() {
    const dotsContainer = document.createElement('div');
    dotsContainer.classList.add('progress-indicator__dots');

    // Create 3 dots
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('div');
      dot.classList.add('progress-indicator__dot');
      dot.style.animationDelay = `${i * 0.2}s`;
      dotsContainer.appendChild(dot);
    }

    this.progressElement = dotsContainer;
    this.element.appendChild(dotsContainer);
  }

  /**
   * Create label element
   */
  createLabel() {
    this.labelElement = document.createElement('div');
    this.labelElement.classList.add('progress-indicator__label');
    this.labelElement.textContent = this.config.label;
    this.element.appendChild(this.labelElement);
  }

  /**
   * Create percentage element
   */
  createPercentage() {
    this.percentageElement = document.createElement('div');
    this.percentageElement.classList.add('progress-indicator__percentage');
    this.element.appendChild(this.percentageElement);
  }

  /**
   * Get size value in pixels
   */
  getSizeValue() {
    const sizes = {
      small: 24,
      medium: 40,
      large: 56
    };
    return sizes[this.config.size] || sizes.medium;
  }

  /**
   * Get stroke width based on size
   */
  getStrokeWidth() {
    const widths = {
      small: 2,
      medium: 3,
      large: 4
    };
    return widths[this.config.size] || widths.medium;
  }

  /**
   * Update progress value
   */
  updateProgress(value, max = null) {
    if (max !== null) {
      this.config.max = max;
    }

    this.config.value = Math.max(0, Math.min(value, this.config.max));
    const percentage = (this.config.value / this.config.max) * 100;

    // Update visual progress based on type
    if (this.config.type === 'circular' && this.progressElement) {
      const offset = this.circumference - (percentage / 100) * this.circumference;
      this.progressElement.style.strokeDashoffset = offset;
    } else if (this.config.type === 'linear' && this.progressElement) {
      this.progressElement.style.width = `${percentage}%`;
    }

    // Update percentage display
    if (this.percentageElement) {
      this.percentageElement.textContent = `${Math.round(percentage)}%`;
    }

    // Emit progress event
    this.eventBus.emit('progress:updated', {
      value: this.config.value,
      max: this.config.max,
      percentage
    });

    // Check if complete
    if (this.config.value >= this.config.max) {
      this.handleComplete();
    }
  }

  /**
   * Handle progress completion
   */
  handleComplete() {
    this.element.classList.add('progress-indicator--complete');
    this.eventBus.emit('progress:complete', {
      value: this.config.value,
      max: this.config.max
    });

    // Auto-hide after completion if configured
    if (this.config.autoHideOnComplete !== false) {
      setTimeout(() => {
        this.hide();
      }, this.config.completeDisplayTime || 1000);
    }
  }

  /**
   * Update label text
   */
  updateLabel(text) {
    this.config.label = text;
    if (this.labelElement) {
      this.labelElement.textContent = text;
    }
  }

  /**
   * Show the progress indicator
   */
  show() {
    if (!this.element) {
      this.render();
    }

    if (this.config.container && !this.element.parentNode) {
      this.config.container.appendChild(this.element);
    }

    this.element.classList.add('progress-indicator--visible');
    this.isVisible = true;

    // Start indeterminate animation if needed
    if (!this.config.determinate) {
      this.startIndeterminateAnimation();
    }

    this.eventBus.emit('progress:shown');
  }

  /**
   * Hide the progress indicator
   */
  hide() {
    if (this.element) {
      this.element.classList.remove('progress-indicator--visible');
      this.isVisible = false;

      // Stop animations
      this.stopIndeterminateAnimation();

      // Remove from DOM after transition
      setTimeout(() => {
        if (this.element && this.element.parentNode) {
          this.element.parentNode.removeChild(this.element);
        }
      }, 300);
    }

    this.eventBus.emit('progress:hidden');
  }

  /**
   * Start indeterminate animation
   */
  startIndeterminateAnimation() {
    if (this.config.type === 'circular' && this.progressElement) {
      let rotation = 0;
      const animate = () => {
        rotation += 2;
        this.progressElement.style.transform = `rotate(${rotation}deg)`;
        this.animationFrame = requestAnimationFrame(animate);
      };
      animate();
    }
  }

  /**
   * Stop indeterminate animation
   */
  stopIndeterminateAnimation() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  /**
   * Reset progress to initial state
   */
  reset() {
    this.updateProgress(0);
    this.element?.classList.remove('progress-indicator--complete');
  }

  /**
   * Set determinate mode
   */
  setDeterminate(determinate) {
    this.config.determinate = determinate;
    
    if (determinate) {
      this.element?.classList.remove('progress-indicator--indeterminate');
      this.stopIndeterminateAnimation();
    } else {
      this.element?.classList.add('progress-indicator--indeterminate');
      if (this.isVisible) {
        this.startIndeterminateAnimation();
      }
    }
  }

  /**
   * Get current progress value
   */
  getValue() {
    return this.config.value;
  }

  /**
   * Get current progress percentage
   */
  getPercentage() {
    return (this.config.value / this.config.max) * 100;
  }

  /**
   * Check if progress is complete
   */
  isComplete() {
    return this.config.value >= this.config.max;
  }

  /**
   * Subscribe to progress events
   */
  on(event, callback) {
    this.eventBus.on(event, callback);
  }

  /**
   * Unsubscribe from progress events
   */
  off(event, callback) {
    this.eventBus.off(event, callback);
  }

  /**
   * Destroy the progress indicator
   */
  destroy() {
    this.stopIndeterminateAnimation();
    
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }

    this.eventBus.removeAllListeners();
    this.element = null;
    this.progressElement = null;
    this.labelElement = null;
    this.percentageElement = null;
  }
}

/**
 * Factory function for creating progress indicators
 */
export function createProgressIndicator(config) {
  return new ProgressIndicator(config);
}

/**
 * Show a simple loading indicator
 */
export function showLoading(container, label = 'Loading...') {
  const progress = new ProgressIndicator({
    container,
    type: 'circular',
    determinate: false,
    label,
    showPercentage: false
  });
  
  progress.show();
  return progress;
}

/**
 * Show an upload progress indicator
 */
export function showUploadProgress(container, fileName) {
  const progress = new ProgressIndicator({
    container,
    type: 'linear',
    determinate: true,
    label: `Uploading ${fileName}...`,
    showPercentage: true,
    autoHideOnComplete: true
  });
  
  progress.show();
  return progress;
}
