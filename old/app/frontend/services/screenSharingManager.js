/**
 * Screen Sharing Manager - Advanced Screen Sharing with Recording
 * Handles screen sharing, application window sharing, and screen recording
 * with advanced controls and quality optimization
 */

import { EventBus } from './EventBus.js';
import { logger } from '../utils/logger.js';
import { configManager } from '../utils/configManager.js';

class ScreenSharingManager {
  constructor() {
    this.eventBus = new EventBus();
    this.screenStream = null;
    this.recordingStream = null;
    this.mediaRecorder = null;
    this.isSharing = false;
    this.isRecording = false;
    this.recordedChunks = [];
    
    this.config = {
      video: {
        width: { ideal: 1920, max: 1920 },
        height: { ideal: 1080, max: 1080 },
        frameRate: { ideal: 30, max: 60 }
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      recording: {
        mimeType: 'video/webm;codecs=vp8,opus',
        videoBitsPerSecond: 2500000,
        audioBitsPerSecond: 128000
      }
    };

    this.supportedConstraints = null;
    this.activeShares = new Map();
    this.recordingSessions = new Map();

    this.init();
  }

  /**
   * Initialize screen sharing manager
   */
  async init() {
    try {
      logger.info('Initializing Screen Sharing Manager...');

      // Check browser support
      if (!this.isSupported()) {
        throw new Error('Screen sharing is not supported in this browser');
      }

      // Get supported constraints
      this.supportedConstraints = navigator.mediaDevices.getSupportedConstraints();

      // Load configuration
      this.loadConfiguration();

      // Setup event listeners
      this.setupEventListeners();

      logger.info('Screen Sharing Manager initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize Screen Sharing Manager:', error);
      throw error;
    }
  }

  /**
   * Check if screen sharing is supported
   */
  isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  }

  /**
   * Check if screen recording is supported
   */
  isRecordingSupported() {
    return !!(window.MediaRecorder && MediaRecorder.isTypeSupported(this.config.recording.mimeType));
  }

  /**
   * Start screen sharing
   */
  async startScreenShare(options = {}) {
    try {
      if (this.isSharing) {
        throw new Error('Screen sharing is already active');
      }

      logger.info('Starting screen share...');

      // Prepare constraints
      const constraints = this.buildConstraints(options);

      // Request screen share
      this.screenStream = await navigator.mediaDevices.getDisplayMedia(constraints);

      // Setup stream event handlers
      this.setupStreamHandlers(this.screenStream);

      // Update state
      this.isSharing = true;

      // Create share session
      const shareId = this.generateShareId();
      this.activeShares.set(shareId, {
        id: shareId,
        stream: this.screenStream,
        startTime: Date.now(),
        options,
        type: 'screen'
      });

      // Emit events
      this.eventBus.emit('screenshare:started', {
        shareId,
        stream: this.screenStream,
        constraints
      });

      logger.info('Screen share started successfully');

      return {
        shareId,
        stream: this.screenStream
      };

    } catch (error) {
      logger.error('Failed to start screen share:', error);
      this.eventBus.emit('screenshare:error', { error: error.message });
      throw error;
    }
  }

  /**
   * Stop screen sharing
   */
  async stopScreenShare(shareId = null) {
    try {
      if (!this.isSharing) {
        return;
      }

      logger.info('Stopping screen share...');

      // Stop specific share or all shares
      if (shareId) {
        const share = this.activeShares.get(shareId);
        if (share) {
          this.stopStreamTracks(share.stream);
          this.activeShares.delete(shareId);
        }
      } else {
        // Stop all shares
        this.activeShares.forEach((share, id) => {
          this.stopStreamTracks(share.stream);
        });
        this.activeShares.clear();

        if (this.screenStream) {
          this.stopStreamTracks(this.screenStream);
          this.screenStream = null;
        }
      }

      // Update state
      this.isSharing = this.activeShares.size > 0;

      // Emit events
      this.eventBus.emit('screenshare:stopped', { shareId });

      logger.info('Screen share stopped successfully');

    } catch (error) {
      logger.error('Failed to stop screen share:', error);
      throw error;
    }
  }

