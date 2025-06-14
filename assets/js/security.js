// security.js - Security helpers for Quick Chat

// Get CSRF token from meta tag
function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
}

// Sanitize input (basic)
function sanitizeInput(input) {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
}

// Export for use in other scripts
window.security = { getCsrfToken, sanitizeInput };
