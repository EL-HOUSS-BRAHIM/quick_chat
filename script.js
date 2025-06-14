// Security and utility functions
class ChatSecurity {
    static sanitizeInput(input) {
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    }
    
    static generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    static hashPassword(password) {
        // Simple hash function for demo - in production use proper hashing
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
    }
    
    static validateInput(input, minLength = 1, maxLength = 1000) {
        return input && input.trim().length >= minLength && input.trim().length <= maxLength;
    }
}

// Chat Application Class
class QuickChat {
    constructor() {
        this.currentUser = null;
        this.messages = JSON.parse(localStorage.getItem('chatMessages')) || [];
        this.users = JSON.parse(localStorage.getItem('chatUsers')) || {};
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecording = false;
        
        this.initializeElements();
        this.bindEvents();
        this.checkAuthentication();
    }
    
    initializeElements() {
        // Screens
        this.loginScreen = document.getElementById('loginScreen');
        this.chatScreen = document.getElementById('chatScreen');
        
        // Login elements
        this.loginForm = document.getElementById('loginForm');
        this.registerForm = document.getElementById('registerForm');
        this.registerContainer = document.getElementById('registerContainer');
        this.showRegisterBtn = document.getElementById('showRegister');
        this.showLoginBtn = document.getElementById('showLogin');
        
        // Chat elements
        this.messagesContainer = document.getElementById('messagesContainer');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.attachBtn = document.getElementById('attachBtn');
        this.recordBtn = document.getElementById('recordBtn');
        this.imageInput = document.getElementById('imageInput');
        this.clearChatBtn = document.getElementById('clearChatBtn');
        this.logoutBtn = document.getElementById('logoutBtn');
        this.currentUserElement = document.getElementById('currentUser');
        this.recordingIndicator = document.getElementById('recordingIndicator');
    }
    
    bindEvents() {
        // Login/Register events
        this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        this.registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        this.showRegisterBtn.addEventListener('click', (e) => this.showRegisterForm(e));
        this.showLoginBtn.addEventListener('click', (e) => this.showLoginForm(e));
        
        // Chat events
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        this.messageInput.addEventListener('input', () => this.autoResize());
        
        // Media events
        this.attachBtn.addEventListener('click', () => this.imageInput.click());
        this.imageInput.addEventListener('change', (e) => this.handleImageUpload(e));
        this.recordBtn.addEventListener('click', () => this.toggleRecording());
        
        // Action events
        this.clearChatBtn.addEventListener('click', () => this.clearChat());
        this.logoutBtn.addEventListener('click', () => this.logout());
    }
    
