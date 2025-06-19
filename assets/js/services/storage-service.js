/**
 * Storage Service
 * 
 * Provides a unified interface for storing and retrieving data from
 * localStorage, sessionStorage, and IndexedDB.
 */

class StorageService {
  constructor() {
    this.prefix = 'quick_chat_';
  }
  
  /**
   * Save data to localStorage
   * @param {string} key - Storage key
   * @param {any} value - Value to store
   * @param {boolean} isPersistent - Whether to use localStorage (true) or sessionStorage (false)
   */
  set(key, value, isPersistent = true) {
    const prefixedKey = this.prefix + key;
    const storage = isPersistent ? localStorage : sessionStorage;
    
    try {
      const serialized = JSON.stringify(value);
      storage.setItem(prefixedKey, serialized);
      return true;
    } catch (e) {
      console.error('Storage error:', e);
      return false;
    }
  }
  
  /**
   * Get data from storage
   * @param {string} key - Storage key
   * @param {any} defaultValue - Default value if key doesn't exist
   * @param {boolean} isPersistent - Whether to use localStorage (true) or sessionStorage (false)
   * @returns {any} - Stored value or default value
   */
  get(key, defaultValue = null, isPersistent = true) {
    const prefixedKey = this.prefix + key;
    const storage = isPersistent ? localStorage : sessionStorage;
    
    const value = storage.getItem(prefixedKey);
    
    if (value === null) {
      return defaultValue;
    }
    
    try {
      return JSON.parse(value);
    } catch (e) {
      console.error('Storage parse error:', e);
      return defaultValue;
    }
  }
  
  /**
   * Remove item from storage
   * @param {string} key - Storage key
   * @param {boolean} isPersistent - Whether to use localStorage (true) or sessionStorage (false)
   */
  remove(key, isPersistent = true) {
    const prefixedKey = this.prefix + key;
    const storage = isPersistent ? localStorage : sessionStorage;
    
    storage.removeItem(prefixedKey);
  }
  
  /**
   * Clear all app-related items from storage
   * @param {boolean} isPersistent - Whether to clear localStorage (true) or sessionStorage (false)
   */
  clear(isPersistent = true) {
    const storage = isPersistent ? localStorage : sessionStorage;
    
    // Only clear items with our prefix
    for (let i = storage.length - 1; i >= 0; i--) {
      const key = storage.key(i);
      
      if (key.startsWith(this.prefix)) {
        storage.removeItem(key);
      }
    }
  }
  
  /**
   * Store data in IndexedDB for larger storage needs
   * @param {string} storeName - Name of the object store
   * @param {string} key - Key to store the data under
   * @param {any} value - Value to store
   * @returns {Promise<boolean>} - Success status
   */
  async setInDb(storeName, key, value) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.prefix + 'db', 1);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create the object store if it doesn't exist
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName);
        }
      };
      
      request.onerror = (event) => {
        console.error('IndexedDB error:', event.target.error);
        reject(event.target.error);
      };
      
      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        const storeRequest = store.put(value, key);
        
        storeRequest.onsuccess = () => resolve(true);
        storeRequest.onerror = (e) => {
          console.error('Store error:', e.target.error);
          reject(e.target.error);
        };
      };
    });
  }
  
  /**
   * Get data from IndexedDB
   * @param {string} storeName - Name of the object store
   * @param {string} key - Key to retrieve
   * @returns {Promise<any>} - Retrieved value
   */
  async getFromDb(storeName, key) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.prefix + 'db', 1);
      
      request.onerror = (event) => {
        console.error('IndexedDB error:', event.target.error);
        reject(event.target.error);
      };
      
      request.onsuccess = (event) => {
        const db = event.target.result;
        
        // Check if the object store exists
        if (!db.objectStoreNames.contains(storeName)) {
          resolve(null);
          return;
        }
        
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        
        const storeRequest = store.get(key);
        
        storeRequest.onsuccess = () => resolve(storeRequest.result || null);
        storeRequest.onerror = (e) => {
          console.error('Retrieval error:', e.target.error);
          reject(e.target.error);
        };
      };
    });
  }
}

// Create a singleton instance
const storageService = new StorageService();

export default storageService;
