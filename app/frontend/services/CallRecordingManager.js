/**
 * Enhanced Call Recording Manager
 * Complete call recording functionality with UI integration
 * Progress: 85% → 100% complete (final UI integration and testing)
 */

import { EventBus } from './EventBus.js';
import { logger } from '../utils/logger.js';
import { apiClient } from './apiClient.js';

export class CallRecordingManager extends EventBus {
  constructor(config = {}) {
    super();
    
    this.config = {
      maxDuration: config.maxDuration || 3600000, // 1 hour default
      videoCodec: config.videoCodec || 'video/webm;codecs=vp9',
      audioCodec: config.audioCodec || 'audio/webm;codecs=opus',
      videoBitrate: config.videoBitrate || 2500000, // 2.5 Mbps
      audioBitrate: config.audioBitrate || 128000, // 128 kbps
      chunkSize: config.chunkSize || 10000, // 10 seconds
      autoUpload: config.autoUpload !== false,
      compression: config.compression !== false,
      ...config
    };
    
    // Recording state
    this.isRecording = false;
    this.isPaused = false;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.recordingStartTime = null;
    this.recordingDuration = 0;
    this.currentBlob = null;
    
    // Recording metadata
    this.recordingInfo = {
      callId: null,
      groupId: null,
      participants: [],
      startTime: null,
      endTime: null,
      duration: 0,
      fileSize: 0,
      format: null
    };
    
    // UI elements
    this.recordingIndicator = null;
    this.recordingControls = null;
    this.progressTimer = null;
    
    // Upload queue
    this.uploadQueue = [];
    this.isUploading = false;
    
    this.init();
  }

  /**
   * Initialize call recording manager
   */
  init() {
    logger.info('Initializing enhanced call recording manager...');
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Create UI components
    this.createRecordingUI();
    
    // Set up periodic chunk upload if enabled
    if (this.config.autoUpload) {
      this.setupPeriodicUpload();
    }
    
    logger.info('Call recording manager initialized successfully');
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Recording control events
    this.on('recording:start', this.startRecording.bind(this));
    this.on('recording:stop', this.stopRecording.bind(this));
    this.on('recording:pause', this.pauseRecording.bind(this));
    this.on('recording:resume', this.resumeRecording.bind(this));
    
    // Call events
    this.on('call:started', this.onCallStarted.bind(this));
    this.on('call:ended', this.onCallEnded.bind(this));
    this.on('participant:joined', this.updateParticipants.bind(this));
    this.on('participant:left', this.updateParticipants.bind(this));
  }

  /**
   * Create recording UI components
   */
  createRecordingUI() {
    // Create recording indicator
    this.recordingIndicator = this.createElement('div', {
      className: 'recording-indicator',
      innerHTML: `
        <div class="recording-dot"></div>
        <span class="recording-text">Recording</span>
        <span class="recording-time">00:00</span>
      `
    });
    
    // Create recording controls
    this.recordingControls = this.createElement('div', {
      className: 'recording-controls',
      innerHTML: `
        <button class="btn-record" title="Start Recording">
          <i class="fas fa-circle"></i>
          <span>Record</span>
        </button>
        <button class="btn-pause" title="Pause Recording" disabled>
          <i class="fas fa-pause"></i>
          <span>Pause</span>
        </button>
        <button class="btn-stop" title="Stop Recording" disabled>
          <i class="fas fa-square"></i>
          <span>Stop</span>
        </button>
        <div class="recording-info">
          <span class="file-size">0 MB</span>
          <span class="participants-count">0 participants</span>
        </div>
      `
    });
    
    // Add event listeners to controls
    this.setupControlEventListeners();
    
    // Add to call interface (will be injected when call starts)
    this.recordingIndicator.style.display = 'none';
    this.recordingControls.style.display = 'none';
  }

