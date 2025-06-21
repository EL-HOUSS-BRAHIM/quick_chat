/**
 * Chat Voice Recording Module
 * Handles voice message recording, upload, and transcription
 */

import apiClient from '../../api/api-client.js';
import eventBus from '../../core/event-bus.js';

class VoiceRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.recordBtn = null;
    this.recordingDuration = 0;
    this.recordingTimer = null;
    this.transcriptionEnabled = true; // Enable transcription by default
    
    // Bind methods
    this.toggleRecording = this.toggleRecording.bind(this);
    this.startRecording = this.startRecording.bind(this);
    this.stopRecording = this.stopRecording.bind(this);
    this.uploadAudioFile = this.uploadAudioFile.bind(this);
    this.updateRecordingTimer = this.updateRecordingTimer.bind(this);
    this.toggleTranscription = this.toggleTranscription.bind(this);
    this.createRecordingUI = this.createRecordingUI.bind(this);
    
    // Initialize
    this.init();
  }
  
  /**
   * Initialize voice recorder
   */
  init() {
    // Find record button
    this.recordBtn = document.getElementById('recordBtn');
    
    // Create recording UI if it doesn't exist
    this.createRecordingUI();
    
    // Add event listener if button exists
    if (this.recordBtn) {
      this.recordBtn.addEventListener('click', this.toggleRecording);
    }
    
    // Subscribe to events
    eventBus.subscribe('voice:record:toggle', this.toggleRecording);
    eventBus.subscribe('voice:transcription:toggle', this.toggleTranscription);
  }
  
  /**
   * Create recording UI components
   */
  createRecordingUI() {
    // If record button doesn't exist, create it
    if (!this.recordBtn) {
      const messageInputArea = document.querySelector('.message-input-area');
      
      if (messageInputArea) {
        // Create record button
        this.recordBtn = document.createElement('button');
        this.recordBtn.id = 'recordBtn';
        this.recordBtn.className = 'record-btn';
        this.recordBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        this.recordBtn.title = 'Record Voice Message';
        
        // Add record button to input area
        messageInputArea.appendChild(this.recordBtn);
        
        // Add event listener
        this.recordBtn.addEventListener('click', this.toggleRecording);
      }
    }
    
    // Create recording indicator if it doesn't exist
    if (!document.getElementById('recordingIndicator')) {
      const recordingIndicator = document.createElement('div');
      recordingIndicator.id = 'recordingIndicator';
      recordingIndicator.className = 'recording-indicator';
      recordingIndicator.style.display = 'none';
      
      recordingIndicator.innerHTML = `
        <div class="recording-info">
          <div class="recording-pulse"></div>
          <span class="recording-time">00:00</span>
        </div>
        <div class="recording-actions">
          <button id="stopRecordingBtn" class="stop-recording-btn">
            <i class="fas fa-stop"></i>
          </button>
          <button id="cancelRecordingBtn" class="cancel-recording-btn">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `;
      
      // Add to document
      document.body.appendChild(recordingIndicator);
      
      // Add event listeners
      document.getElementById('stopRecordingBtn').addEventListener('click', this.stopRecording);
      document.getElementById('cancelRecordingBtn').addEventListener('click', () => {
        // Cancel recording without uploading
        this.stopRecording(true);
      });
    }
    
    // Create transcription toggle if it doesn't exist
    if (!document.getElementById('transcriptionToggle')) {
      const messageInputArea = document.querySelector('.message-actions') || document.querySelector('.message-input-area');
      
      if (messageInputArea) {
        const transcriptionToggle = document.createElement('div');
        transcriptionToggle.className = 'transcription-toggle';
        
        transcriptionToggle.innerHTML = `
          <label for="enableTranscription" class="transcription-label">
            <input type="checkbox" id="enableTranscription" ${this.transcriptionEnabled ? 'checked' : ''}>
            <span class="toggle-label">Transcribe Voice Messages</span>
          </label>
        `;
        
        // Add to document
        messageInputArea.appendChild(transcriptionToggle);
        
        // Add event listener
        document.getElementById('enableTranscription').addEventListener('change', (e) => {
          this.toggleTranscription({ enabled: e.target.checked });
        });
      }
    }
  }
  
  /**
   * Toggle recording functionality
   */
  toggleRecording() {
    if (this.isRecording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  }
  
  /**
   * Start audio recording
   */
  async startRecording() {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Create MediaRecorder instance
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];
      
      // Handle data available event
      this.mediaRecorder.ondataavailable = (event) => {
        this.audioChunks.push(event.data);
      };
      
      // Handle recording stop
      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
        this.uploadAudioFile(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      // Start recording
      this.mediaRecorder.start();
      this.isRecording = true;
      
      // Update UI
      if (this.recordBtn) {
        this.recordBtn.classList.add('recording');
        this.recordBtn.innerHTML = '<i class="fas fa-stop"></i>';
      }
      
      // Notify user
      eventBus.publish('notification', {
        message: 'Recording started...',
        type: 'info'
      });
    } catch (error) {
      console.error('Failed to start recording:', error);
      
      // Notify user of error
      eventBus.publish('error', {
        message: 'Microphone access denied',
        error
      });
    }
  }
  
  /**
   * Stop audio recording
   */
  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
      
      // Update UI
      if (this.recordBtn) {
        this.recordBtn.classList.remove('recording');
        this.recordBtn.innerHTML = '<i class="fas fa-microphone"></i>';
      }
      
      // Notify user
      eventBus.publish('notification', {
        message: 'Recording stopped',
        type: 'success'
      });
    }
  }
  
  /**
   * Upload recorded audio file
   * @param {Blob} audioBlob - The recorded audio as Blob
   */
  async uploadAudioFile(audioBlob) {
    try {
      // Create FormData
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');
      formData.append('action', 'upload_audio');
      
      // Upload to server
      const result = await apiClient.upload('/upload.php', formData);
      
      if (result.success) {
        // Publish message sent event
        eventBus.publish('message:send', {
          content: '[Audio Message]',
          type: 'audio',
          file_path: result.file_path,
          file_size: result.file_size || audioBlob.size,
          mime_type: 'audio/wav'
        });
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Failed to upload audio:', error);
      
      // Notify user of error
      eventBus.publish('error', {
        message: 'Failed to send audio message',
        error
      });
    }
  }
}

export default VoiceRecorder;
