/**
 * Content Moderation Manager
 * Handles content moderation tools and automated filtering
 * Implementation of TODO: Content moderation tools and interface (50% → 75%)
 */

import apiClient from '../../services/api-client.js';
import eventBus from '../../core/event-bus.js';
import { state } from '../../core/state.js';
import errorHandler from '../../core/error-handler.js';
import notificationManager from '../../ui/notification-manager.js';

class ModerationManager {
  constructor() {
    this.autoModerationEnabled = true;
    this.moderationRules = new Map();
    this.flaggedContent = new Map();
    this.moderationHistory = [];
    this.bannedWords = new Set();
    this.trustedUsers = new Set();
    this.suspiciousPatterns = new Map();
    
    // Initialize state
    state.register('moderation', {
      autoModeration: true,
      flaggedCount: 0,
      moderationQueue: [],
      bannedWordsCount: 0,
      activeFilters: [],
      moderationStats: {
        messagesReviewed: 0,
        autoBlocked: 0,
        manualActions: 0,
        falsePositives: 0
      }
    });

    this.init();
  }

  /**
   * Initialize moderation manager
   */
  async init() {
    console.log('Initializing content moderation manager...');

    try {
      // Load moderation rules and banned words
      await this.loadModerationConfig();
      
      // Set up real-time message monitoring
      this.setupMessageMonitoring();
      
      // Set up UI event handlers
      this.setupEventHandlers();
      
      // Initialize moderation dashboard
      this.createModerationUI();
      
      // Load pending moderation queue
      await this.loadModerationQueue();

      console.log('Content moderation manager initialized');
    } catch (error) {
      errorHandler.handleError(error, 'Failed to initialize moderation manager');
    }
  }

  /**
   * Load moderation configuration
   */
  async loadModerationConfig() {
    try {
      const config = await apiClient.get('/api/admin/moderation/config');
      
      // Load banned words
      this.bannedWords = new Set(config.bannedWords || []);
      
      // Load moderation rules
      config.rules?.forEach(rule => {
        this.moderationRules.set(rule.id, rule);
      });
      
      // Load trusted users
      this.trustedUsers = new Set(config.trustedUsers || []);
      
      // Update state
      state.update('moderation', {
        bannedWordsCount: this.bannedWords.size,
        activeFilters: Array.from(this.moderationRules.keys())
      });
      
    } catch (error) {
      console.error('Failed to load moderation config:', error);
    }
  }

  /**
   * Set up real-time message monitoring
   */
  setupMessageMonitoring() {
    // Listen for new messages
    eventBus.on('message-received', (messageData) => {
      if (this.autoModerationEnabled) {
        this.moderateMessage(messageData);
      }
    });

    // Listen for file uploads
    eventBus.on('file-uploaded', (fileData) => {
      if (this.autoModerationEnabled) {
        this.moderateFile(fileData);
      }
    });

    // Listen for user reports
    eventBus.on('content-reported', (reportData) => {
      this.handleContentReport(reportData);
    });
  }

  /**
   * Moderate incoming message
   */
  async moderateMessage(messageData) {
    const { message, userId, chatId } = messageData;
    
    try {
      // Skip trusted users
      if (this.trustedUsers.has(userId)) {
        return { action: 'allow', reason: 'trusted_user' };
      }

      const moderationResult = {
        messageId: messageData.id,
        userId,
        chatId,
        content: message,
        timestamp: Date.now(),
        flags: []
      };

      // Check banned words
      const bannedWordMatch = this.checkBannedWords(message);
      if (bannedWordMatch.found) {
        moderationResult.flags.push({
          type: 'banned_words',
          severity: 'high',
          matches: bannedWordMatch.words,
          action: 'block'
        });
      }

      // Check spam patterns
      const spamCheck = this.checkSpamPatterns(message, userId);
      if (spamCheck.isSpam) {
        moderationResult.flags.push({
          type: 'spam',
          severity: spamCheck.severity,
          pattern: spamCheck.pattern,
          action: spamCheck.severity === 'high' ? 'block' : 'flag'
        });
      }

      // Check for suspicious links
      const linkCheck = this.checkSuspiciousLinks(message);
      if (linkCheck.suspicious) {
        moderationResult.flags.push({
          type: 'suspicious_links',
          severity: 'medium',
          links: linkCheck.links,
          action: 'flag'
        });
      }

      // Check toxicity (placeholder for ML integration)
      const toxicityCheck = await this.checkToxicity(message);
      if (toxicityCheck.toxic) {
        moderationResult.flags.push({
          type: 'toxicity',
          severity: toxicityCheck.severity,
          confidence: toxicityCheck.confidence,
          action: toxicityCheck.severity === 'high' ? 'block' : 'flag'
        });
      }

      // Determine final action
      const finalAction = this.determineModerationAction(moderationResult.flags);
      moderationResult.action = finalAction;

      // Execute moderation action
      await this.executeModerationAction(moderationResult);

      // Update statistics
      this.updateModerationStats(moderationResult);

      return moderationResult;

    } catch (error) {
      console.error('Message moderation failed:', error);
      return { action: 'allow', error: error.message };
    }
  }

