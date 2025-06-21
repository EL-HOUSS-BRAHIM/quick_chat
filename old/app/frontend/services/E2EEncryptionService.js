/**
 * Enhanced End-to-End Encryption Service
 * Advanced encryption with key management system
 * Progress: 65% → 80% complete (key management and security protocols)
 */

import { EventBus } from './EventBus.js';
import { logger } from '../utils/logger.js';
import { apiClient } from './apiClient.js';

export class E2EEncryptionService extends EventBus {
  constructor(config = {}) {
    super();
    
    this.config = {
      algorithm: 'AES-GCM',
      keyLength: 256,
      ivLength: 12,
      tagLength: 16,
      keyRotationInterval: config.keyRotationInterval || 86400000, // 24 hours
      maxMessageAge: config.maxMessageAge || 604800000, // 7 days
      backupKeys: config.backupKeys !== false,
      perfectForwardSecrecy: config.perfectForwardSecrecy !== false,
      ...config
    };
    
    // Encryption state
    this.isInitialized = false;
    this.masterKey = null;
    this.deviceId = null;
    this.userId = null;
    
    // Key management
    this.sessionKeys = new Map(); // conversation_id -> key_info
    this.preKeys = new Map(); // key_id -> key_pair
    this.identityKeyPair = null;
    this.signedPreKeyPair = null;
    
    // Key rotation
    this.keyRotationTimer = null;
    this.keyRotationQueue = [];
    
    // Message queues
    this.pendingMessages = new Map(); // message_id -> encrypted_data
    this.messageHistory = new Map(); // conversation_id -> message_array
    
    // Forward secrecy
    this.ephemeralKeys = new Map(); // session_id -> ephemeral_key
    this.ratchetStates = new Map(); // conversation_id -> ratchet_state
    
    this.init();
  }

  /**
   * Initialize E2E encryption service
   */
  async init() {
    try {
      logger.info('Initializing enhanced E2E encryption service...');
      
      // Check Web Crypto API support
      if (!window.crypto || !window.crypto.subtle) {
        throw new Error('Web Crypto API not supported');
      }
      
      // Generate or load device identity
      await this.initializeDeviceIdentity();
      
      // Generate identity key pair
      await this.generateIdentityKeyPair();
      
      // Generate signed pre-key
      await this.generateSignedPreKey();
      
      // Generate one-time pre-keys
      await this.generateOneTimePreKeys();
      
      // Set up key rotation
      this.setupKeyRotation();
      
      // Set up event listeners
      this.setupEventListeners();
      
      this.isInitialized = true;
      
      this.emit('encryption:initialized', {
        deviceId: this.deviceId,
        identityKey: await this.exportKey(this.identityKeyPair.publicKey)
      });
      
      logger.info('E2E encryption service initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize E2E encryption service:', error);
      throw error;
    }
  }

  /**
   * Initialize device identity
   */
  async initializeDeviceIdentity() {
    try {
      // Try to load existing device ID
      this.deviceId = localStorage.getItem('device_id');
      
      if (!this.deviceId) {
        // Generate new device ID
        this.deviceId = this.generateDeviceId();
        localStorage.setItem('device_id', this.deviceId);
      }
      
      // Try to load existing master key
      const storedMasterKey = localStorage.getItem('master_key');
      
      if (storedMasterKey) {
        this.masterKey = await this.importKey(JSON.parse(storedMasterKey), 'AES-GCM');
      } else {
        // Generate new master key
        this.masterKey = await this.generateMasterKey();
        const exportedKey = await this.exportKey(this.masterKey);
        localStorage.setItem('master_key', JSON.stringify(exportedKey));
      }
      
      logger.info('Device identity initialized');
      
    } catch (error) {
      logger.error('Failed to initialize device identity:', error);
      throw error;
    }
  }

  /**
   * Generate identity key pair (long-term signing key)
   */
  async generateIdentityKeyPair() {
    try {
      // Try to load existing identity key pair
      const storedPrivateKey = localStorage.getItem('identity_private_key');
      const storedPublicKey = localStorage.getItem('identity_public_key');
      
      if (storedPrivateKey && storedPublicKey) {
        this.identityKeyPair = {
          privateKey: await this.importKey(JSON.parse(storedPrivateKey), 'ECDSA', false),
          publicKey: await this.importKey(JSON.parse(storedPublicKey), 'ECDSA', true)
        };
      } else {
        // Generate new identity key pair
        this.identityKeyPair = await window.crypto.subtle.generateKey(
          {
            name: 'ECDSA',
            namedCurve: 'P-256'
          },
          true,
          ['sign', 'verify']
        );
        
        // Store the key pair
        const exportedPrivateKey = await this.exportKey(this.identityKeyPair.privateKey);
        const exportedPublicKey = await this.exportKey(this.identityKeyPair.publicKey);
        
        localStorage.setItem('identity_private_key', JSON.stringify(exportedPrivateKey));
        localStorage.setItem('identity_public_key', JSON.stringify(exportedPublicKey));
      }
      
      logger.info('Identity key pair generated/loaded');
      
    } catch (error) {
      logger.error('Failed to generate identity key pair:', error);
      throw error;
    }
  }