    checkAuthentication() {
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            this.showChatScreen();
        }
    }
    
    // Authentication methods
    handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        
        if (!ChatSecurity.validateInput(username, 3, 20)) {
            this.showError('Username must be between 3 and 20 characters');
            return;
        }
        
        if (!ChatSecurity.validateInput(password, 6, 50)) {
            this.showError('Password must be at least 6 characters');
            return;
        }
        
        const hashedPassword = ChatSecurity.hashPassword(password);
        const user = this.users[username];
        
        if (user && user.password === hashedPassword) {
            this.currentUser = {
                username: username,
                email: user.email,
                loginTime: new Date().toISOString()
            };
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
            this.showChatScreen();
        } else {
            this.showError('Invalid username or password');
        }
    }
    
    handleRegister(e) {
        e.preventDefault();
        const username = document.getElementById('regUsername').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const password = document.getElementById('regPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        // Validation
        if (!ChatSecurity.validateInput(username, 3, 20)) {
            this.showError('Username must be between 3 and 20 characters');
            return;
        }
        
        if (!this.isValidEmail(email)) {
            this.showError('Please enter a valid email address');
            return;
        }
        
        if (!ChatSecurity.validateInput(password, 6, 50)) {
            this.showError('Password must be at least 6 characters');
            return;
        }
        
        if (password !== confirmPassword) {
            this.showError('Passwords do not match');
            return;
        }
        
        if (this.users[username]) {
            this.showError('Username already exists');
            return;
        }
        
        // Create user
        const hashedPassword = ChatSecurity.hashPassword(password);
        this.users[username] = {
            email: email,
            password: hashedPassword,
            createdAt: new Date().toISOString()
        };
        
        localStorage.setItem('chatUsers', JSON.stringify(this.users));
        
        this.currentUser = {
            username: username,
            email: email,
            loginTime: new Date().toISOString()
        };
        localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
        
        this.showChatScreen();
    }
    
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    showRegisterForm(e) {
        e.preventDefault();
        this.loginForm.parentElement.style.display = 'none';
        this.registerContainer.style.display = 'block';
    }
    
    showLoginForm(e) {
        e.preventDefault();
        this.loginForm.parentElement.style.display = 'block';
        this.registerContainer.style.display = 'none';
    }
    
    showChatScreen() {
        this.loginScreen.classList.remove('active');
        this.chatScreen.classList.add('active');
        this.currentUserElement.textContent = this.currentUser.username;
        this.loadMessages();
        this.messageInput.focus();
    }
    
    showError(message) {
        // Create or update error message element
        let errorElement = document.querySelector('.error-message');
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.className = 'error-message';
            errorElement.style.cssText = `
                background: #fee;
                color: #c33;
                padding: 10px;
                border-radius: 5px;
                margin: 10px 0;
                border: 1px solid #fcc;
                font-size: 0.9rem;
                text-align: center;
            `;
            
            const activeForm = this.registerContainer.style.display === 'block' 
                ? this.registerContainer 
                : this.loginForm.parentElement;
            activeForm.appendChild(errorElement);
        }
        
        errorElement.textContent = message;
        
        // Remove error after 5 seconds
        setTimeout(() => {
            if (errorElement && errorElement.parentNode) {
                errorElement.parentNode.removeChild(errorElement);
            }
        }, 5000);
    }
    
    // Chat methods
    sendMessage() {
        const text = this.messageInput.value.trim();
        if (!text) return;
        
        const sanitizedText = ChatSecurity.sanitizeInput(text);
        const message = {
            id: ChatSecurity.generateId(),
            text: sanitizedText,
            sender: this.currentUser.username,
            timestamp: new Date().toISOString(),
            type: 'text'
        };
        
        this.addMessage(message);
        this.messageInput.value = '';
        this.autoResize();
    }
    
    addMessage(message) {
        this.messages.push(message);
        this.saveMessages();
        this.renderMessage(message);
        this.scrollToBottom();
    }
    
    renderMessage(message) {
        // Remove welcome message if it exists
        const welcomeMessage = this.messagesContainer.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }
        
        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.sender === this.currentUser.username ? 'sent' : 'received'}`;
        
        const time = new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        let content = '';
        
        if (message.type === 'text') {
            content = `
                <div class="message-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="message-content">
                    <div class="message-text">${message.text}</div>
                    <div class="message-time">${time}</div>
                </div>
            `;
        } else if (message.type === 'image') {
            content = `
                <div class="message-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="message-content">
                    <img src="${message.data}" alt="Shared image" class="message-image">
                    <div class="message-time">${time}</div>
                </div>
            `;
        } else if (message.type === 'audio') {
            content = `
                <div class="message-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="message-content">
                    <div class="message-audio">
                        <audio controls>
                            <source src="${message.data}" type="audio/webm">
                            Your browser does not support the audio element.
                        </audio>
                    </div>
                    <div class="message-time">${time}</div>
                </div>
            `;
        }
        
        messageElement.innerHTML = content;
        this.messagesContainer.appendChild(messageElement);
    }
    
    handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('Image size must be less than 5MB');
            return;
        }
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select a valid image file');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const message = {
                id: ChatSecurity.generateId(),
                data: e.target.result,
                sender: this.currentUser.username,
                timestamp: new Date().toISOString(),
                type: 'image'
            };
            
            this.addMessage(message);
        };
        reader.readAsDataURL(file);
        
        // Clear the input
        e.target.value = '';
    }
    
    async toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            await this.startRecording();
        }
    }
    
    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.recordedChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
                const audioUrl = URL.createObjectURL(blob);
                
                const message = {
                    id: ChatSecurity.generateId(),
                    data: audioUrl,
                    sender: this.currentUser.username,
                    timestamp: new Date().toISOString(),
                    type: 'audio'
                };
                
                this.addMessage(message);
                
                // Stop all tracks to release microphone
                stream.getTracks().forEach(track => track.stop());
            };
            
            this.mediaRecorder.start();
            this.isRecording = true;
            this.recordBtn.innerHTML = '<i class="fas fa-stop"></i>';
            this.recordBtn.style.background = '#dc3545';
            this.recordBtn.style.color = 'white';
            this.recordingIndicator.style.display = 'flex';
            
        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert('Could not access microphone. Please check your permissions.');
        }
    }
    
    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.recordBtn.innerHTML = '<i class="fas fa-microphone"></i>';
            this.recordBtn.style.background = '';
            this.recordBtn.style.color = '';
            this.recordingIndicator.style.display = 'none';
        }
    }
    
    loadMessages() {
        this.messagesContainer.innerHTML = '';
        
        if (this.messages.length === 0) {
            this.messagesContainer.innerHTML = `
                <div class="welcome-message">
                    <i class="fas fa-comments"></i>
                    <h3>Welcome to Quick Chat!</h3>
                    <p>Start a conversation by typing a message below.</p>
                </div>
            `;
        } else {
            this.messages.forEach(message => this.renderMessage(message));
        }
        
        this.scrollToBottom();
    }
    
    clearChat() {
        if (confirm('Are you sure you want to clear all messages? This action cannot be undone.')) {
            this.messages = [];
            this.saveMessages();
            this.loadMessages();
        }
    }
    
    logout() {
        if (confirm('Are you sure you want to logout?')) {
            localStorage.removeItem('currentUser');
            this.currentUser = null;
            this.chatScreen.classList.remove('active');
            this.loginScreen.classList.add('active');
            
            // Reset forms
            this.loginForm.reset();
            this.registerForm.reset();
            this.showLoginForm({ preventDefault: () => {} });
            
            // Clear any error messages
            const errorMessages = document.querySelectorAll('.error-message');
            errorMessages.forEach(error => error.remove());
        }
    }
    
    saveMessages() {
        localStorage.setItem('chatMessages', JSON.stringify(this.messages));
    }
    
    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
    
    autoResize() {
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = this.messageInput.scrollHeight + 'px';
        
        // Enable/disable send button based on input
        this.sendBtn.disabled = !this.messageInput.value.trim();
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const chat = new QuickChat();
    
    // Service worker registration for offline functionality (optional)
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(console.error);
    }
    
    // Prevent context menu on long press (mobile security)
    document.addEventListener('contextmenu', (e) => {
        if (e.target.tagName.toLowerCase() === 'img') {
            e.preventDefault();
        }
    });
    
    // Handle visibility change to update online status
    document.addEventListener('visibilitychange', () => {
        const statusElement = document.querySelector('.status');
        if (statusElement) {
            if (document.visibilityState === 'visible') {
                statusElement.textContent = 'Online';
                statusElement.classList.add('online');
            } else {
                statusElement.textContent = 'Away';
                statusElement.classList.remove('online');
            }
        }
    });
});
