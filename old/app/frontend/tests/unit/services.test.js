/**
 * Service Layer Unit Tests
 * Tests for all frontend services
 */

import { jest } from '@jest/globals';

// Mock WebSocket
global.WebSocket = class WebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = WebSocket.CONNECTING;
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      if (this.onopen) this.onopen();
    }, 100);
  }
  
  send(data) {
    // Mock send
  }
  
  close() {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) this.onclose();
  }
  
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
};

describe('WebSocket Manager Service', () => {
  let websocketManager;
  
  beforeAll(async () => {
    const module = await import('../../services/websocketManager.js');
    websocketManager = module.websocketManager;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should initialize websocket manager', () => {
    expect(websocketManager).toBeDefined();
    expect(websocketManager.isConnected()).toBe(false);
  });

  test('should connect to websocket server', async () => {
    const connected = await websocketManager.connect('ws://localhost:8080');
    expect(connected).toBe(true);
  });

  test('should handle connection errors gracefully', async () => {
    const connected = await websocketManager.connect('ws://invalid-url');
    expect(connected).toBe(false);
  });
});

describe('API Client Service', () => {
  let apiClient;
  
  beforeAll(async () => {
    const module = await import('../../services/apiClient.js');
    apiClient = module.apiClient;
  });

  beforeEach(() => {
    // Mock fetch
    global.fetch = jest.fn();
    jest.clearAllMocks();
  });

  test('should make GET requests', async () => {
    const mockResponse = { data: 'test' };
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    const result = await apiClient.get('/test');
    expect(result.data).toBe('test');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/test'),
      expect.objectContaining({
        method: 'GET'
      })
    );
  });

  test('should handle POST requests with data', async () => {
    const mockResponse = { success: true };
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    const data = { name: 'test' };
    const result = await apiClient.post('/create', data);
    
    expect(result.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/create'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(data)
      })
    );
  });

  test('should handle errors properly', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    await expect(apiClient.get('/error')).rejects.toThrow();
  });
});

describe('Theme Manager Service', () => {
  let ThemeManager;
  
  beforeAll(async () => {
    const module = await import('../../services/themeManager.js');
    ThemeManager = module.ThemeManager;
  });

  test('should initialize with light theme by default', () => {
    const themeManager = new ThemeManager();
    expect(themeManager.currentTheme).toBe('light');
  });

  test('should switch themes correctly', async () => {
    const themeManager = new ThemeManager();
    await themeManager.init();
    
    themeManager.setTheme('dark');
    expect(themeManager.currentTheme).toBe('dark');
  });

  test('should detect system theme preference', () => {
    // Mock matchMedia for dark theme
    global.window.matchMedia = jest.fn(() => ({
      matches: true,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    }));

    const themeManager = new ThemeManager();
    themeManager.detectSystemTheme();
    
    expect(themeManager.systemTheme).toBe('dark');
  });
});

describe('Accessibility Manager Service', () => {
  let AccessibilityManager;
  
  beforeAll(async () => {
    const module = await import('../../services/accessibilityManager.js');
    AccessibilityManager = module.AccessibilityManager;
  });

  test('should initialize accessibility features', () => {
    const accessibilityManager = new AccessibilityManager();
    expect(accessibilityManager.initialized).toBe(false);
    
    accessibilityManager.init();
    expect(accessibilityManager.initialized).toBe(true);
  });

  test('should detect reduced motion preference', () => {
    global.window.matchMedia = jest.fn(() => ({
      matches: true,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    }));

    const accessibilityManager = new AccessibilityManager();
    accessibilityManager.detectPreferences();
    
    expect(accessibilityManager.reducedMotion).toBe(true);
  });

  test('should manage focus stack properly', () => {
    const accessibilityManager = new AccessibilityManager();
    const element = document.createElement('div');
    
    accessibilityManager.pushFocus(element);
    expect(accessibilityManager.focusStack.length).toBe(1);
    
    accessibilityManager.popFocus();
    expect(accessibilityManager.focusStack.length).toBe(0);
  });
});

describe('Error Handler Service', () => {
  let ErrorHandler;
  
  beforeAll(async () => {
    const module = await import('../../services/ErrorHandler.js');
    ErrorHandler = module.ErrorHandler;
  });

  test('should handle errors with proper logging', () => {
    const errorHandler = new ErrorHandler();
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    const error = new Error('Test error');
    errorHandler.handleError(error);
    
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  test('should categorize errors correctly', () => {
    const errorHandler = new ErrorHandler();
    
    const networkError = new Error('Network error');
    networkError.name = 'NetworkError';
    
    const category = errorHandler.categorizeError(networkError);
    expect(category).toBe('network');
  });
});