  /**
   * Start screen recording
   */
  async startRecording(options = {}) {
    try {
      if (this.isRecording) {
        throw new Error('Recording is already active');
      }

      if (!this.isRecordingSupported()) {
        throw new Error('Screen recording is not supported in this browser');
      }

      logger.info('Starting screen recording...');

      // Get screen stream if not already sharing
      if (!this.screenStream) {
        await this.startScreenShare(options);
      }

      // Create recording stream (clone to avoid conflicts)
      this.recordingStream = this.screenStream.clone();

      // Setup media recorder
      const recordingOptions = {
        mimeType: this.config.recording.mimeType,
        videoBitsPerSecond: this.config.recording.videoBitsPerSecond,
        audioBitsPerSecond: this.config.recording.audioBitsPerSecond
      };

      this.mediaRecorder = new MediaRecorder(this.recordingStream, recordingOptions);

      // Setup recording event handlers
      this.setupRecordingHandlers();

      // Start recording
      this.recordedChunks = [];
      this.mediaRecorder.start(1000); // Capture data every second

      // Update state
      this.isRecording = true;

      // Create recording session
      const recordingId = this.generateRecordingId();
      this.recordingSessions.set(recordingId, {
        id: recordingId,
        startTime: Date.now(),
        recorder: this.mediaRecorder,
        stream: this.recordingStream,
        options: recordingOptions
      });

      // Emit events
      this.eventBus.emit('recording:started', {
        recordingId,
        options: recordingOptions
      });

      logger.info('Screen recording started successfully');

      return { recordingId };

    } catch (error) {
      logger.error('Failed to start screen recording:', error);
      this.eventBus.emit('recording:error', { error: error.message });
      throw error;
    }
  }

  /**
   * Stop screen recording
   */
  async stopRecording(recordingId = null) {
    try {
      if (!this.isRecording) {
        return null;
      }

      logger.info('Stopping screen recording...');

      let recordingSession = null;

      if (recordingId) {
        recordingSession = this.recordingSessions.get(recordingId);
        if (!recordingSession) {
          throw new Error('Recording session not found');
        }
      } else {
        // Stop the main recording
        recordingSession = {
          recorder: this.mediaRecorder,
          stream: this.recordingStream
        };
      }

      // Stop the media recorder
      if (recordingSession.recorder && recordingSession.recorder.state !== 'inactive') {
        recordingSession.recorder.stop();
      }

      // Stop recording stream
      if (recordingSession.stream) {
        this.stopStreamTracks(recordingSession.stream);
      }

      // Wait for recording data
      const recordingBlob = await this.waitForRecordingData();

      // Clean up
      if (recordingId) {
        this.recordingSessions.delete(recordingId);
      } else {
        this.isRecording = false;
        this.mediaRecorder = null;
        this.recordingStream = null;
        this.recordingSessions.clear();
      }

      // Generate download URL
      const downloadUrl = URL.createObjectURL(recordingBlob);

      // Emit events
      this.eventBus.emit('recording:stopped', {
        recordingId,
        blob: recordingBlob,
        downloadUrl,
        duration: Date.now() - (recordingSession.startTime || Date.now())
      });

      logger.info('Screen recording stopped successfully');

      return {
        blob: recordingBlob,
        downloadUrl
      };

    } catch (error) {
      logger.error('Failed to stop screen recording:', error);
      throw error;
    }
  }

  /**
   * Share application window
   */
  async shareApplication(applicationId = null) {
    try {
      logger.info('Starting application window share...');

      const constraints = {
        video: {
          ...this.config.video,
          mediaSource: 'window'
        },
        audio: this.config.audio
      };

      // If specific application ID provided, try to select it
      if (applicationId) {
        constraints.video.sourceId = applicationId;
      }

      const stream = await navigator.mediaDevices.getDisplayMedia(constraints);

      // Setup stream handlers
      this.setupStreamHandlers(stream);

      // Create share session
      const shareId = this.generateShareId();
      this.activeShares.set(shareId, {
        id: shareId,
        stream,
        startTime: Date.now(),
        type: 'application',
        applicationId
      });

      this.eventBus.emit('screenshare:application-started', {
        shareId,
        stream,
        applicationId
      });

      return { shareId, stream };

    } catch (error) {
      logger.error('Failed to share application window:', error);
      throw error;
    }
  }

  /**
   * Share browser tab
   */
  async shareTab() {
    try {
      logger.info('Starting browser tab share...');

      const constraints = {
        video: {
          ...this.config.video,
          mediaSource: 'browser'
        },
        audio: this.config.audio
      };

      const stream = await navigator.mediaDevices.getDisplayMedia(constraints);

      // Setup stream handlers
      this.setupStreamHandlers(stream);

      // Create share session
      const shareId = this.generateShareId();
      this.activeShares.set(shareId, {
        id: shareId,
        stream,
        startTime: Date.now(),
        type: 'tab'
      });

      this.eventBus.emit('screenshare:tab-started', {
        shareId,
        stream
      });

      return { shareId, stream };

    } catch (error) {
      logger.error('Failed to share browser tab:', error);
      throw error;
    }
  }

  /**
   * Build constraints for screen sharing
   */
  buildConstraints(options = {}) {
    const constraints = {
      video: {
        ...this.config.video,
        ...options.video
      }
    };

    // Add audio if requested
    if (options.audio !== false) {
      constraints.audio = {
        ...this.config.audio,
        ...options.audio
      };
    }

    // Apply supported constraints only
    Object.keys(constraints.video).forEach(key => {
      if (!this.supportedConstraints[key]) {
        delete constraints.video[key];
      }
    });

    return constraints;
  }