  /**
   * Check for banned words
   */
  checkBannedWords(text) {
    const lowerText = text.toLowerCase();
    const foundWords = [];
    
    for (const word of this.bannedWords) {
      if (lowerText.includes(word.toLowerCase())) {
        foundWords.push(word);
      }
    }
    
    return {
      found: foundWords.length > 0,
      words: foundWords
    };
  }

  /**
   * Check for spam patterns
   */
  checkSpamPatterns(text, userId) {
    // Check for repeated characters
    const repeatedChars = /(.)\1{4,}/g;
    if (repeatedChars.test(text)) {
      return {
        isSpam: true,
        severity: 'medium',
        pattern: 'repeated_characters'
      };
    }

    // Check for excessive caps
    const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
    if (capsRatio > 0.7 && text.length > 10) {
      return {
        isSpam: true,
        severity: 'low',
        pattern: 'excessive_caps'
      };
    }

    // Check for excessive emojis
    const emojiCount = (text.match(/[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f1e6}-\u{1f1ff}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]/gu) || []).length;
    if (emojiCount > text.length * 0.3) {
      return {
        isSpam: true,
        severity: 'low',
        pattern: 'excessive_emojis'
      };
    }

    return { isSpam: false };
  }

  /**
   * Check for suspicious links
   */
  checkSuspiciousLinks(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const links = text.match(urlRegex) || [];
    const suspiciousLinks = [];
    
    // Simple suspicious domain check (expand as needed)
    const suspiciousDomains = [
      'bit.ly',
      'tinyurl.com',
      'goo.gl',
      't.co'
    ];
    
    links.forEach(link => {
      const domain = new URL(link).hostname;
      if (suspiciousDomains.some(suspicious => domain.includes(suspicious))) {
        suspiciousLinks.push(link);
      }
    });
    
    return {
      suspicious: suspiciousLinks.length > 0,
      links: suspiciousLinks
    };
  }

  /**
   * Check toxicity using ML (placeholder)
   */
  async checkToxicity(text) {
    // Placeholder for toxicity detection
    // In production, integrate with services like Perspective API
    try {
      // Mock implementation
      const toxicWords = ['hate', 'toxic', 'abuse'];
      const lowerText = text.toLowerCase();
      
      for (const word of toxicWords) {
        if (lowerText.includes(word)) {
          return {
            toxic: true,
            severity: 'medium',
            confidence: 0.8
          };
        }
      }
      
      return { toxic: false };
    } catch (error) {
      console.error('Toxicity check failed:', error);
      return { toxic: false };
    }
  }

  /**
   * Determine final moderation action
   */
  determineModerationAction(flags) {
    if (flags.length === 0) return 'allow';
    
    const hasHighSeverity = flags.some(flag => flag.severity === 'high');
    const hasBlockAction = flags.some(flag => flag.action === 'block');
    
    if (hasHighSeverity || hasBlockAction) {
      return 'block';
    }
    
    const hasMediumSeverity = flags.some(flag => flag.severity === 'medium');
    if (hasMediumSeverity || flags.length >= 2) {
      return 'flag';
    }
    
    return 'warn';
  }

  /**
   * Execute moderation action
   */
  async executeModerationAction(moderationResult) {
    const { action, messageId, userId, chatId } = moderationResult;
    
    try {
      switch (action) {
        case 'block':
          await apiClient.post('/api/admin/moderation/block-message', {
            messageId,
            reason: 'auto_moderation',
            flags: moderationResult.flags
          });
          
          // Notify user
          await this.notifyUser(userId, 'message_blocked', moderationResult);
          break;
          
        case 'flag':
          // Add to moderation queue
          await this.addToModerationQueue(moderationResult);
          
          // Notify moderators
          await this.notifyModerators('content_flagged', moderationResult);
          break;
          
        case 'warn':
          // Send warning to user
          await this.notifyUser(userId, 'content_warning', moderationResult);
          break;
          
        case 'allow':
        default:
          // No action needed
          break;
      }
    } catch (error) {
      console.error('Failed to execute moderation action:', error);
    }
  }

  /**
   * Create moderation UI
   */
  createModerationUI() {
    const moderationPanel = document.querySelector('#moderation-panel');
    if (!moderationPanel) return;

    moderationPanel.innerHTML = `
      <div class="moderation-dashboard">
        <div class="moderation-header">
          <h3>Content Moderation</h3>
          <div class="moderation-toggle">
            <label class="switch">
              <input type="checkbox" id="auto-moderation-toggle" ${this.autoModerationEnabled ? 'checked' : ''}>
              <span class="slider round"></span>
            </label>
            <span>Auto Moderation</span>
          </div>
        </div>
        
        <div class="moderation-stats">
          <div class="stat-card">
            <h4>Flagged Content</h4>
            <span class="stat-number" id="flagged-count">0</span>
          </div>
          <div class="stat-card">
            <h4>Auto Blocked</h4>
            <span class="stat-number" id="auto-blocked-count">0</span>
          </div>
          <div class="stat-card">
            <h4>Manual Actions</h4>
            <span class="stat-number" id="manual-actions-count">0</span>
          </div>
        </div>
        
        <div class="moderation-queue">
          <h4>Moderation Queue</h4>
          <div class="queue-list" id="moderation-queue-list">
            <!-- Queue items will be populated here -->
          </div>
        </div>
        
        <div class="moderation-rules">
          <h4>Moderation Rules</h4>
          <div class="rules-list" id="moderation-rules-list">
            <!-- Rules will be populated here -->
          </div>
          <button class="btn btn-primary" id="add-rule-btn">Add Rule</button>
        </div>
      </div>
    `;

    this.bindUIEvents();
  }

  /**
   * Set up UI event handlers
   */
  setupEventHandlers() {
    // Auto-moderation toggle
    document.addEventListener('change', (event) => {
      if (event.target.id === 'auto-moderation-toggle') {
        this.autoModerationEnabled = event.target.checked;
        this.saveConfig();
      }
    });

    // Queue item actions
    document.addEventListener('click', (event) => {
      if (event.target.matches('.approve-btn')) {
        const itemId = event.target.dataset.itemId;
        this.approveContent(itemId);
      } else if (event.target.matches('.reject-btn')) {
        const itemId = event.target.dataset.itemId;
        this.rejectContent(itemId);
      } else if (event.target.matches('.add-rule-btn')) {
        this.showAddRuleModal();
      }
    });
  }

  /**
   * Load moderation queue
   */
  async loadModerationQueue() {
    try {
      const queue = await apiClient.get('/api/admin/moderation/queue');
      this.updateQueueUI(queue);
      
      state.update('moderation', {
        moderationQueue: queue,
        flaggedCount: queue.length
      });
    } catch (error) {
      console.error('Failed to load moderation queue:', error);
    }
  }

  /**
   * Update moderation statistics
   */
  updateModerationStats(result) {
    const currentStats = state.get('moderation.moderationStats') || {};
    
    currentStats.messagesReviewed = (currentStats.messagesReviewed || 0) + 1;
    
    if (result.action === 'block') {
      currentStats.autoBlocked = (currentStats.autoBlocked || 0) + 1;
    }
    
    state.update('moderation', { moderationStats: currentStats });
    
    // Update UI
    this.updateStatsUI(currentStats);
  }

  /**
   * Update stats UI
   */
  updateStatsUI(stats) {
    const elements = {
      flaggedCount: document.getElementById('flagged-count'),
      autoBlockedCount: document.getElementById('auto-blocked-count'),
      manualActionsCount: document.getElementById('manual-actions-count')
    };

    if (elements.flaggedCount) {
      elements.flaggedCount.textContent = stats.flaggedCount || 0;
    }
    if (elements.autoBlockedCount) {
      elements.autoBlockedCount.textContent = stats.autoBlocked || 0;
    }
    if (elements.manualActionsCount) {
      elements.manualActionsCount.textContent = stats.manualActions || 0;
    }
  }
}

export default ModerationManager;
