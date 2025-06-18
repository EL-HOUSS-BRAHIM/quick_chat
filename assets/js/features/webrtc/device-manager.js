/**
 * WebRTC Device Manager
 * Handles audio and video device management
 */

import errorHandler from '../../core/error-handler.js';
import utils from '../../core/utils.js';
import { state } from '../../core/state.js';

class DeviceManager {
  constructor(options = {}) {
    this.config = {
      autoSavePreferences: true,
      localStorageKey: 'webrtc_device_preferences',
      ...options
    };
    
    this.devices = {
      audioInput: [],
      audioOutput: [],
      videoInput: []
    };
    
    this.selectedDevices = {
      audioInput: null,
      audioOutput: null,
      videoInput: null
    };
  }
  
  /**
   * Initialize device manager
   */
  async init() {
    try {
      // Request permissions to access devices
      await this.requestMediaPermissions();
      
      // Load available devices
      await this.loadDevices();
      
      // Load user preferences
      this.loadDevicePreferences();
      
      // Auto-select devices if not already selected
      this.autoSelectDevices();
      
      // Setup device change listener
      navigator.mediaDevices.addEventListener('devicechange', this.handleDeviceChange.bind(this));
      
      return this.devices;
    } catch (error) {
      errorHandler.handleError(error, 'Failed to initialize device manager');
      throw error;
    }
  }
  
  /**
   * Request media permissions to access devices
   */
  async requestMediaPermissions() {
    try {
      // Request permissions for both audio and video
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      
      // Stop all tracks immediately after permissions are granted
      stream.getTracks().forEach(track => track.stop());
      
    } catch (error) {
      console.warn('Could not get both audio and video permissions:', error);
      
      // Try audio only
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStream.getTracks().forEach(track => track.stop());
      } catch (audioError) {
        console.warn('Could not get audio permissions:', audioError);
      }
    }
  }
  
  /**
   * Load available devices
   */
  async loadDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      // Clear existing devices
      this.devices = {
        audioInput: [],
        audioOutput: [],
        videoInput: []
      };
      
      // Categorize devices
      devices.forEach(device => {
        // Create device object with sanitized label
        const deviceObj = {
          deviceId: device.deviceId,
          groupId: device.groupId,
          label: device.label || this.getDefaultLabel(device.kind),
          kind: device.kind
        };
        
        // Add to appropriate category
        if (device.kind === 'audioinput') {
          this.devices.audioInput.push(deviceObj);
        } else if (device.kind === 'audiooutput') {
          this.devices.audioOutput.push(deviceObj);
        } else if (device.kind === 'videoinput') {
          this.devices.videoInput.push(deviceObj);
        }
      });
      
      // Update state management
      state.set('webrtc.devices', this.devices);
      
      return this.devices;
    } catch (error) {
      errorHandler.handleError(error, 'Failed to load media devices');
      throw error;
    }
  }
  
  /**
   * Handle device change event
   */
  async handleDeviceChange() {
    console.log('Media devices changed');
    
    // Save current selections
    const previousSelections = { ...this.selectedDevices };
    
    // Reload devices
    await this.loadDevices();
    
    // Check if previously selected devices are still available
    for (const type in previousSelections) {
      const previousDevice = previousSelections[type];
      if (previousDevice) {
        const deviceStillExists = this.devices[type].some(device => device.deviceId === previousDevice);
        
        if (!deviceStillExists) {
          // Device no longer exists, select a new one
          this.selectedDevices[type] = null;
          this.autoSelectDevice(type);
        }
      }
    }
    
    // Save preferences
    if (this.config.autoSavePreferences) {
      this.saveDevicePreferences();
    }
    
    // Emit event through state
    state.set('webrtc.deviceChange', {
      devices: this.devices,
      selectedDevices: this.selectedDevices
    });
  }
  
  /**
   * Get default label for a device
   */
  getDefaultLabel(kind) {
    switch (kind) {
      case 'audioinput':
        return 'Microphone';
      case 'audiooutput':
        return 'Speakers';
      case 'videoinput':
        return 'Camera';
      default:
        return 'Media Device';
    }
  }
  
  /**
   * Auto-select all devices if not already selected
   */
  autoSelectDevices() {
    for (const type in this.devices) {
      if (!this.selectedDevices[type] && this.devices[type].length > 0) {
        this.autoSelectDevice(type);
      }
    }
  }
  
  /**
   * Auto-select a specific device type
   */
  autoSelectDevice(type) {
    if (this.devices[type].length === 0) {
      return;
    }
    
    // Default to first device
    let selectedDevice = this.devices[type][0].deviceId;
    
    // Try to find a non-default device
    for (const device of this.devices[type]) {
      // Prefer non-virtual devices (if label contains info)
      if (device.label && 
          !device.label.toLowerCase().includes('virtual') && 
          !device.label.toLowerCase().includes('default')) {
        selectedDevice = device.deviceId;
        break;
      }
    }
    
    this.selectedDevices[type] = selectedDevice;
  }
  
  /**
   * Load user device preferences from local storage
   */
  loadDevicePreferences() {
    try {
      const savedPreferences = localStorage.getItem(this.config.localStorageKey);
      
      if (savedPreferences) {
        const preferences = JSON.parse(savedPreferences);
        
        // Verify each preference against available devices
        for (const type in preferences) {
          const deviceId = preferences[type];
          
          // Check if device exists
          const deviceExists = this.devices[type] && 
                              this.devices[type].some(device => device.deviceId === deviceId);
          
          if (deviceExists) {
            this.selectedDevices[type] = deviceId;
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load device preferences:', error);
    }
  }
  
  /**
   * Save user device preferences to local storage
   */
  saveDevicePreferences() {
    try {
      localStorage.setItem(
        this.config.localStorageKey,
        JSON.stringify(this.selectedDevices)
      );
    } catch (error) {
      console.warn('Failed to save device preferences:', error);
    }
  }
  
  /**
   * Get list of all devices
   */
  getDevices() {
    return this.devices;
  }
  
  /**
   * Get current selected devices
   */
  getSelectedDevices() {
    return this.selectedDevices;
  }
  
  /**
   * Set selected device
   */
  setSelectedDevice(type, deviceId) {
    if (!this.devices[type]) {
      throw new Error(`Invalid device type: ${type}`);
    }
    
    // Check if device exists
    const deviceExists = this.devices[type].some(device => device.deviceId === deviceId);
    
    if (!deviceExists) {
      throw new Error(`Device with ID ${deviceId} not found for type ${type}`);
    }
    
    this.selectedDevices[type] = deviceId;
    
    // Save preferences
    if (this.config.autoSavePreferences) {
      this.saveDevicePreferences();
    }
    
    return this.selectedDevices;
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    // Remove device change listener
    navigator.mediaDevices.removeEventListener('devicechange', this.handleDeviceChange);
  }
}

export default DeviceManager;
