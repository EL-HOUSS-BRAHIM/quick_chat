/**
 * Accessibility Test Suite
 * Comprehensive tests for WCAG compliance and accessibility features
 */

import { accessibilityManager } from '../../services/accessibilityManager.js';

// Mock axe-core for testing
global.axe = {
  run: jest.fn(() => Promise.resolve({
    violations: [],
    passes: [],
    incomplete: [],
    inapplicable: []
  })),
  configure: jest.fn()
};

describe('Accessibility Tests', () => {
  let mockElement;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockElement = {
      setAttribute: jest.fn(),
      getAttribute: jest.fn(),
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        toggle: jest.fn(),
        contains: jest.fn()
      },
      style: {},
      focus: jest.fn(),
      blur: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      querySelectorAll: jest.fn(() => []),
      querySelector: jest.fn()
    };

    global.document = {
      createElement: jest.fn(() => mockElement),
      getElementById: jest.fn(() => mockElement),
      querySelectorAll: jest.fn(() => [mockElement]),
      querySelector: jest.fn(() => mockElement),
      activeElement: mockElement,
      body: mockElement,
      documentElement: mockElement
    };

    global.window = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      speechSynthesis: {
        speak: jest.fn(),
        cancel: jest.fn(),
        getVoices: jest.fn(() => [])
      },
      SpeechSynthesisUtterance: jest.fn()
    };
  });

  describe('Accessibility Manager', () => {
    test('should initialize accessibility features', async () => {
      await accessibilityManager.init();
      expect(accessibilityManager.initialized).toBe(true);
    });

    test('should enable high contrast mode', () => {
      accessibilityManager.enableHighContrast();
      expect(mockElement.classList.add).toHaveBeenCalledWith('high-contrast');
    });

    test('should enable screen reader support', () => {
      accessibilityManager.enableScreenReader();
      expect(accessibilityManager.screenReaderEnabled).toBe(true);
    });

    test('should manage focus correctly', () => {
      const focusableElements = [mockElement, mockElement];
      mockElement.querySelectorAll.mockReturnValue(focusableElements);

      accessibilityManager.manageFocus(mockElement);
      expect(mockElement.setAttribute).toHaveBeenCalledWith('tabindex', '-1');
    });

    test('should announce messages to screen readers', () => {
      accessibilityManager.announceToScreenReader('Test message');
      // Should create aria-live region and announce message
      expect(global.document.createElement).toHaveBeenCalled();
    });

    test('should handle keyboard navigation', () => {
      const mockEvent = {
        key: 'Tab',
        preventDefault: jest.fn(),
        shiftKey: false,
        target: mockElement
      };

      accessibilityManager.handleKeyboardNavigation(mockEvent);
      expect(accessibilityManager.lastFocusedElement).toBe(mockElement);
    });
  });

  describe('ARIA Attributes', () => {
    test('should add proper ARIA labels', () => {
      accessibilityManager.addAriaLabel(mockElement, 'Test label');
      expect(mockElement.setAttribute).toHaveBeenCalledWith('aria-label', 'Test label');
    });

    test('should add ARIA descriptions', () => {
      accessibilityManager.addAriaDescription(mockElement, 'Test description');
      expect(mockElement.setAttribute).toHaveBeenCalledWith('aria-describedby', expect.any(String));
    });

    test('should manage ARIA expanded state', () => {
      accessibilityManager.setAriaExpanded(mockElement, true);
      expect(mockElement.setAttribute).toHaveBeenCalledWith('aria-expanded', 'true');

      accessibilityManager.setAriaExpanded(mockElement, false);
      expect(mockElement.setAttribute).toHaveBeenCalledWith('aria-expanded', 'false');
    });

    test('should add ARIA roles', () => {
      accessibilityManager.addRole(mockElement, 'button');
      expect(mockElement.setAttribute).toHaveBeenCalledWith('role', 'button');
    });

    test('should manage ARIA live regions', () => {
      const liveRegion = accessibilityManager.createLiveRegion('polite');
      expect(mockElement.setAttribute).toHaveBeenCalledWith('aria-live', 'polite');
    });
  });

  describe('Keyboard Navigation', () => {
    test('should trap focus within modal', () => {
      const modalElement = mockElement;
      const focusableElements = [mockElement, mockElement, mockElement];
      modalElement.querySelectorAll.mockReturnValue(focusableElements);

      accessibilityManager.trapFocus(modalElement);

      const tabEvent = {
        key: 'Tab',
        preventDefault: jest.fn(),
        shiftKey: false,
        target: focusableElements[2] // Last element
      };

      // Simulate tab from last element - should focus first
      accessibilityManager.handleFocusTrap(tabEvent, modalElement);
      expect(focusableElements[0].focus).toHaveBeenCalled();
    });

    test('should handle escape key', () => {
      const mockCallback = jest.fn();
      accessibilityManager.addEscapeKeyHandler(mockCallback);

      const escapeEvent = {
        key: 'Escape',
        preventDefault: jest.fn()
      };

      accessibilityManager.handleEscapeKey(escapeEvent);
      expect(mockCallback).toHaveBeenCalled();
    });

    test('should provide skip links', () => {
      accessibilityManager.addSkipLink('main-content', 'Skip to main content');
      expect(global.document.createElement).toHaveBeenCalled();
    });
  });

  describe('Visual Accessibility', () => {
    test('should adjust font size', () => {
      accessibilityManager.adjustFontSize(1.2);
      expect(mockElement.style.fontSize).toBeDefined();
    });

    test('should enable motion reduction', () => {
      accessibilityManager.enableReducedMotion();
      expect(mockElement.classList.add).toHaveBeenCalledWith('reduced-motion');
    });

    test('should manage color preferences', () => {
      accessibilityManager.setColorPreference('dark');
      expect(mockElement.classList.add).toHaveBeenCalledWith('dark-theme');
    });

    test('should check color contrast', () => {
      const contrast = accessibilityManager.checkColorContrast('#000000', '#ffffff');
      expect(contrast).toBeGreaterThan(7); // Should meet WCAG AAA standards
    });
  });

  describe('Screen Reader Support', () => {
    test('should create accessible notifications', () => {
      accessibilityManager.createAccessibleNotification('Test notification', 'assertive');
      expect(global.document.createElement).toHaveBeenCalled();
    });

    test('should handle dynamic content updates', () => {
      accessibilityManager.announceContentUpdate('New message received');
      // Should use aria-live region to announce update
      expect(global.document.createElement).toHaveBeenCalled();
    });

    test('should provide text alternatives for images', () => {
      const img = mockElement;
      accessibilityManager.addImageAltText(img, 'Profile picture of John Doe');
      expect(img.setAttribute).toHaveBeenCalledWith('alt', 'Profile picture of John Doe');
    });
  });

  describe('Form Accessibility', () => {
    test('should associate labels with form controls', () => {
      const input = mockElement;
      const label = mockElement;
      
      accessibilityManager.associateLabelWithInput(label, input, 'email-input');
      expect(label.setAttribute).toHaveBeenCalledWith('for', 'email-input');
      expect(input.setAttribute).toHaveBeenCalledWith('id', 'email-input');
    });

    test('should add form validation messages', () => {
      const input = mockElement;
      accessibilityManager.addValidationMessage(input, 'Please enter a valid email address');
      expect(input.setAttribute).toHaveBeenCalledWith('aria-describedby', expect.any(String));
    });

    test('should handle form errors accessibly', () => {
      const form = mockElement;
      const errors = ['Email is required', 'Password is too short'];
      
      accessibilityManager.announceFormErrors(form, errors);
      expect(global.document.createElement).toHaveBeenCalled();
    });
  });

  describe('WCAG Compliance Testing', () => {
    test('should run automated accessibility audit', async () => {
      const results = await accessibilityManager.runAccessibilityAudit(mockElement);
      expect(global.axe.run).toHaveBeenCalledWith(mockElement);
      expect(results.violations).toEqual([]);
    });

    test('should check for WCAG 2.1 AA compliance', async () => {
      global.axe.run.mockResolvedValue({
        violations: [
          {
            id: 'color-contrast',
            impact: 'serious',
            description: 'Elements must have sufficient color contrast'
          }
        ]
      });

      const results = await accessibilityManager.checkWCAGCompliance(mockElement, 'AA');
      expect(results.isCompliant).toBe(false);
      expect(results.violations).toHaveLength(1);
    });

    test('should generate accessibility report', async () => {
      const report = await accessibilityManager.generateAccessibilityReport(mockElement);
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('violations');
      expect(report).toHaveProperty('recommendations');
    });
  });

  describe('Touch and Mobile Accessibility', () => {
    test('should ensure touch targets are large enough', () => {
      const button = mockElement;
      button.getBoundingClientRect = jest.fn(() => ({
        width: 30,
        height: 30
      }));

      const isAccessible = accessibilityManager.checkTouchTargetSize(button);
      expect(isAccessible).toBe(false); // Should be at least 44px
    });

    test('should provide touch gesture alternatives', () => {
      accessibilityManager.addTouchGestureAlternative(mockElement, 'swipe-right', 'button');
      expect(mockElement.setAttribute).toHaveBeenCalledWith('role', 'button');
    });
  });

  describe('Voice Control Support', () => {
    test('should enable voice commands', () => {
      const commands = {
        'click button': () => mockElement.click(),
        'focus input': () => mockElement.focus()
      };

      accessibilityManager.enableVoiceControl(commands);
      expect(accessibilityManager.voiceControlEnabled).toBe(true);
    });

    test('should provide voice feedback', () => {
      accessibilityManager.speakText('Button clicked');
      expect(global.window.speechSynthesis.speak).toHaveBeenCalled();
    });
  });

  describe('Accessibility Preferences', () => {
    test('should save user accessibility preferences', () => {
      const preferences = {
        highContrast: true,
        reducedMotion: true,
        fontSize: 1.2,
        screenReader: true
      };

      accessibilityManager.savePreferences(preferences);
      expect(accessibilityManager.userPreferences).toEqual(preferences);
    });

    test('should apply saved preferences on init', async () => {
      const preferences = {
        highContrast: true,
        reducedMotion: true
      };

      accessibilityManager.userPreferences = preferences;
      await accessibilityManager.applyPreferences();

      expect(mockElement.classList.add).toHaveBeenCalledWith('high-contrast');
      expect(mockElement.classList.add).toHaveBeenCalledWith('reduced-motion');
    });
  });

  describe('Accessibility Testing Utilities', () => {
    test('should find accessibility issues in components', async () => {
      // Mock a component with accessibility issues
      global.axe.run.mockResolvedValue({
        violations: [
          {
            id: 'button-name',
            nodes: [{ target: ['button'] }],
            description: 'Buttons must have discernible text'
          }
        ]
      });

      const issues = await accessibilityManager.findAccessibilityIssues(mockElement);
      expect(issues).toHaveLength(1);
      expect(issues[0].id).toBe('button-name');
    });

    test('should validate ARIA usage', () => {
      mockElement.getAttribute.mockImplementation((attr) => {
        if (attr === 'role') return 'button';
        if (attr === 'aria-label') return null;
        return null;
      });

      const validation = accessibilityManager.validateAriaUsage(mockElement);
      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('Button missing accessible name');
    });

    test('should test keyboard accessibility', () => {
      const keyboardTest = accessibilityManager.testKeyboardAccessibility(mockElement);
      expect(keyboardTest.isFocusable).toBeDefined();
      expect(keyboardTest.hasProperTabOrder).toBeDefined();
    });
  });
});
