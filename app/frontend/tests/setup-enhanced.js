/**
 * Enhanced Jest Setup for Frontend Testing
 * Complete test environment setup with mocks and utilities
 */

import { jest } from '@jest/globals';
import 'jest-canvas-mock';

// Mock global objects and APIs
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

// Mock fetch API
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    blob: () => Promise.resolve(new Blob()),
    headers: new Headers()
  })
);

// Mock WebSocket
global.WebSocket = jest.fn(() => ({
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readyState: 1,
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
}));

// Mock navigator APIs
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: jest.fn(() => Promise.resolve({
      getTracks: () => [{
        stop: jest.fn(),
        kind: 'video',
        enabled: true
      }],
      getVideoTracks: () => [{
        stop: jest.fn(),
        kind: 'video',
        enabled: true
      }],
      getAudioTracks: () => [{
        stop: jest.fn(),
        kind: 'audio',
        enabled: true
      }]
    })),
    getDisplayMedia: jest.fn(() => Promise.resolve({
      getTracks: () => [{
        stop: jest.fn(),
        kind: 'video',
        enabled: true
      }]
    })),
    enumerateDevices: jest.fn(() => Promise.resolve([
      { deviceId: 'camera1', kind: 'videoinput', label: 'Test Camera' },
      { deviceId: 'mic1', kind: 'audioinput', label: 'Test Microphone' }
    ]))
  }
});

Object.defineProperty(navigator, 'clipboard', {
  writable: true,
  value: {
    writeText: jest.fn(() => Promise.resolve()),
    readText: jest.fn(() => Promise.resolve(''))
  }
});

Object.defineProperty(navigator, 'permissions', {
  writable: true,
  value: {
    query: jest.fn(() => Promise.resolve({ state: 'granted' }))
  }
});

Object.defineProperty(navigator, 'connection', {
  writable: true,
  value: {
    effectiveType: '4g',
    downlink: 10,
    rtt: 100,
    saveData: false
  }
});

// Mock Web Crypto API
Object.defineProperty(window, 'crypto', {
  writable: true,
  value: {
    getRandomValues: jest.fn((arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
    subtle: {
      generateKey: jest.fn(() => Promise.resolve({
        publicKey: { type: 'public' },
        privateKey: { type: 'private' }
      })),
      encrypt: jest.fn(() => Promise.resolve(new ArrayBuffer(32))),
      decrypt: jest.fn(() => Promise.resolve(new ArrayBuffer(32))),
      sign: jest.fn(() => Promise.resolve(new ArrayBuffer(64))),
      verify: jest.fn(() => Promise.resolve(true)),
      deriveKey: jest.fn(() => Promise.resolve({ type: 'secret' })),
      deriveBits: jest.fn(() => Promise.resolve(new ArrayBuffer(32))),
      importKey: jest.fn(() => Promise.resolve({ type: 'secret' })),
      exportKey: jest.fn(() => Promise.resolve({}))
    }
  }
});

// Mock RTCPeerConnection
global.RTCPeerConnection = jest.fn(() => ({
  createOffer: jest.fn(() => Promise.resolve({ type: 'offer', sdp: 'test-sdp' })),
  createAnswer: jest.fn(() => Promise.resolve({ type: 'answer', sdp: 'test-sdp' })),
  setLocalDescription: jest.fn(() => Promise.resolve()),
  setRemoteDescription: jest.fn(() => Promise.resolve()),
  addTrack: jest.fn(),
  removeTrack: jest.fn(),
  addIceCandidate: jest.fn(() => Promise.resolve()),
  close: jest.fn(),
  getStats: jest.fn(() => Promise.resolve(new Map())),
  createDataChannel: jest.fn(() => ({
    send: jest.fn(),
    close: jest.fn(),
    addEventListener: jest.fn()
  })),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  connectionState: 'connected',
  iceConnectionState: 'connected',
  signalingState: 'stable'
}));

// Mock MediaRecorder
global.MediaRecorder = jest.fn(() => ({
  start: jest.fn(),
  stop: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  state: 'inactive'
}));

MediaRecorder.isTypeSupported = jest.fn(() => true);

// Mock AudioContext
global.AudioContext = jest.fn(() => ({
  createMediaStreamSource: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn()
  })),
  createAnalyser: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    getFloatFrequencyData: jest.fn(),
    getByteFrequencyData: jest.fn(),
    fftSize: 2048,
    frequencyBinCount: 1024
  })),
  createGain: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    gain: { value: 1 }
  })),
  createMediaStreamDestination: jest.fn(() => ({
    stream: {
      getTracks: () => [],
      getAudioTracks: () => [],
      getVideoTracks: () => []
    }
  })),
  close: jest.fn(() => Promise.resolve()),
  suspend: jest.fn(() => Promise.resolve()),
  resume: jest.fn(() => Promise.resolve()),
  state: 'running'
}));

