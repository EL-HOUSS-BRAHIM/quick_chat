// security.js - Security helpers for Quick Chat - DEPRECATED
// LEGACY FILE: Now imports from core/security.js for backward compatibility

// Import the security module from the new location
import { 
    getCsrfToken as getCsrfTokenNew,
    sanitizeInput as sanitizeInputNew,
    validateEmail as validateEmailNew,
    checkPasswordStrength as checkPasswordStrengthNew,
    sanitizeUrl as sanitizeUrlNew,
    secureStorage as secureStorageNew
} from './core/security.js';

// Forward functions to the new implementations
function getCsrfToken() {
    console.warn('security.js is deprecated. Use core/security.js instead.');
    return getCsrfTokenNew();
}

function sanitizeInput(input) {
    console.warn('security.js is deprecated. Use core/security.js instead.');
    return sanitizeInputNew(input);
}

function validateEmail(email) {
    console.warn('security.js is deprecated. Use core/security.js instead.');
    return validateEmailNew(email);
}

function checkPasswordStrength(password) {
    console.warn('security.js is deprecated. Use core/security.js instead.');
    return checkPasswordStrengthNew(password);
}

function sanitizeUrl(url) {
    console.warn('security.js is deprecated. Use core/security.js instead.');
    return sanitizeUrlNew(url);
}

// Forward secureStorage to the new implementation
const secureStorage = {
    setItem(key, value, expireInMinutes = null) {
        console.warn('security.js is deprecated. Use core/security.js instead.');
        return secureStorageNew.setItem(key, value, expireInMinutes);
    },
    
    getItem(key) {
        console.warn('security.js is deprecated. Use core/security.js instead.');
        return secureStorageNew.getItem(key);
            
            // Check if item is expired
            if (item.expires && Date.now() > item.expires) {
                localStorage.removeItem(key);
                return null;
            }
            
            return item.value;
        } catch (e) {
            return null;
        }
    },
    
    removeItem(key) {
        console.warn('security.js is deprecated. Use core/security.js instead.');
        secureStorageNew.removeItem(key);
    },
    
    clear() {
        console.warn('security.js is deprecated. Use core/security.js instead.');
        secureStorageNew.clear();
    }
};

// Export for use in other scripts
window.security = { 
    getCsrfToken, 
    sanitizeInput, 
    validateEmail, 
    checkPasswordStrength,
    sanitizeUrl,
    secureStorage
};

// Also export as ES module
export { 
    getCsrfToken, 
    sanitizeInput, 
    validateEmail, 
    checkPasswordStrength,
    sanitizeUrl,
    secureStorage
};