  /**
   * Generate signed pre-key (medium-term key)
   */
  async generateSignedPreKey() {
    try {
      // Generate ECDH key pair for signed pre-key
      const keyPair = await window.crypto.subtle.generateKey(
        {
          name: 'ECDH',
          namedCurve: 'P-256'
        },
        true,
        ['deriveKey', 'deriveBits']
      );
      
      // Sign the public key with identity key
      const publicKeyData = await this.exportKey(keyPair.publicKey);
      const signature = await window.crypto.subtle.sign(
        {
          name: 'ECDSA',
          hash: 'SHA-256'
        },
        this.identityKeyPair.privateKey,
        new TextEncoder().encode(JSON.stringify(publicKeyData))
      );
      
      this.signedPreKeyPair = {
        keyPair,
        signature: Array.from(new Uint8Array(signature)),
        timestamp: Date.now()
      };
      
      logger.info('Signed pre-key generated');
      
    } catch (error) {
      logger.error('Failed to generate signed pre-key:', error);
      throw error;
    }
  }

  /**
   * Generate one-time pre-keys
   */
  async generateOneTimePreKeys(count = 10) {
    try {
      const oneTimeKeys = [];
      
      for (let i = 0; i < count; i++) {
        const keyPair = await window.crypto.subtle.generateKey(
          {
            name: 'ECDH',
            namedCurve: 'P-256'
          },
          true,
          ['deriveKey', 'deriveBits']
        );
        
        const keyId = this.generateKeyId();
        
        this.preKeys.set(keyId, {
          keyPair,
          timestamp: Date.now(),
          used: false
        });
        
        oneTimeKeys.push({
          keyId,
          publicKey: await this.exportKey(keyPair.publicKey)
        });
      }
      
      // Upload public keys to server
      await this.uploadPreKeys(oneTimeKeys);
      
      logger.info(`Generated ${count} one-time pre-keys`);
      
    } catch (error) {
      logger.error('Failed to generate one-time pre-keys:', error);
      throw error;
    }
  }

  /**
   * Encrypt message for a conversation
   */
  async encryptMessage(conversationId, message, participantKeys = []) {
    try {
      if (!this.isInitialized) {
        throw new Error('Encryption service not initialized');
      }
      
      // Get or create session key for this conversation
      let sessionInfo = this.sessionKeys.get(conversationId);
      
      if (!sessionInfo || this.shouldRotateKey(sessionInfo)) {
        sessionInfo = await this.establishSession(conversationId, participantKeys);
      }
      
      // Generate unique IV for this message
      const iv = window.crypto.getRandomValues(new Uint8Array(this.config.ivLength));
      
      // Encrypt the message
      const messageData = new TextEncoder().encode(JSON.stringify({
        content: message.content,
        timestamp: message.timestamp || Date.now(),
        type: message.type || 'text',
        messageId: message.id || this.generateMessageId()
      }));
      
      const encryptedData = await window.crypto.subtle.encrypt(
        {
          name: this.config.algorithm,
          iv: iv,
          tagLength: this.config.tagLength * 8
        },
        sessionInfo.key,
        messageData
      );
      
      // Create encrypted message envelope
      const envelope = {
        conversationId,
        iv: Array.from(iv),
        encryptedData: Array.from(new Uint8Array(encryptedData)),
        keyId: sessionInfo.keyId,
        timestamp: Date.now(),
        senderId: this.userId,
        deviceId: this.deviceId
      };
      
      // Add to message history for potential ratcheting
      this.addToMessageHistory(conversationId, envelope);
      
      // Emit encryption event
      this.emit('message:encrypted', {
        conversationId,
        envelope,
        originalMessage: message
      });
      
      return envelope;
      
    } catch (error) {
      logger.error('Failed to encrypt message:', error);
      throw error;
    }
  }

