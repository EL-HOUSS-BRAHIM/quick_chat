# Quick Chat - Enhanced PHP Version

## Features

- 🔐 Secure user authentication with password hashing
- 💬 Real-time messaging (polling-based)
- 📁 File upload support (images, videos, audio, documents)
- 🎤 Audio recording capability
- 😊 Emoji support
- 🔍 Message search
- 📱 Responsive design
- 🌙 Dark/Light theme support
- 🔔 Desktop notifications
- 🛡️ CSRF protection
- 📊 Rate limiting
- 🔍 SQL injection prevention
- 🎯 XSS protection
- 📝 Audit logging

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