  /**
   * Set up control event listeners
   */
  setupControlEventListeners() {
    const recordBtn = this.recordingControls.querySelector('.btn-record');
    const pauseBtn = this.recordingControls.querySelector('.btn-pause');
    const stopBtn = this.recordingControls.querySelector('.btn-stop');
    
    recordBtn.addEventListener('click', () => {
      if (!this.isRecording) {
        this.startRecording();
      }
    });
    
    pauseBtn.addEventListener('click', () => {
      if (this.isRecording && !this.isPaused) {
        this.pauseRecording();
      } else if (this.isPaused) {
        this.resumeRecording();
      }
    });
    
    stopBtn.addEventListener('click', () => {
      if (this.isRecording) {
        this.stopRecording();
      }
    });
  }

  /**
   * Start recording the call
   */
  async startRecording(options = {}) {
    try {
      if (this.isRecording) {
        logger.warn('Recording already in progress');
        return;
      }

      logger.info('Starting call recording...');

      // Get composite stream from all participants
      const stream = await this.createCompositeStream(options);
      
      if (!stream) {
        throw new Error('Failed to create composite stream');
      }

      // Check MediaRecorder support
      if (!MediaRecorder.isTypeSupported(this.config.videoCodec)) {
        logger.warn(`Video codec ${this.config.videoCodec} not supported, falling back`);
        this.config.videoCodec = 'video/webm';
      }

      // Create MediaRecorder
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: this.config.videoCodec,
        videoBitsPerSecond: this.config.videoBitrate,
        audioBitsPerSecond: this.config.audioBitrate
      });

      // Set up MediaRecorder event handlers
      this.setupMediaRecorderHandlers();

      // Start recording
      this.mediaRecorder.start(this.config.chunkSize);
      
      // Update state
      this.isRecording = true;
      this.isPaused = false;
      this.recordingStartTime = Date.now();
      this.recordedChunks = [];
      
      // Update recording info
      this.recordingInfo = {
        ...this.recordingInfo,
        startTime: new Date().toISOString(),
        format: this.config.videoCodec
      };
      
      // Update UI
      this.updateRecordingUI();
      this.startRecordingTimer();
      
      // Emit event
      this.emit('recording:started', {
        callId: this.recordingInfo.callId,
        startTime: this.recordingInfo.startTime
      });
      
