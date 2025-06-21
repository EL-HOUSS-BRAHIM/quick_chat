/**
 * Integration Tests for Complete User Flows
 * Tests end-to-end scenarios across multiple components
 */

import { jest } from '@jest/globals';

// Mock browser APIs
global.window.RTCPeerConnection = class RTCPeerConnection {
  constructor(config) {
    this.config = config;
    this.localDescription = null;
    this.remoteDescription = null;
    this.iceConnectionState = 'new';
    this.oniceconnectionstatechange = null;
  }
  
  createOffer() {
    return Promise.resolve({
      type: 'offer',
      sdp: 'mock-sdp'
    });
  }
  
  createAnswer() {
    return Promise.resolve({
      type: 'answer', 
      sdp: 'mock-sdp'
    });
  }
  
  setLocalDescription(desc) {
    this.localDescription = desc;
    return Promise.resolve();
  }
  
  setRemoteDescription(desc) {
    this.remoteDescription = desc;
    return Promise.resolve();
  }
  
  addIceCandidate(candidate) {
    return Promise.resolve();
  }
};

global.navigator.mediaDevices = {
  getUserMedia: jest.fn(() => Promise.resolve({
    getTracks: () => [],
    getVideoTracks: () => [],
    getAudioTracks: () => []
  })),
  enumerateDevices: jest.fn(() => Promise.resolve([]))
};

describe('Complete Chat Flow Integration', () => {
  let app, chatWindow, messageList, messageInput;
  
  beforeEach(async () => {
    // Setup DOM
    document.body.innerHTML = `
      <div id="app">
        <div id="chat-container"></div>
        <div id="sidebar"></div>
        <div id="notification-area"></div>
      </div>
    `;

    // Import and initialize components
    const AppModule = await import('../../services/App.js');
    const ChatWindowModule = await import('../../components/ChatWindow.js');
    
    app = new AppModule.App();
    chatWindow = new ChatWindowModule.ChatWindow({
      chatType: 'private',
      targetUserId: 123,
      currentUserId: 456
    });
  });

  test('should complete full chat initialization flow', async () => {
    // Initialize app
    await app.init();
    expect(app.isInitialized).toBe(true);
    
    // Initialize chat window
    await chatWindow.init();
    expect(chatWindow.state.isInitialized).toBe(true);
    
    // Verify components are connected
    expect(chatWindow.messageList).toBeDefined();
    expect(chatWindow.messageInput).toBeDefined();
  });

  test('should handle message sending flow', async () => {
    await app.init();
    await chatWindow.init();
    
    // Mock API response
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, messageId: 789 })
    });

    // Send message
    const messageData = {
      content: 'Test message',
      type: 'text'
    };
    
    const result = await chatWindow.sendMessage(messageData);
    expect(result.success).toBe(true);
    expect(result.messageId).toBe(789);
  });

  test('should handle real-time message receiving', async () => {
    await app.init();
    await chatWindow.init();
    
    // Mock incoming WebSocket message
    const incomingMessage = {
      type: 'new_message',
      data: {
        id: 999,
        content: 'Incoming message',
        userId: 123,
        timestamp: new Date().toISOString()
      }
    };
    
    // Simulate WebSocket message
    chatWindow.handleWebSocketMessage(incomingMessage);
    
    // Verify message was added to state
    expect(chatWindow.messageList.state.messages.length).toBeGreaterThan(0);
  });
});

