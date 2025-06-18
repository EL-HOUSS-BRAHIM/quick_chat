/**
 * Chat Voice Recording Module
 * Handles voice message recording and upload
 */

import apiClient from '../../api/api-client.js';
import eventBus from '../../core/event-bus.js';

class VoiceRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.recordBtn = null;
    
    // Bind methods
    this.toggleRecording = this.toggleRecording.bind(this);
    this.startRecording = this.startRecording.bind(this);
    this.stopRecording = this.stopRecording.bind(this);
    this.uploadAudioFile = this.uploadAudioFile.bind(this);
    
    // Initialize
    this.init();
  }
  
  /**
   * Initialize voice recorder
   */
  init() {
    // Find record button
    this.recordBtn = document.getElementById('recordBtn');
    
    // Add event listener if button exists
    if (this.recordBtn) {
      this.recordBtn.addEventListener('click', this.toggleRecording);
    }
    
    // Subscribe to events
    eventBus.subscribe('voice:record:toggle', this.toggleRecording);
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