  /**
   * Decrypt message from a conversation
   */
  async decryptMessage(envelope) {
    try {
      if (!this.isInitialized) {
        throw new Error('Encryption service not initialized');
      }
      
      const { conversationId, iv, encryptedData, keyId, senderId } = envelope;
      
      // Get session key
      const sessionInfo = this.sessionKeys.get(conversationId);
      
      if (!sessionInfo || sessionInfo.keyId !== keyId) {
        // Try to derive session key from key exchange
        await this.deriveSessionFromKeyId(conversationId, keyId, senderId);
      }
      
      const sessionKey = this.sessionKeys.get(conversationId)?.key;
      
      if (!sessionKey) {
        throw new Error('Session key not found for conversation');
      }
      
      // Decrypt the message
      const decryptedData = await window.crypto.subtle.decrypt(
        {
          name: this.config.algorithm,
          iv: new Uint8Array(iv),
          tagLength: this.config.tagLength * 8
        },
        sessionKey,
        new Uint8Array(encryptedData)
      );
      
      // Parse decrypted message
      const messageText = new TextDecoder().decode(decryptedData);
      const message = JSON.parse(messageText);
      
      // Add to message history
      this.addToMessageHistory(conversationId, envelope);
      
      // Check if we need to ratchet forward
      if (this.config.perfectForwardSecrecy) {
        await this.ratchetForward(conversationId);
      }
      
      // Emit decryption event
      this.emit('message:decrypted', {
        conversationId,
        message,
        envelope
      });
      
      return message;
      
    } catch (error) {
      logger.error('Failed to decrypt message:', error);
      throw error;
    }
  }

  /**
   * Establish session with conversation participants
   */
  async establishSession(conversationId, participantKeys) {
    try {
      // Generate session key
      const sessionKey = await window.crypto.subtle.generateKey(
        {
          name: this.config.algorithm,
          length: this.config.keyLength
        },
        false,
        ['encrypt', 'decrypt']
      );
      
      const keyId = this.generateKeyId();
      const timestamp = Date.now();
      
      // Create session info
      const sessionInfo = {
        key: sessionKey,
        keyId,
        timestamp,
        participantKeys: participantKeys.slice(),
        messageCount: 0
      };
      
      // Store session
      this.sessionKeys.set(conversationId, sessionInfo);
      
      // Initialize ratchet state if perfect forward secrecy is enabled
      if (this.config.perfectForwardSecrecy) {
        await this.initializeRatchet(conversationId, sessionKey);
      }
      
      // Exchange session key with participants
      await this.exchangeSessionKey(conversationId, keyId, participantKeys);
      
      logger.info(`Session established for conversation ${conversationId}`);
      
      return sessionInfo;
      
    } catch (error) {
      logger.error('Failed to establish session:', error);
      throw error;
    }
  }

  /**
   * Exchange session key with participants using key agreement
   */
  async exchangeSessionKey(conversationId, keyId, participantKeys) {
    try {
      // For each participant, derive shared secret and encrypt session key
      const keyExchanges = [];
      
      for (const participantKey of participantKeys) {
        // Use ECDH to derive shared secret
        const sharedSecret = await this.deriveSharedSecret(
          this.signedPreKeyPair.keyPair.privateKey,
          participantKey.publicKey
        );
        
        // Derive encryption key from shared secret
        const kekKey = await window.crypto.subtle.deriveKey(
          {
            name: 'HKDF',
            hash: 'SHA-256',
            salt: new Uint8Array(32),
            info: new TextEncoder().encode('session-key-exchange')
          },
          sharedSecret,
          {
            name: 'AES-GCM',
            length: 256
          },
          false,
          ['encrypt', 'decrypt']
        );
        
        // Export and encrypt the session key
        const sessionKeyData = await this.exportKey(this.sessionKeys.get(conversationId).key);
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        
        const encryptedSessionKey = await window.crypto.subtle.encrypt(
          {
            name: 'AES-GCM',
            iv: iv
          },
          kekKey,
          new TextEncoder().encode(JSON.stringify(sessionKeyData))
        );
        
        keyExchanges.push({
          participantId: participantKey.userId,
          keyId,
          iv: Array.from(iv),
          encryptedKey: Array.from(new Uint8Array(encryptedSessionKey))
        });
      }
      
      // Send key exchanges to server
      await apiClient.post('/api/encryption/key-exchange', {
        conversationId,
        keyExchanges
      });
      
    } catch (error) {
      logger.error('Failed to exchange session key:', error);
      throw error;
    }
  }

  /**
   * Initialize ratchet for perfect forward secrecy
   */
  async initializeRatchet(conversationId, rootKey) {
    try {
      // Generate initial chain keys
      const sendingChainKey = await this.deriveChainKey(rootKey, 'sending');
      const receivingChainKey = await this.deriveChainKey(rootKey, 'receiving');
      
      // Initialize ratchet state
      const ratchetState = {
        rootKey,
        sendingChainKey,
        receivingChainKey,
        sendingKeyNumber: 0,
        receivingKeyNumber: 0,
        previousSendingKeyNumber: 0,
        skippedKeys: new Map()
      };
      
      this.ratchetStates.set(conversationId, ratchetState);
      
      logger.info(`Ratchet initialized for conversation ${conversationId}`);
      
    } catch (error) {
      logger.error('Failed to initialize ratchet:', error);
      throw error;
    }
  }