  /**
   * Setup stream event handlers
   */
  setupStreamHandlers(stream) {
    const videoTrack = stream.getVideoTracks()[0];
    
    if (videoTrack) {
      videoTrack.addEventListener('ended', () => {
        logger.info('Screen share ended by user');
        this.handleStreamEnded(stream);
      });

      videoTrack.addEventListener('mute', () => {
        this.eventBus.emit('screenshare:track-muted', { type: 'video' });
      });

      videoTrack.addEventListener('unmute', () => {
        this.eventBus.emit('screenshare:track-unmuted', { type: 'video' });
      });
    }

    const audioTrack = stream.getAudioTracks()[0];
    
    if (audioTrack) {
      audioTrack.addEventListener('ended', () => {
        logger.info('Screen share audio ended');
      });

      audioTrack.addEventListener('mute', () => {
        this.eventBus.emit('screenshare:track-muted', { type: 'audio' });
      });

      audioTrack.addEventListener('unmute', () => {
        this.eventBus.emit('screenshare:track-unmuted', { type: 'audio' });
      });
    }
  }

  /**
   * Setup recording event handlers
   */
  setupRecordingHandlers() {
    this.mediaRecorder.addEventListener('dataavailable', (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    });

    this.mediaRecorder.addEventListener('stop', () => {
      logger.info('Media recorder stopped');
    });

    this.mediaRecorder.addEventListener('error', (event) => {
      logger.error('Media recorder error:', event.error);
      this.eventBus.emit('recording:error', { error: event.error });
    });
  }

  /**
   * Handle stream ended event
   */
  handleStreamEnded(stream) {
    // Find and remove the share
    for (const [shareId, share] of this.activeShares) {
      if (share.stream === stream) {
        this.activeShares.delete(shareId);
        this.eventBus.emit('screenshare:ended', { shareId });
        break;
      }
    }

    // Update sharing state
    this.isSharing = this.activeShares.size > 0;

    // If this was the main screen stream, clear it
    if (this.screenStream === stream) {
      this.screenStream = null;
    }
  }

  /**
   * Stop all tracks in a stream
   */
  stopStreamTracks(stream) {
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
      });
    }
  }

  /**
   * Wait for recording data to be available
   */
  waitForRecordingData() {
    return new Promise((resolve) => {
      const checkData = () => {
        if (this.recordedChunks.length > 0) {
          const blob = new Blob(this.recordedChunks, {
            type: this.config.recording.mimeType
          });
          resolve(blob);
        } else {
          setTimeout(checkData, 100);
        }
      };
      checkData();
    });
  }

  /**
   * Download recording
   */
  downloadRecording(blob, filename = null) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `screen-recording-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Get available media sources
   */
  async getMediaSources() {
    try {
      if (!navigator.mediaDevices.enumerateDevices) {
        return [];
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => device.kind === 'videoinput');

    } catch (error) {
      logger.error('Failed to get media sources:', error);
      return [];
    }
  }

  /**
   * Load configuration
   */
  loadConfiguration() {
    const savedConfig = configManager.get('screenSharing', {});
    this.config = { ...this.config, ...savedConfig };
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Listen for configuration changes
    configManager.eventBus.on('config:updated', (changes) => {
      if (changes.screenSharing) {
        this.config = { ...this.config, ...changes.screenSharing };
      }
    });
  }

  /**
   * Utility methods
   */
  generateShareId() {
    return `share-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  generateRecordingId() {
    return `recording-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current sharing status
   */
  getSharingStatus() {
    return {
      isSharing: this.isSharing,
      isRecording: this.isRecording,
      activeShares: Array.from(this.activeShares.values()),
      recordingSessions: Array.from(this.recordingSessions.values()),
      isSupported: this.isSupported(),
      isRecordingSupported: this.isRecordingSupported()
    };
  }

  /**
   * Get current screen stream
   */
  getCurrentStream() {
    return this.screenStream;
  }

  /**
   * Cleanup and destroy
   */
  destroy() {
    logger.info('Destroying Screen Sharing Manager...');

    // Stop all shares
    this.activeShares.forEach((share) => {
      this.stopStreamTracks(share.stream);
    });
    this.activeShares.clear();

    // Stop all recordings
    this.recordingSessions.forEach((session) => {
      if (session.recorder && session.recorder.state !== 'inactive') {
        session.recorder.stop();
      }
      this.stopStreamTracks(session.stream);
    });
    this.recordingSessions.clear();

    // Stop main streams
    if (this.screenStream) {
      this.stopStreamTracks(this.screenStream);
      this.screenStream = null;
    }

    if (this.recordingStream) {
      this.stopStreamTracks(this.recordingStream);
      this.recordingStream = null;
    }

    // Reset state
    this.isSharing = false;
    this.isRecording = false;
    this.mediaRecorder = null;
    this.recordedChunks = [];

    this.eventBus.emit('screenshare:destroyed');
  }
}

// Create and export singleton instance
export const screenSharingManager = new ScreenSharingManager();
export default screenSharingManager;