// Mock performance API
Object.defineProperty(window, 'performance', {
  writable: true,
  value: {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByType: jest.fn(() => []),
    getEntriesByName: jest.fn(() => []),
    clearMarks: jest.fn(),
    clearMeasures: jest.fn(),
    memory: {
      usedJSHeapSize: 1000000,
      totalJSHeapSize: 2000000,
      jsHeapSizeLimit: 4000000
    }
  }
});

// Mock PerformanceObserver
global.PerformanceObserver = jest.fn(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  takeRecords: jest.fn(() => [])
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}));

// Mock ResizeObserver
global.ResizeObserver = jest.fn(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}));

// Mock MutationObserver
global.MutationObserver = jest.fn(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  takeRecords: jest.fn(() => [])
}));

// Mock Storage APIs
const createStorageMock = () => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index) => Object.keys(store)[index] || null)
  };
};

Object.defineProperty(window, 'localStorage', {
  writable: true,
  value: createStorageMock()
});

Object.defineProperty(window, 'sessionStorage', {
  writable: true,
  value: createStorageMock()
});

// Mock IndexedDB
global.indexedDB = {
  open: jest.fn(() => ({
    onsuccess: null,
    onerror: null,
    result: {
      createObjectStore: jest.fn(),
      transaction: jest.fn(() => ({
        objectStore: jest.fn(() => ({
          add: jest.fn(),
          get: jest.fn(),
          put: jest.fn(),
          delete: jest.fn(),
          getAll: jest.fn()
        }))
      }))
    }
  })),
  deleteDatabase: jest.fn()
};

// Mock URL and Blob APIs
global.URL = {
  createObjectURL: jest.fn(() => 'blob:mock-url'),
  revokeObjectURL: jest.fn()
};

global.Blob = jest.fn((content, options) => ({
  size: content ? content.length : 0,
  type: options?.type || '',
  text: () => Promise.resolve(content?.join('') || ''),
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  stream: () => new ReadableStream()
}));

global.File = jest.fn((content, name, options) => ({
  ...new Blob(content, options),
  name,
  lastModified: Date.now()
}));

// Mock FileReader
global.FileReader = jest.fn(() => ({
  readAsText: jest.fn(function() {
    this.onload?.({ target: { result: 'mock file content' } });
  }),
  readAsDataURL: jest.fn(function() {
    this.onload?.({ target: { result: 'data:text/plain;base64,bW9ja2ZpbGU=' } });
  }),
  readAsArrayBuffer: jest.fn(function() {
    this.onload?.({ target: { result: new ArrayBuffer(8) } });
  }),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
}));