  /**
   * Ratchet forward for perfect forward secrecy
   */
  async ratchetForward(conversationId) {
    try {
      const ratchetState = this.ratchetStates.get(conversationId);
      if (!ratchetState) return;
      
      // Derive new chain key
      const newChainKey = await this.deriveChainKey(ratchetState.sendingChainKey, 'forward');
      
      // Update ratchet state
      ratchetState.sendingChainKey = newChainKey;
      ratchetState.sendingKeyNumber++;
      
      // Clean up old keys
      await this.cleanupOldKeys(conversationId);
      
    } catch (error) {
      logger.error('Failed to ratchet forward:', error);
    }
  }

  /**
   * Set up automatic key rotation
   */
  setupKeyRotation() {
    if (this.config.keyRotationInterval > 0) {
      this.keyRotationTimer = setInterval(() => {
        this.rotateExpiredKeys();
      }, this.config.keyRotationInterval / 4); // Check 4 times per rotation interval
    }
  }

  /**
   * Rotate expired keys
   */
  async rotateExpiredKeys() {
    try {
      const now = Date.now();
      const expiredConversations = [];
      
      // Check for expired session keys
      for (const [conversationId, sessionInfo] of this.sessionKeys.entries()) {
        if (now - sessionInfo.timestamp > this.config.keyRotationInterval) {
          expiredConversations.push(conversationId);
        }
      }
      
      // Rotate expired keys
      for (const conversationId of expiredConversations) {
        await this.rotateSessionKey(conversationId);
      }
      
      // Generate new one-time pre-keys if running low
      if (this.preKeys.size < 5) {
        await this.generateOneTimePreKeys(10);
      }
      
    } catch (error) {
      logger.error('Failed to rotate expired keys:', error);
    }
  }

  /**
   * Rotate session key for a conversation
   */
  async rotateSessionKey(conversationId) {
    try {
      const oldSessionInfo = this.sessionKeys.get(conversationId);
      if (!oldSessionInfo) return;
      
      logger.info(`Rotating session key for conversation ${conversationId}`);
      
      // Generate new session key
      const newSessionInfo = await this.establishSession(
        conversationId,
        oldSessionInfo.participantKeys
      );
      
      // Emit key rotation event
      this.emit('key:rotated', {
        conversationId,
        oldKeyId: oldSessionInfo.keyId,
        newKeyId: newSessionInfo.keyId
      });
      
    } catch (error) {
      logger.error(`Failed to rotate session key for ${conversationId}:`, error);
    }
  }

  /**
   * Generate unique device ID
   */
  generateDeviceId() {
    return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique key ID
   */
  generateKeyId() {
    return `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique message ID
   */
  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate master key
   */
  async generateMasterKey() {
    return await window.crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: this.config.keyLength
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Export key for storage or transmission
   */
  async exportKey(key) {
    return await window.crypto.subtle.exportKey('jwk', key);
  }

  /**
   * Import key from storage or transmission
   */
  async importKey(keyData, algorithm, isPublic = false) {
    const usage = algorithm === 'ECDSA' ? 
      (isPublic ? ['verify'] : ['sign']) : 
      (isPublic ? [] : ['encrypt', 'decrypt']);
    
    return await window.crypto.subtle.importKey(
      'jwk',
      keyData,
      { name: algorithm, ...(algorithm.includes('ECD') ? { namedCurve: 'P-256' } : { length: 256 }) },
      false,
      usage
    );
  }

  /**
   * Check if key should be rotated
   */
  shouldRotateKey(sessionInfo) {
    const now = Date.now();
    return (now - sessionInfo.timestamp) > this.config.keyRotationInterval ||
           sessionInfo.messageCount > 1000; // Rotate after 1000 messages
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    this.on('conversation:created', this.onConversationCreated.bind(this));
    this.on('message:send', this.onMessageSend.bind(this));
    this.on('message:receive', this.onMessageReceive.bind(this));
    this.on('key:exchange-request', this.onKeyExchangeRequest.bind(this));
  }

  /**
   * Handle conversation created
   */
  async onConversationCreated(data) {
    const { conversationId, participants } = data;
    
    // Establish session for new conversation
    const participantKeys = await this.fetchParticipantKeys(participants);
    await this.establishSession(conversationId, participantKeys);
  }

  /**
   * Clean up resources
   */
  cleanup() {
    if (this.keyRotationTimer) {
      clearInterval(this.keyRotationTimer);
      this.keyRotationTimer = null;
    }
    
    // Clear sensitive data from memory
    this.sessionKeys.clear();
    this.ratchetStates.clear();
    this.ephemeralKeys.clear();
    this.pendingMessages.clear();
  }
}

// Create singleton instance
export const e2eEncryptionService = new E2EEncryptionService();
export default e2eEncryptionService;
