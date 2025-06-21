/**
 * Voice Messages Module
 * Handles recording, sending, and playing voice messages with transcription
 */

import apiClient from '../../services/api-client';
import notificationManager from '../../ui/notification-manager';
import { formatFileSize } from '../../utils/file-helpers';

class VoiceMessages {
  constructor() {
    this.isRecording = false;
    this.recorder = null;
    this.audioChunks = [];
    this.recordingStartTime = null;
    this.recordingTimer = null;
    this.maxRecordingTime = 300; // 5 minutes in seconds
    this.audioContext = null;
    this.mediaStream = null;
    this.chatInstance = null;
    this.recordingUI = null;
    this.transcriptionEnabled = true;
  }

  /**
   * Initialize voice messages module
   * @param {Object} chatInstance - The parent chat instance
   */
  init(chatInstance) {
    this.chatInstance = chatInstance;
    this.createRecordingUI();
    this.setupEventListeners();
    
    // Check if browser supports required APIs
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      this.disableVoiceMessages('Your browser does not support voice recording');
      return false;
    }
    
    return true;
  }

  /**
   * Create voice recording UI components
   */
  createRecordingUI() {
    // Create UI container if it doesn't exist
    if (document.getElementById('voice-recording-ui')) {
      this.recordingUI = document.getElementById('voice-recording-ui');
      return;
    }
    
    this.recordingUI = document.createElement('div');
    this.recordingUI.id = 'voice-recording-ui';
    this.recordingUI.className = 'voice-recording-ui hidden';
    
    // Create timer display
    const timerDisplay = document.createElement('div');
    timerDisplay.className = 'recording-timer';
    timerDisplay.textContent = '00:00';
    
    // Create recording controls
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'recording-controls';
    
    // Create cancel button
    const cancelButton = document.createElement('button');
    cancelButton.className = 'recording-cancel-btn';
    cancelButton.innerHTML = '<i class="fa fa-times"></i>';
    cancelButton.setAttribute('aria-label', 'Cancel recording');
    cancelButton.addEventListener('click', () => this.cancelRecording());
    
    // Create send button
    const sendButton = document.createElement('button');
    sendButton.className = 'recording-send-btn';
    sendButton.innerHTML = '<i class="fa fa-paper-plane"></i>';
    sendButton.setAttribute('aria-label', 'Send voice message');
    sendButton.addEventListener('click', () => this.stopRecording(true));
    
    // Assemble UI
    controlsContainer.appendChild(cancelButton);
    controlsContainer.appendChild(sendButton);
    
    this.recordingUI.appendChild(timerDisplay);
    this.recordingUI.appendChild(controlsContainer);
    
    // Add UI to the chat container
    const chatContainer = document.querySelector('.chat-container') || document.body;
    chatContainer.appendChild(this.recordingUI);
    
    // Add transcription toggle to chat settings
    this.addTranscriptionSetting();
  }

  /**
   * Add transcription setting to chat settings panel
   */
  addTranscriptionSetting() {
    const settingsContainer = document.querySelector('.chat-settings-container .settings-options');
    if (!settingsContainer || document.getElementById('voice-transcription-setting')) return;
    
    const settingItem = document.createElement('div');
    settingItem.className = 'settings-item';
    settingItem.id = 'voice-transcription-setting';
    
    const settingLabel = document.createElement('label');
    settingLabel.textContent = 'Auto-transcribe voice messages';
    settingLabel.setAttribute('for', 'transcription-toggle');
    
    const settingToggle = document.createElement('input');
    settingToggle.type = 'checkbox';
    settingToggle.id = 'transcription-toggle';
    settingToggle.checked = this.transcriptionEnabled;
    settingToggle.addEventListener('change', (e) => {
      this.transcriptionEnabled = e.target.checked;
      localStorage.setItem('voice_transcription_enabled', e.target.checked);
    });
    
    settingItem.appendChild(settingLabel);
    settingItem.appendChild(settingToggle);
    settingsContainer.appendChild(settingItem);
    
    // Load saved preference
    const savedPreference = localStorage.getItem('voice_transcription_enabled');
    if (savedPreference !== null) {
      this.transcriptionEnabled = savedPreference === 'true';
      settingToggle.checked = this.transcriptionEnabled;
    }
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Find or create voice message button
    const messageInput = document.querySelector('.message-input-container');
    if (!messageInput) return;
    
    let voiceButton = messageInput.querySelector('.voice-message-btn');
    
    if (!voiceButton) {
      voiceButton = document.createElement('button');
      voiceButton.className = 'voice-message-btn';
      voiceButton.innerHTML = '<i class="fa fa-microphone"></i>';
      voiceButton.setAttribute('aria-label', 'Record voice message');
      voiceButton.setAttribute('title', 'Record voice message');
      
      const attachButton = messageInput.querySelector('.attachment-btn');
      if (attachButton) {
        messageInput.insertBefore(voiceButton, attachButton);
      } else {
        messageInput.appendChild(voiceButton);
      }
    }
    
    // Toggle recording on button click
    voiceButton.addEventListener('click', () => this.toggleRecording());
    
    // Add keyboard shortcut (Alt+R)
    document.addEventListener('keydown', (e) => {
      if (e.altKey && e.key === 'r') {
        e.preventDefault();
        this.toggleRecording();
      }
    });
  }

  /**
   * Toggle recording state
   */
  async toggleRecording() {
    if (this.isRecording) {
      this.stopRecording(true);
    } else {
      await this.startRecording();
    }
  }

  /**
   * Start voice recording
   */
  async startRecording() {
    try {
      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Create and configure recorder
      this.recorder = new MediaRecorder(this.mediaStream);
      this.audioChunks = [];
      
      this.recorder.addEventListener('dataavailable', (e) => {
        if (e.data.size > 0) {
          this.audioChunks.push(e.data);
        }
      });
      
      this.recorder.addEventListener('error', (e) => {
        console.error('Recording error:', e);
        notificationManager.showNotification('Error during recording. Please try again.', 'error');
        this.cancelRecording();
      });
      
      // Start recording
      this.recorder.start(1000); // Collect data in 1-second chunks
      this.isRecording = true;
      this.recordingStartTime = Date.now();
      this.showRecordingUI();
      
      // Start timer
      this.startRecordingTimer();
      
      // Set recording timeout (5 minutes max)
      setTimeout(() => {
        if (this.isRecording) {
          notificationManager.showNotification('Maximum recording time reached (5 minutes)', 'info');
          this.stopRecording(true);
        }
      }, this.maxRecordingTime * 1000);
      
      // Update UI
      const voiceButton = document.querySelector('.voice-message-btn');
      if (voiceButton) {
        voiceButton.classList.add('recording');
        voiceButton.querySelector('i').className = 'fa fa-stop';
      }
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      notificationManager.showNotification('Could not access microphone. Please check permissions.', 'error');
      this.isRecording = false;
    }
  }

  /**
   * Stop voice recording
   * @param {boolean} save - Whether to save and send the recording
   */
  async stopRecording(save = true) {
    if (!this.isRecording || !this.recorder) return;
    
    // Stop recorder and release microphone
    this.recorder.stop();
    this.mediaStream.getTracks().forEach(track => track.stop());
    this.isRecording = false;
    
    // Stop timer
    this.stopRecordingTimer();
    
    // Hide recording UI
    this.hideRecordingUI();
    
    // Update button state
    const voiceButton = document.querySelector('.voice-message-btn');
    if (voiceButton) {
      voiceButton.classList.remove('recording');
      voiceButton.querySelector('i').className = 'fa fa-microphone';
    }
    
    // If we should save the recording
    if (save && this.audioChunks.length > 0) {
      // Create audio blob
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
      
      // If recording is too short (less than 1 second), ignore it
      const recordingDuration = (Date.now() - this.recordingStartTime) / 1000;
      if (recordingDuration < 1) {
        notificationManager.showNotification('Recording too short', 'info');
        return;
      }
      
      // Upload and send the recording
      await this.sendVoiceMessage(audioBlob, recordingDuration);
    }
    
    // Reset state
    this.audioChunks = [];
    this.recorder = null;
    this.mediaStream = null;
    this.recordingStartTime = null;
  }

  /**
   * Cancel the current recording
   */
  cancelRecording() {
    this.stopRecording(false);
    notificationManager.showNotification('Recording cancelled', 'info');
  }

  /**
   * Send voice message to chat
   * @param {Blob} audioBlob - Audio data
   * @param {number} duration - Recording duration in seconds
   */
  async sendVoiceMessage(audioBlob, duration) {
    try {
      // Show loading state
      notificationManager.showNotification('Processing voice message...', 'info');
      
      // Create FormData for upload
      const formData = new FormData();
      const fileName = `voice_message_${Date.now()}.webm`;
      formData.append('audio', audioBlob, fileName);
      formData.append('duration', Math.round(duration));
      formData.append('transcribe', this.transcriptionEnabled ? '1' : '0');
      
      // Add chat context
      if (this.chatInstance.activeChatId) {
        formData.append('chat_id', this.chatInstance.activeChatId);
      }
      if (this.chatInstance.chatType) {
        formData.append('chat_type', this.chatInstance.chatType);
      }
      
      // Upload to server
      const response = await apiClient.post('/api/upload.php', formData, {
        headers: {
          'X-File-Type': 'audio'
        }
      });
      
      if (!response.success) {
        throw new Error(response.message || 'Failed to upload voice message');
      }
      
      // Send message with voice attachment
      await this.chatInstance.sendMessage({
        type: 'voice',
        content: response.transcription || '',
        attachment: {
          id: response.file_id,
          url: response.file_url,
          duration: Math.round(duration),
          size: audioBlob.size,
          transcription: response.transcription || null
        }
      });
      
      notificationManager.showNotification('Voice message sent', 'success');
      
    } catch (error) {
      console.error('Failed to send voice message:', error);
      notificationManager.showNotification('Failed to send voice message. Please try again.', 'error');
    }
  }

  /**
   * Start recording timer
   */
  startRecordingTimer() {
    const timerDisplay = this.recordingUI.querySelector('.recording-timer');
    if (!timerDisplay) return;
    
    timerDisplay.textContent = '00:00';
    this.recordingTimer = setInterval(() => {
      if (!this.recordingStartTime) return;
      
      const elapsedSeconds = Math.floor((Date.now() - this.recordingStartTime) / 1000);
      const minutes = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0');
      const seconds = (elapsedSeconds % 60).toString().padStart(2, '0');
      
      timerDisplay.textContent = `${minutes}:${seconds}`;
      
      // Visual warning when approaching max time
      if (elapsedSeconds > this.maxRecordingTime - 30) {
        timerDisplay.classList.add('warning');
      }
    }, 1000);
  }

  /**
   * Stop recording timer
   */
  stopRecordingTimer() {
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }
    
    const timerDisplay = this.recordingUI.querySelector('.recording-timer');
    if (timerDisplay) {
      timerDisplay.classList.remove('warning');
    }
  }

  /**
   * Show recording UI
   */
  showRecordingUI() {
    if (this.recordingUI) {
      this.recordingUI.classList.remove('hidden');
    }
  }

  /**
   * Hide recording UI
   */
  hideRecordingUI() {
    if (this.recordingUI) {
      this.recordingUI.classList.add('hidden');
    }
  }

  /**
   * Play a voice message
   * @param {string} audioUrl - URL to the audio file
   * @param {HTMLElement} controlElement - The element to update with play state
   */
  playVoiceMessage(audioUrl, controlElement) {
    // Create audio element if it doesn't exist
    let audio = controlElement.querySelector('audio');
    if (!audio) {
      audio = new Audio(audioUrl);
      audio.preload = 'auto';
      controlElement.appendChild(audio);
      
      // Add event listeners
      audio.addEventListener('ended', () => {
        controlElement.classList.remove('playing');
        controlElement.querySelector('i').className = 'fa fa-play';
      });
      
      audio.addEventListener('pause', () => {
        controlElement.classList.remove('playing');
        controlElement.querySelector('i').className = 'fa fa-play';
      });
      
      audio.addEventListener('play', () => {
        controlElement.classList.add('playing');
        controlElement.querySelector('i').className = 'fa fa-pause';
      });
    }
    
    // Toggle play/pause
    if (audio.paused) {
      // Stop any other playing audio
      document.querySelectorAll('audio').forEach(a => {
        if (a !== audio && !a.paused) a.pause();
      });
      audio.play();
    } else {
      audio.pause();
    }
  }

  /**
   * Disable voice messages functionality
   * @param {string} reason - Reason for disabling
   */
  disableVoiceMessages(reason) {
    const voiceButton = document.querySelector('.voice-message-btn');
    if (voiceButton) {
      voiceButton.disabled = true;
      voiceButton.setAttribute('title', reason);
      voiceButton.classList.add('disabled');
    }
    
    console.warn('Voice messages disabled:', reason);
  }
}

export default VoiceMessages;
