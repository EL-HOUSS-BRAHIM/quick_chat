// chat.js - Main chat logic for Quick Chat

document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const messagesContainer = document.getElementById('messagesContainer');
    const charCount = document.getElementById('charCount');
    const emojiBtn = document.getElementById('emojiBtn');
    const emojiPicker = document.getElementById('emojiPicker');
    const themeToggle = document.getElementById('themeToggle');
    const body = document.body;

    // Character count
    if (messageInput && charCount) {
        messageInput.addEventListener('input', function() {
            charCount.textContent = messageInput.value.length;
        });
    }

    // Send message
    if (sendBtn && messageInput) {
        sendBtn.addEventListener('click', sendMessage);
        messageInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    function sendMessage() {
        const text = messageInput.value.trim();
        if (!text) return;
        // For demo, just append to messages
        appendMessage('You', text);
        messageInput.value = '';
        charCount.textContent = '0';
    }

    function appendMessage(user, text) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message';
        msgDiv.innerHTML = `<strong>${user}:</strong> ${window.security.sanitizeInput(text)}`;
        messagesContainer.appendChild(msgDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Emoji picker toggle
    if (emojiBtn && emojiPicker) {
        emojiBtn.addEventListener('click', function() {
            emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'block' : 'none';
        });
    }

    // Theme toggle - updated to use data-theme attribute
    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            const html = document.documentElement;
            if (html.getAttribute('data-theme') === 'dark') {
                html.removeAttribute('data-theme');
                localStorage.setItem('theme', 'light');
            } else {
                html.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
            }
        });
        // Load theme
        if (localStorage.getItem('theme') === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    }
});
