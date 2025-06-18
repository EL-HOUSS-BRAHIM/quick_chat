/**
 * Message Renderer
 * Handles rendering of different message types
 */

import utils from '../../core/utils.js';

class MessageRenderer {
  constructor() {
    // Supported message types
    this.supportedTypes = ['text', 'image', 'video', 'audio', 'file'];
    
    // Custom renderers for special content
    this.contentRenderers = {
      urls: this.renderUrls,
      emoji: this.renderEmoji,
      mentions: this.renderMentions,
      markdown: this.renderMarkdown
    };
  }

  /**
   * Render a message based on its type
   * @param {Object} message - Message to render
   * @returns {string} HTML content
   */
  renderMessage(message) {
    // Validate message type
    if (!this.supportedTypes.includes(message.type)) {
      console.warn(`Unsupported message type: ${message.type}`);
      return this.renderUnsupported(message);
    }
    
    // Render based on type
    switch (message.type) {
      case 'text':
        return this.renderTextMessage(message);
      case 'image':
        return this.renderImageMessage(message);
      case 'video':
        return this.renderVideoMessage(message);
      case 'audio':
        return this.renderAudioMessage(message);
      case 'file':
        return this.renderFileMessage(message);
      default:
        return this.renderUnsupported(message);
    }
  }

  /**
   * Render a text message
   * @param {Object} message - Message to render
   * @returns {string} HTML content
   */
  renderTextMessage(message) {
    let content = utils.escapeHtml(message.content);
    
    // Apply content renderers
    content = this.contentRenderers.urls(content);
    content = this.contentRenderers.emoji(content);
    content = this.contentRenderers.mentions(content);
    content = this.contentRenderers.markdown(content);
    
    // Replace newlines with <br>
    content = content.replace(/\n/g, '<br>');
    
    return `<div class="message-text">${content}</div>`;
  }

  /**
   * Render an image message
   * @param {Object} message - Message to render
   * @returns {string} HTML content
   */
  renderImageMessage(message) {
    return `
      <div class="message-image">
        <img src="${utils.escapeHtml(message.content)}" alt="Image" loading="lazy" 
             onclick="this.classList.toggle('expanded')">
        ${message.caption ? `<div class="media-caption">${utils.escapeHtml(message.caption)}</div>` : ''}
      </div>
    `;
  }

  /**
   * Render a video message
   * @param {Object} message - Message to render
   * @returns {string} HTML content
   */
  renderVideoMessage(message) {
    return `
      <div class="message-video">
        <video controls src="${utils.escapeHtml(message.content)}" preload="metadata"></video>
        ${message.caption ? `<div class="media-caption">${utils.escapeHtml(message.caption)}</div>` : ''}
      </div>
    `;
  }

  /**
   * Render an audio message
   * @param {Object} message - Message to render
   * @returns {string} HTML content
   */
  renderAudioMessage(message) {
    return `
      <div class="message-audio">
        <audio controls src="${utils.escapeHtml(message.content)}" preload="metadata"></audio>
        ${message.caption ? `<div class="media-caption">${utils.escapeHtml(message.caption)}</div>` : ''}
      </div>
    `;
  }

  /**
   * Render a file message
   * @param {Object} message - Message to render
   * @returns {string} HTML content
   */
  renderFileMessage(message) {
    // Get file extension for icon
    const extension = utils.getFileExtension(message.filename || '');
    
    return `
      <div class="message-file">
        <div class="file-icon" data-extension="${extension || 'file'}">📎</div>
        <div class="file-info">
          <div class="file-name">${message.filename || 'File'}</div>
          <div class="file-size">${message.filesize ? utils.formatFileSize(message.filesize) : ''}</div>
        </div>
        <a href="${utils.escapeHtml(message.content)}" target="_blank" class="file-download" 
           download="${message.filename || ''}">Download</a>
      </div>
    `;
  }

  /**
   * Render an unsupported message type
   * @param {Object} message - Message to render
   * @returns {string} HTML content
   */
  renderUnsupported(message) {
    return `
      <div class="message-unsupported">
        <div class="unsupported-icon">⚠️</div>
        <div class="unsupported-text">
          Unsupported message type: ${message.type}
        </div>
      </div>
    `;
  }

  /**
   * Render URLs as clickable links
   * @param {string} content - Message content
   * @returns {string} Rendered content
   */
  renderUrls(content) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return content.replace(urlRegex, url => {
      const escapedUrl = utils.escapeHtml(url);
      return `<a href="${escapedUrl}" target="_blank" rel="noopener noreferrer">${escapedUrl}</a>`;
    });
  }

  /**
   * Render emoji
   * @param {string} content - Message content
   * @returns {string} Rendered content
   */
  renderEmoji(content) {
    // Simple emoji rendering - in a real app, use a library
    return content;
  }

  /**
   * Render @mentions
   * @param {string} content - Message content
   * @returns {string} Rendered content
   */
  renderMentions(content) {
    const mentionRegex = /@([a-zA-Z0-9_]+)/g;
    return content.replace(mentionRegex, (match, username) => {
      return `<span class="user-mention">@${username}</span>`;
    });
  }

  /**
   * Render simple markdown
   * @param {string} content - Message content
   * @returns {string} Rendered content
   */
  renderMarkdown(content) {
    // Bold
    content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Italic
    content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Strikethrough
    content = content.replace(/~~(.*?)~~/g, '<del>$1</del>');
    
    // Code
    content = content.replace(/`(.*?)`/g, '<code>$1</code>');
    
    return content;
  }
}

export default MessageRenderer;
