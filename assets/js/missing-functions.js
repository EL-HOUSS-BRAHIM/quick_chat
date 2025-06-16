/**
 * Missing functions implementation for Quick Chat
 * These functions are referenced in the TODO list but not implemented
 */

// Add to QuickChatApp class prototype
if (typeof QuickChatApp !== 'undefined') {
    
    /**
     * Toggle emoji picker display
     */
    QuickChatApp.prototype.toggleEmojiPicker = function() {
        console.log('Toggle emoji picker');
        const emojiPicker = document.getElementById('emojiPicker');
        if (emojiPicker) {
            const isVisible = emojiPicker.style.display !== 'none';
            emojiPicker.style.display = isVisible ? 'none' : 'block';
            
            if (!isVisible) {
                // Load emojis if not already loaded
                this.loadEmojiPicker();
            }
        }
    };

    /**
     * Load emoji picker content
     */
    QuickChatApp.prototype.loadEmojiPicker = function() {
        const emojiContainer = document.querySelector('.emoji-grid');
        if (!emojiContainer || emojiContainer.children.length > 0) return;
        
        const emojis = [
            '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
            '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
            '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
            '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
            '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬',
            '👍', '👎', '👌', '🤞', '✌️', '🤟', '🤘', '👈', '👉', '👆',
            '👇', '☝️', '✋', '🤚', '🖐️', '🖖', '👋', '🤙', '💪', '🦵',
            '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔'
        ];
        
        emojis.forEach(emoji => {
            const emojiBtn = document.createElement('button');
            emojiBtn.className = 'emoji-btn';
            emojiBtn.textContent = emoji;
            emojiBtn.onclick = () => this.insertEmoji(emoji);
            emojiContainer.appendChild(emojiBtn);
        });
    };

    /**
     * Insert emoji into message input
     */
    QuickChatApp.prototype.insertEmoji = function(emoji) {
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            const cursorPos = messageInput.selectionStart;
            const text = messageInput.value;
            const newText = text.slice(0, cursorPos) + emoji + text.slice(cursorPos);
            messageInput.value = newText;
            messageInput.focus();
            messageInput.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);
            
            // Hide emoji picker
            this.toggleEmojiPicker();
        }
    };

    /**
     * Toggle recording functionality
     */
    QuickChatApp.prototype.toggleRecording = function() {
        console.log('Toggle recording');
        if (this.isRecording) {
            this.stopRecording();
        } else {
            this.startRecording();
        }
    };

    /**
     * Start audio recording
     */
    QuickChatApp.prototype.startRecording = async function() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };
            
            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                this.uploadAudioFile(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };
            
            this.mediaRecorder.start();
            this.isRecording = true;
            
            // Update UI
            const recordBtn = document.getElementById('recordBtn');
            if (recordBtn) {
                recordBtn.classList.add('recording');
                recordBtn.innerHTML = '<i class="fas fa-stop"></i>';
            }
            
            if (this.showToast) {
                this.showToast('Recording started...', 'info');
            }
        } catch (error) {
            console.error('Failed to start recording:', error);
            if (this.showToast) {
                this.showToast('Microphone access denied', 'error');
            }
        }
    };

    /**
     * Stop audio recording
     */
    QuickChatApp.prototype.stopRecording = function() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            
            // Update UI
            const recordBtn = document.getElementById('recordBtn');
            if (recordBtn) {
                recordBtn.classList.remove('recording');
                recordBtn.innerHTML = '<i class="fas fa-microphone"></i>';
            }
            
            if (this.showToast) {
                this.showToast('Recording stopped', 'success');
            }
        }
    };

    /**
     * Upload recorded audio file
     */
    QuickChatApp.prototype.uploadAudioFile = async function(audioBlob) {
        try {
            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.wav');
            formData.append('action', 'upload_audio');
            
            const response = await fetch('/api/upload.php', {
                method: 'POST',
                body: formData,
                credentials: 'same-origin'
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Send audio message
                if (this.sendMessage) {
                    this.sendMessage(`[Audio Message]`, 'audio', result.file_path);
                }
            } else {
                throw new Error(result.error || 'Upload failed');
            }
        } catch (error) {
            console.error('Failed to upload audio:', error);
            if (this.showToast) {
                this.showToast('Failed to send audio message', 'error');
            }
        }
    };

    /**
     * Show settings modal
     */
    QuickChatApp.prototype.showSettings = function() {
        console.log('Show settings');
        const settingsModal = document.getElementById('settingsModal');
        if (settingsModal) {
            settingsModal.style.display = 'flex';
            this.loadUserSettings();
        }
    };

    /**
     * Load user settings into the settings modal
     */
    QuickChatApp.prototype.loadUserSettings = function() {
        // Sound settings
        const soundToggle = document.getElementById('soundEnabled');
        if (soundToggle && this.state) {
            soundToggle.checked = this.state.soundEnabled;
        }
        
        // Theme settings
        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect && this.state) {
            themeSelect.value = this.state.theme;
        }
        
        // Notification settings
        const notificationToggle = document.getElementById('notificationsEnabled');
        if (notificationToggle && this.getStoredPreference) {
            notificationToggle.checked = this.getStoredPreference('notificationsEnabled', true);
        }
    };
}

// Global functions for backward compatibility
window.toggleEmojiPicker = function() {
    if (window.quickChatApp && window.quickChatApp.toggleEmojiPicker) {
        window.quickChatApp.toggleEmojiPicker();
    }
};

window.toggleRecording = function() {
    if (window.quickChatApp && window.quickChatApp.toggleRecording) {
        window.quickChatApp.toggleRecording();
    }
};

window.showSettings = function() {
    if (window.quickChatApp && window.quickChatApp.showSettings) {
        window.quickChatApp.showSettings();
    }
};