// Mock canvas and 2D context
HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
  fillRect: jest.fn(),
  clearRect: jest.fn(),
  getImageData: jest.fn(() => ({
    data: new Uint8ClampedArray(4)
  })),
  putImageData: jest.fn(),
  createImageData: jest.fn(() => ({
    data: new Uint8ClampedArray(4)
  })),
  setTransform: jest.fn(),
  drawImage: jest.fn(),
  save: jest.fn(),
  restore: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  closePath: jest.fn(),
  stroke: jest.fn(),
  fill: jest.fn(),
  measureText: jest.fn(() => ({ width: 100 })),
  fillText: jest.fn(),
  strokeText: jest.fn()
}));

HTMLCanvasElement.prototype.toDataURL = jest.fn(() => 'data:image/png;base64,mock');
HTMLCanvasElement.prototype.captureStream = jest.fn(() => ({
  getTracks: () => [],
  getVideoTracks: () => [{ kind: 'video' }],
  getAudioTracks: () => []
}));

// Mock video and audio elements
HTMLVideoElement.prototype.play = jest.fn(() => Promise.resolve());
HTMLVideoElement.prototype.pause = jest.fn();
HTMLVideoElement.prototype.load = jest.fn();

HTMLAudioElement.prototype.play = jest.fn(() => Promise.resolve());
HTMLAudioElement.prototype.pause = jest.fn();
HTMLAudioElement.prototype.load = jest.fn();

// Mock notification API
global.Notification = jest.fn(() => ({
  close: jest.fn()
}));

Notification.permission = 'granted';
Notification.requestPermission = jest.fn(() => Promise.resolve('granted'));

// Mock service worker
Object.defineProperty(navigator, 'serviceWorker', {
  writable: true,
  value: {
    register: jest.fn(() => Promise.resolve({
      installing: null,
      waiting: null,
      active: { postMessage: jest.fn() },
      addEventListener: jest.fn(),
      unregister: jest.fn(() => Promise.resolve(true))
    })),
    ready: Promise.resolve({
      installing: null,
      waiting: null,
      active: { postMessage: jest.fn() },
      addEventListener: jest.fn(),
      unregister: jest.fn(() => Promise.resolve(true))
    }),
    controller: {
      postMessage: jest.fn()
    },
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  }
});

// Mock geolocation
Object.defineProperty(navigator, 'geolocation', {
  writable: true,
  value: {
    getCurrentPosition: jest.fn((success) => {
      success({
        coords: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 10
        }
      });
    }),
    watchPosition: jest.fn(() => 1),
    clearWatch: jest.fn()
  }
});

// Custom test utilities
global.testUtils = {
  // Create mock component
  createMockComponent: (props = {}) => ({
    props,
    state: {},
    setState: jest.fn(),
    render: jest.fn(),
    componentDidMount: jest.fn(),
    componentDidUpdate: jest.fn(),
    componentWillUnmount: jest.fn()
  }),
  
  // Create mock event
  createMockEvent: (type, properties = {}) => ({
    type,
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
    target: { value: '' },
    currentTarget: {},
    ...properties
  }),
  
  // Wait for next tick
  nextTick: () => new Promise(resolve => setTimeout(resolve, 0)),
  
  // Wait for condition
  waitFor: async (condition, timeout = 5000) => {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('Condition not met within timeout');
  },
  
  // Mock WebSocket message
  mockWebSocketMessage: (data) => {
    const event = new MessageEvent('message', { data: JSON.stringify(data) });
    return event;
  },
  
  // Mock file upload
  mockFileUpload: (filename, type = 'text/plain', size = 1024) => {
    const file = new File(['mock content'], filename, { type, lastModified: Date.now() });
    Object.defineProperty(file, 'size', { value: size });
    return file;
  }
};

// Error handling for async tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  
  // Clear any timers
  jest.clearAllTimers();
  
  // Clear DOM
  document.body.innerHTML = '';
  
  // Clear storage
  localStorage.clear();
  sessionStorage.clear();
  
  // Reset console mocks
  console.warn.mockClear();
  console.error.mockClear();
  console.debug.mockClear();
});

// Set up fake timers by default
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

console.log('Enhanced Jest setup complete - frontend testing environment ready');