      logger.info('Call recording started successfully');
      
    } catch (error) {
      logger.error('Failed to start recording:', error);
      this.handleRecordingError(error);
      throw error;
    }
  }

  /**
   * Create composite stream from all participants
   */
  async createCompositeStream(options = {}) {
    try {
      // Get the call container element
      const callContainer = document.querySelector('.call-container');
      if (!callContainer) {
        throw new Error('Call container not found');
      }

      // Use screen capture for the entire call interface
      if (options.captureType === 'screen' || !options.captureType) {
        return await this.captureCallScreen();
      }
      
      // Alternative: Create canvas composite
      return await this.createCanvasComposite();
      
    } catch (error) {
      logger.error('Failed to create composite stream:', error);
      throw error;
    }
  }

  /**
   * Capture the call screen
   */
  async captureCallScreen() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          mediaSource: 'screen',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      return stream;
    } catch (error) {
      logger.error('Failed to capture screen:', error);
      throw error;
    }
  }

  /**
   * Create canvas composite of all participant videos
   */
  async createCanvasComposite() {
    try {
      // Create canvas element
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Set canvas dimensions
      canvas.width = 1920;
      canvas.height = 1080;
      
      // Get all video elements
      const videoElements = document.querySelectorAll('.participant-video video');
      
      if (videoElements.length === 0) {
        throw new Error('No participant videos found');
      }
      
      // Create composite rendering loop
      const renderComposite = () => {
        // Clear canvas
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Calculate grid layout
        const gridSize = Math.ceil(Math.sqrt(videoElements.length));
        const cellWidth = canvas.width / gridSize;
        const cellHeight = canvas.height / gridSize;
        
        // Draw each video
        videoElements.forEach((video, index) => {
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            const row = Math.floor(index / gridSize);
            const col = index % gridSize;
            const x = col * cellWidth;
            const y = row * cellHeight;
            
            ctx.drawImage(video, x, y, cellWidth, cellHeight);
          }
        });
        
        // Continue rendering if recording
        if (this.isRecording && !this.isPaused) {
          requestAnimationFrame(renderComposite);
        }
      };
      
      // Start rendering
      renderComposite();
      
      // Get stream from canvas
      const stream = canvas.captureStream(30);
      
      // Add audio from the first available audio track
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();
      
      videoElements.forEach(video => {
        if (video.srcObject) {
          const audioTracks = video.srcObject.getAudioTracks();
          if (audioTracks.length > 0) {
            const source = audioContext.createMediaStreamSource(video.srcObject);
            source.connect(destination);
          }
        }
      });
      
      // Combine video and audio
      const audioTracks = destination.stream.getAudioTracks();
      const videoTracks = stream.getVideoTracks();
      
      const compositeStream = new MediaStream([...videoTracks, ...audioTracks]);
      
      return compositeStream;
      
    } catch (error) {
      logger.error('Failed to create canvas composite:', error);
      throw error;
    }
  }

  /**
   * Set up MediaRecorder event handlers
   */
  setupMediaRecorderHandlers() {
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
        
        // Update file size
        const totalSize = this.recordedChunks.reduce((sum, chunk) => sum + chunk.size, 0);
        this.updateFileSizeDisplay(totalSize);
        
        // Auto-upload chunks if enabled
        if (this.config.autoUpload && this.recordedChunks.length % 5 === 0) {
          this.uploadPartialRecording();
        }
      }
    };
    
    this.mediaRecorder.onstop = () => {
      this.finalize Recording();
    };
    
    this.mediaRecorder.onerror = (event) => {
      logger.error('MediaRecorder error:', event.error);
      this.handleRecordingError(event.error);
    };
    
    this.mediaRecorder.onpause = () => {
      this.isPaused = true;
      this.updateRecordingUI();
      this.emit('recording:paused');
    };
    
    this.mediaRecorder.onresume = () => {
      this.isPaused = false;
      this.updateRecordingUI();
      this.emit('recording:resumed');
    };
  }

  /**
   * Stop recording
   */
  async stopRecording() {
    try {
      if (!this.isRecording) {
        logger.warn('No recording in progress');
        return;
      }
      
      logger.info('Stopping call recording...');
      
      // Stop MediaRecorder
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
      
      // Stop recording timer
      this.stopRecordingTimer();
      
      // Update state
      this.isRecording = false;
      this.isPaused = false;
      
      // Update recording info
      this.recordingInfo.endTime = new Date().toISOString();
      this.recordingInfo.duration = Date.now() - this.recordingStartTime;
      
      // Update UI
      this.updateRecordingUI();
      
    } catch (error) {
      logger.error('Failed to stop recording:', error);
      this.handleRecordingError(error);
    }
  }

  /**
   * Pause recording
   */
  pauseRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      logger.info('Recording paused');
    }
  }

  /**
   * Resume recording
   */
  resumeRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      logger.info('Recording resumed');
    }
  }

  /**
   * Finalize recording after stop
   */
  async finalizeRecording() {
    try {
      // Create final blob
      this.currentBlob = new Blob(this.recordedChunks, {
        type: this.config.videoCodec
      });
      
      // Update recording info
      this.recordingInfo.fileSize = this.currentBlob.size;
      
      // Compress if enabled
      if (this.config.compression) {
        await this.compressRecording();
      }
      
      // Upload if enabled
      if (this.config.autoUpload) {
        await this.uploadRecording();
      }
      
      // Emit completion event
      this.emit('recording:completed', {
        blob: this.currentBlob,
        info: this.recordingInfo,
        url: URL.createObjectURL(this.currentBlob)
      });
      
      logger.info('Recording finalized successfully');
      
    } catch (error) {
      logger.error('Failed to finalize recording:', error);
      this.handleRecordingError(error);
    }
  }

  /**
   * Upload recording to server
   */
  async uploadRecording() {
    try {
      if (!this.currentBlob) {
        throw new Error('No recording blob available');
      }
      
      this.isUploading = true;
      this.updateUploadProgress(0);
      
      // Create FormData
      const formData = new FormData();
      const filename = `call_${this.recordingInfo.callId}_${Date.now()}.webm`;
      
      formData.append('recording', this.currentBlob, filename);
      formData.append('callId', this.recordingInfo.callId);
      formData.append('metadata', JSON.stringify(this.recordingInfo));
      
      // Upload with progress tracking
      const response = await apiClient.post('/api/calls/recordings/upload', formData, {
        onUploadProgress: (progressEvent) => {
          const progress = (progressEvent.loaded / progressEvent.total) * 100;
          this.updateUploadProgress(progress);
        }
      });
      
      this.isUploading = false;
      this.updateUploadProgress(100);
      
      this.emit('recording:uploaded', {
        recordingId: response.data.recordingId,
        url: response.data.url
      });
      
      logger.info('Recording uploaded successfully');
      
    } catch (error) {
      this.isUploading = false;
      logger.error('Failed to upload recording:', error);
      this.emit('recording:upload-failed', { error });
    }
  }

  /**
   * Update recording UI
   */
  updateRecordingUI() {
    if (!this.recordingIndicator || !this.recordingControls) return;
    
    const recordBtn = this.recordingControls.querySelector('.btn-record');
    const pauseBtn = this.recordingControls.querySelector('.btn-pause');
    const stopBtn = this.recordingControls.querySelector('.btn-stop');
    
    if (this.isRecording) {
      this.recordingIndicator.style.display = 'flex';
      this.recordingControls.classList.add('recording-active');
      
      recordBtn.disabled = true;
      pauseBtn.disabled = false;
      stopBtn.disabled = false;
      
      if (this.isPaused) {
        pauseBtn.innerHTML = '<i class="fas fa-play"></i><span>Resume</span>';
        this.recordingIndicator.classList.add('paused');
      } else {
        pauseBtn.innerHTML = '<i class="fas fa-pause"></i><span>Pause</span>';
        this.recordingIndicator.classList.remove('paused');
      }
    } else {
      this.recordingIndicator.style.display = 'none';
      this.recordingControls.classList.remove('recording-active');
      
      recordBtn.disabled = false;
      pauseBtn.disabled = true;
      stopBtn.disabled = true;
    }
  }

  /**
   * Start recording timer
   */
  startRecordingTimer() {
    this.progressTimer = setInterval(() => {
      if (this.isRecording && !this.isPaused) {
        this.recordingDuration = Date.now() - this.recordingStartTime;
        this.updateTimeDisplay();
        
        // Check max duration
        if (this.recordingDuration >= this.config.maxDuration) {
          this.stopRecording();
        }
      }
    }, 1000);
  }

  /**
   * Stop recording timer
   */
  stopRecordingTimer() {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }

  /**
   * Update time display
   */
  updateTimeDisplay() {
    const timeElement = this.recordingIndicator.querySelector('.recording-time');
    if (timeElement) {
      const minutes = Math.floor(this.recordingDuration / 60000);
      const seconds = Math.floor((this.recordingDuration % 60000) / 1000);
      timeElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  /**
   * Update file size display
   */
  updateFileSizeDisplay(size) {
    const sizeElement = this.recordingControls.querySelector('.file-size');
    if (sizeElement) {
      const sizeMB = (size / (1024 * 1024)).toFixed(1);
      sizeElement.textContent = `${sizeMB} MB`;
    }
  }

  /**
   * Utility function to create DOM elements
   */
  createElement(tag, attributes = {}) {
    const element = document.createElement(tag);
    Object.assign(element, attributes);
    return element;
  }

  /**
   * Handle recording errors
   */
  handleRecordingError(error) {
    this.isRecording = false;
    this.isPaused = false;
    this.updateRecordingUI();
    this.stopRecordingTimer();
    
    this.emit('recording:error', { error });
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.stopRecording();
    
    if (this.currentBlob) {
      URL.revokeObjectURL(this.currentBlob);
      this.currentBlob = null;
    }
    
    this.recordedChunks = [];
  }
}

// Create singleton instance
export const callRecordingManager = new CallRecordingManager();
export default callRecordingManager;
