/**
 * WebRTC Call Recorder
 * Handles recording of audio/video calls
 */

import errorHandler from '../../core/error-handler.js';
import utils from '../../core/utils.js';

class CallRecorder {
  constructor(options = {}) {
    this.config = {
      mimeType: options.mimeType || 'video/webm;codecs=vp8,opus',
      audioBitsPerSecond: options.audioBitsPerSecond || 128000,
      videoBitsPerSecond: options.videoBitsPerSecond || 2500000,
      ...options
    };
    
    this.recorder = null;
    this.recordedBlobs = [];
    this.recordingStream = null;
    this.recordingStartTime = null;
    this.recordingStopTime = null;
    this.callId = null;
  }
  
  /**
   * Start recording
   */
  async start(streams, callId) {
    try {
      // Check if already recording
      if (this.recorder) {
        throw new Error('Recording already in progress');
      }
      
      // Store call ID
      this.callId = callId;
      
      // Check if MediaRecorder is supported
      if (!window.MediaRecorder) {
        throw new Error('MediaRecorder not supported in this browser');
      }
      
      // Check if we have streams to record
      if (!streams || streams.length === 0) {
        throw new Error('No streams to record');
      }
      
      // Combine streams into a single stream for recording
      const recordingStream = this.combineStreams(streams);
      this.recordingStream = recordingStream;
      
      // Check if the selected mime type is supported
      if (!MediaRecorder.isTypeSupported(this.config.mimeType)) {
        console.warn(`${this.config.mimeType} is not supported, using default mime type`);
        this.config.mimeType = '';
      }
      
      // Create MediaRecorder
      this.recorder = new MediaRecorder(recordingStream, {
        mimeType: this.config.mimeType,
        audioBitsPerSecond: this.config.audioBitsPerSecond,
        videoBitsPerSecond: this.config.videoBitsPerSecond
      });
      
      // Clear recorded blobs
      this.recordedBlobs = [];
      
      // Set up event handlers
      this.recorder.ondataavailable = this.handleDataAvailable.bind(this);
      this.recorder.onerror = this.handleRecorderError.bind(this);
      
      // Start recording
      this.recorder.start(1000); // Capture data every second
      this.recordingStartTime = Date.now();
      
      console.log('Recording started for call', callId);
      
    } catch (error) {
      errorHandler.handleError(error, 'Failed to start recording');
      throw error;
    }
  }
  
  /**
   * Stop recording
   */
  async stop() {
    try {
      if (!this.recorder || this.recorder.state === 'inactive') {
        throw new Error('No active recording to stop');
      }
      
      // Return a promise that resolves when recording stops
      return new Promise((resolve, reject) => {
        // Set up onstop handler
        this.recorder.onstop = () => {
          this.recordingStopTime = Date.now();
          
          // Release recording stream
          if (this.recordingStream) {
            this.recordingStream.getTracks().forEach(track => {
              track.stop();
            });
            this.recordingStream = null;
          }
          
          // Create recording result
          const result = this.createRecordingResult();
          
          console.log('Recording stopped for call', this.callId);
          
          resolve(result);
        };
        
        // Stop recording
        this.recorder.stop();
      });
      
    } catch (error) {
      errorHandler.handleError(error, 'Failed to stop recording');
      throw error;
    }
  }
  
  /**
   * Pause recording
   */
  pause() {
    if (this.recorder && this.recorder.state === 'recording') {
      this.recorder.pause();
      console.log('Recording paused');
    }
  }
  
  /**
   * Resume recording
   */
  resume() {
    if (this.recorder && this.recorder.state === 'paused') {
      this.recorder.resume();
      console.log('Recording resumed');
    }
  }
  
  /**
   * Handle data available event
   */
  handleDataAvailable(event) {
    if (event.data && event.data.size > 0) {
      this.recordedBlobs.push(event.data);
    }
  }
  
  /**
   * Handle recorder error
   */
  handleRecorderError(error) {
    errorHandler.handleError(error, 'MediaRecorder error');
    this.cleanup();
  }
  
  /**
   * Combine multiple streams into a single stream
   */
  combineStreams(streams) {
    // If only one stream, return it directly
    if (streams.length === 1) {
      return streams[0];
    }
    
    // Collect all tracks from all streams
    const audioTracks = [];
    const videoTracks = [];
    
    streams.forEach(stream => {
      stream.getAudioTracks().forEach(track => audioTracks.push(track));
      stream.getVideoTracks().forEach(track => videoTracks.push(track));
    });
    
    // Create a new stream with all tracks
    const combinedStream = new MediaStream();
    
    // Add audio tracks (limit to 1 for better quality)
    if (audioTracks.length > 0) {
      combinedStream.addTrack(audioTracks[0]);
    }
    
    // Add video tracks (limit to 1 for better quality)
    if (videoTracks.length > 0) {
      combinedStream.addTrack(videoTracks[0]);
    }
    
    return combinedStream;
  }
  
  /**
   * Create recording result object
   */
  createRecordingResult() {
    // Create blob from recorded data
    const blob = new Blob(this.recordedBlobs, { type: this.config.mimeType || 'video/webm' });
    
    // Create object URL
    const url = URL.createObjectURL(blob);
    
    // Calculate duration
    const duration = this.recordingStopTime - this.recordingStartTime;
    
    return {
      callId: this.callId,
      blob,
      url,
      size: blob.size,
      type: blob.type,
      duration,
      startTime: this.recordingStartTime,
      stopTime: this.recordingStopTime
    };
  }
  
  /**
   * Download recording
   */
  downloadRecording(recordingResult) {
    if (!recordingResult || !recordingResult.blob) {
      throw new Error('No valid recording to download');
    }
    
    // Create filename
    const date = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `call-recording-${recordingResult.callId}-${date}.webm`;
    
    // Create download link
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = recordingResult.url;
    a.download = filename;
    
    // Add to document, click, and remove
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
    }, 100);
  }
  
  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.recorder) {
      if (this.recorder.state !== 'inactive') {
        try {
          this.recorder.stop();
        } catch (error) {
          console.warn('Error stopping recorder during cleanup:', error);
        }
      }
      
      this.recorder = null;
    }
    
    if (this.recordingStream) {
      this.recordingStream.getTracks().forEach(track => {
        track.stop();
      });
      this.recordingStream = null;
    }
    
    this.recordedBlobs = [];
    this.recordingStartTime = null;
    this.recordingStopTime = null;
    this.callId = null;
  }
}

export default CallRecorder;