describe('WebRTC Video Call Integration', () => {
  let webrtcManager, chatWindow;
  
  beforeEach(async () => {
    const WebRTCModule = await import('../../services/WebRTCManager.js');
    const ChatWindowModule = await import('../../components/ChatWindow.js');
    
    webrtcManager = new WebRTCModule.WebRTCManager();
    chatWindow = new ChatWindowModule.ChatWindow();
  });

  test('should initiate video call successfully', async () => {
    await webrtcManager.init();
    
    // Mock media stream
    const mockStream = {
      getTracks: () => [],
      getVideoTracks: () => [{ kind: 'video' }],
      getAudioTracks: () => [{ kind: 'audio' }]
    };
    
    global.navigator.mediaDevices.getUserMedia.mockResolvedValueOnce(mockStream);
    
    const callId = await webrtcManager.initiateCall(123, 'video');
    expect(callId).toBeDefined();
    expect(webrtcManager.state.activeCall).toBeDefined();
  });

  test('should handle call state changes', async () => {
    await webrtcManager.init();
    
    const stateChanges = [];
    webrtcManager.on('callStateChange', (state) => {
      stateChanges.push(state);
    });
    
    await webrtcManager.changeCallState('connecting');
    await webrtcManager.changeCallState('connected');
    
    expect(stateChanges).toContain('connecting');
    expect(stateChanges).toContain('connected');
  });
});

describe('Group Chat Features Integration', () => {
  let chatWindow, sidebar;
  
  beforeEach(async () => {
    const ChatWindowModule = await import('../../components/ChatWindow.js');
    const SidebarModule = await import('../../components/Sidebar.js');
    
    chatWindow = new ChatWindowModule.ChatWindow({
      chatType: 'group',
      groupId: 456
    });
    
    sidebar = new SidebarModule.Sidebar({
      type: 'group'
    });
  });

  test('should load group members and permissions', async () => {
    // Mock API response for group data
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 456,
          name: 'Test Group',
          members: [
            { id: 1, name: 'User 1', role: 'admin' },
            { id: 2, name: 'User 2', role: 'member' }
          ]
        })
      });

    await chatWindow.init();
    await sidebar.init();
    
    expect(sidebar.state.groupInfo.members.length).toBe(2);
    expect(sidebar.state.groupInfo.members[0].role).toBe('admin');
  });

  test('should handle member management actions', async () => {
    await sidebar.init();
    
    // Mock API for adding member
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    });
    
    const result = await sidebar.addMember(999);
    expect(result.success).toBe(true);
  });
});

describe('Accessibility Features Integration', () => {
  let accessibilityManager, chatWindow;
  
  beforeEach(async () => {
    const AccessibilityModule = await import('../../services/accessibilityManager.js');
    const ChatWindowModule = await import('../../components/ChatWindow.js');
    
    accessibilityManager = new AccessibilityModule.AccessibilityManager();
    chatWindow = new ChatWindowModule.ChatWindow();
  });

  test('should provide screen reader announcements for new messages', async () => {
    await accessibilityManager.init();
    await chatWindow.init();
    
    const announcements = [];
    accessibilityManager.on('announcement', (text) => {
      announcements.push(text);
    });
    
    // Simulate new message
    chatWindow.handleNewMessage({
      id: 1,
      content: 'Test message',
      userName: 'John Doe'
    });
    
    expect(announcements.length).toBeGreaterThan(0);
    expect(announcements[0]).toContain('New message from John Doe');
  });

  test('should manage keyboard navigation properly', async () => {
    await accessibilityManager.init();
    
    const keyEvent = new KeyboardEvent('keydown', { key: 'Tab' });
    document.dispatchEvent(keyEvent);
    
    // Verify focus management is working
    expect(accessibilityManager.focusVisible).toBe(true);
  });
});

describe('Theme and Internationalization Integration', () => {
  let themeManager, i18nManager;
  
  beforeEach(async () => {
    const ThemeModule = await import('../../services/themeManager.js');
    const I18nModule = await import('../../services/i18nManager.js');
    
    themeManager = new ThemeModule.ThemeManager();
    i18nManager = new I18nModule.I18nManager();
  });

  test('should apply theme changes to all components', async () => {
    await themeManager.init();
    
    // Switch to dark theme
    themeManager.setTheme('dark');
    
    // Verify CSS variables are updated
    const rootStyle = getComputedStyle(document.documentElement);
    expect(document.body.classList.contains('theme-dark')).toBe(true);
  });

  test('should translate interface based on locale', async () => {
    await i18nManager.init();
    
    // Change language
    await i18nManager.setLocale('es');
    
    const translation = i18nManager.t('common.send');
    expect(translation).toBe('Enviar');
  });
});
