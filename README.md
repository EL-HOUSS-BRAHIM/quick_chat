# Quick Chat - Secure Messaging Platform

<div align="center">
  <img src="assets/images/icon-192.png" alt="Quick Chat Logo" width="120">
  
  **A modern, secure, and accessible real-time messaging platform**
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![PHP Version](https://img.shields.io/badge/PHP-8.0%2B-blue.svg)](https://php.net/)
  [![MySQL](https://img.shields.io/badge/MySQL-8.0%2B-orange.svg)](https://mysql.com/)
</div>

## ✨ Features

- 🔐 **End-to-End Encryption** - Secure messaging with AES-256 encryption
- ⚡ **Real-Time Communication** - Instant messaging with WebSocket support
- 🌐 **Google & Facebook SSO** - Easy authentication with social login
- ♿ **Accessibility First** - WCAG 2.1 compliant with screen reader support
- 📱 **Progressive Web App** - Works offline and can be installed on devices
- 🎨 **Modern UI** - Beautiful, responsive design with dark/light themes
- 🗂️ **File Sharing** - Share documents, images, and media securely
- 📞 **Voice & Video Calls** - WebRTC-powered audio/video communication
- 🔒 **Advanced Security** - CSRF protection, rate limiting, and suspicious activity detection
- 🌍 **SEO Optimized** - Full SEO support with Open Graph and Twitter Cards
- 🔔 **Desktop Notifications** - Push notifications for new messages
- 😊 **Emoji Support** - Rich emoji picker and reactions
- 🎤 **Audio Recording** - Voice message support
- 📊 **Audit Logging** - Comprehensive security and activity logging

## Installation

1. Set up your web server (Apache/Nginx) with PHP 7.4+
2. Create a MySQL database named 'quick_chat'
3. Import the database schema by running: `php setup.php`
4. Configure your database settings in `config/config.php`
5. Set proper permissions on the `uploads/` and `logs/` directories
6. Access the application in your web browser

## Configuration

Copy `config/config.sample.php` to `config/config.php` and update:

- Database credentials
- Encryption keys (generate secure random keys)
- Email settings for password reset
- File upload limits
- Application URL

## Security Features

- Password hashing with Argon2ID
- CSRF token protection
- Rate limiting for API endpoints
- File upload validation
- SQL injection prevention
- XSS protection with input sanitization
- Session management with secure cookies
- Audit logging for security events

## File Structure

- `index.php` - Main application file
- `config/` - Configuration files
- `classes/` - PHP classes (Database, User, Message, Security)
- `api/` - API endpoints
- `assets/` - CSS, JavaScript, and other assets
- `uploads/` - File upload directory
- `logs/` - Application logs

## Default Admin Account

- Username: admin
- Email: admin@quickchat.local
- Password: Admin123!

⚠️ **IMPORTANT**: Change the admin password immediately after first login!

## Requirements

- PHP 7.4 or higher
- MySQL 5.7 or higher
- Web server (Apache/Nginx)
- Modern web browser with JavaScript enabled

## License

This project is open source and available under the MIT License.

## Support

For support and questions, please check the documentation or create an issue.
