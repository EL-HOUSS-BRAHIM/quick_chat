# Quick Chat Application

A secure, feature-rich chat application built with HTML, CSS, JavaScript, and PHP.

**Author:** BRAHIM EL HOUSS  
**Repository:** [https://github.com/EL-HOUSS-BRAHIM/quick_chat](https://github.com/EL-HOUSS-BRAHIM/quick_chat)

## Features

### 🔐 Security Features
- User authentication with login/register system
- Input sanitization to prevent XSS attacks
- Password hashing for secure storage
- Form validation and error handling
- Local storage encryption considerations

### 💬 Chat Features
- Real-time messaging interface
- Send text messages
- Upload and share images (max 5MB)
- Record and send audio messages
- Clear chat history
- Auto-resizing message input
- Message timestamps
- Responsive design for mobile and desktop

### 🎨 UI/UX Features
- Modern, clean interface
- Smooth animations and transitions
- Online/away status indicators
- Dark theme compatible
- Mobile-responsive design
- Offline functionality with service worker

## Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/EL-HOUSS-BRAHIM/quick_chat.git
   cd quick_chat
   ```

2. **Server Setup (PHP Backend)**
   - Ensure you have PHP 7.4+ installed
   - Set up a web server (Apache/Nginx) or use PHP's built-in server:
     ```bash
     php -S localhost:8000
     ```
   - Configure your database settings in the `.env` file
   - Run the setup script to initialize the database:
     ```bash
     php setup.php
     ```

3. **Alternative Setup (Client-side only)**
   - For basic functionality without the PHP backend:
   - Simply open `index.html` in a modern web browser
   - Or serve it using a local server:
     ```bash
     # Using Python 3
     python -m http.server 8000
     
     # Using Node.js (if you have http-server installed)
     npx http-server
     ```

3. **Access the application**
   - Navigate to `http://localhost:8000` in your browser
   - Create a new account or login with existing credentials

## Usage

### First Time Setup
1. Open the application in your browser
2. Click "Create one" to register a new account
3. Fill in your username, email, and password
4. Click "Create Account" to register
5. You'll be automatically logged in and redirected to the chat

### Sending Messages
- **Text Messages**: Type in the input field and press Enter or click the send button
- **Images**: Click the paperclip icon to select and upload an image
- **Audio**: Click the microphone icon to start recording, click again to stop and send

### Additional Features
- **Clear Chat**: Click the trash icon in the header to clear all messages
- **Logout**: Click the logout icon in the header to sign out

## Security Considerations

### Client-Side Security
- Input sanitization prevents XSS attacks
- Password hashing (basic implementation for demo)
- File type and size validation for uploads
- Form validation with proper error handling

### Production Security Recommendations
For production use, consider implementing:
- Server-side authentication with JWT tokens
- Proper password hashing (bcrypt, scrypt, or Argon2)
- HTTPS/SSL encryption
- Rate limiting for API calls
- Content Security Policy (CSP) headers
- Database storage instead of localStorage
- Server-side file validation and storage
- User session management
- CSRF protection

## Browser Compatibility

- **Modern Browsers**: Chrome 60+, Firefox 55+, Safari 11+, Edge 79+
- **Features Required**:
  - ES6+ JavaScript support
  - Web Audio API (for recording)
  - FileReader API (for image uploads)
  - LocalStorage API
  - Service Worker API (optional, for offline functionality)

## File Structure

```
quick_chat/
├── index.html          # Main HTML structure
├── index.php           # PHP entry point
├── styles.css          # Styling and responsive design
├── script.js           # Application logic and functionality
├── sw.js              # Service worker for offline support
├── setup.php           # Database setup script
├── test_config.php     # Configuration testing
├── .env               # Environment configuration
├── .gitignore         # Git ignore rules
├── LICENSE            # MIT License
├── README.md          # This documentation
├── api/               # API endpoints
│   ├── auth.php       # Authentication API
│   ├── avatar.php     # Avatar management
│   └── messages.php   # Message handling
├── assets/            # Frontend assets
│   ├── css/
│   └── js/
├── classes/           # PHP classes
│   ├── Database.php   # Database connection
│   ├── Env.php        # Environment loader
│   ├── Message.php    # Message model
│   ├── Security.php   # Security utilities
│   └── User.php       # User model
└── config/            # Configuration files
    └── config.php     # Main configuration
```

## Technical Details

### Data Storage
- User accounts stored in localStorage (`chatUsers`)
- Chat messages stored in localStorage (`chatMessages`)
- Current session stored in localStorage (`currentUser`)

### Media Handling
- Images: Base64 encoded and stored locally
- Audio: WebM format with MediaRecorder API
- File size limits: 5MB for images

### Offline Support
- Service worker caches static assets
- Application works offline for cached content
- Messages persist across browser sessions

## Customization

### Styling
- Modify `styles.css` to change colors, fonts, or layout
- CSS custom properties used for easy theming
- Responsive breakpoints: 768px and 480px

### Functionality
- Extend the `QuickChat` class in `script.js`
- Add new message types or features
- Modify security settings in `ChatSecurity` class

## Limitations

- Single-user application (no real-time multi-user chat)
- Client-side only (no server backend)
- Data stored locally (not synchronized across devices)
- Basic security implementation (suitable for demo/local use)

## Future Enhancements

- Real-time multi-user chat with WebSocket
- Server-side backend with proper authentication
- Message encryption for enhanced security
- File sharing beyond images
- User profiles and avatars
- Chat rooms and group messaging
- Push notifications
- Message search functionality

## License


This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

Copyright (c) 2025 BRAHIM EL HOUSS

## Contributing

**Please fork this repository before making contributions!** This helps maintain the project's integrity and gives you credit for your work.

### Preferred Workflow:
1. **Fork** the repository to your GitHub account
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/quick_chat.git
   ```
3. **Create** your feature branch:
   ```bash
   git checkout -b feature/AmazingFeature
   ```
4. **Make** your changes and commit:
   ```bash
   git commit -m 'Add some AmazingFeature'
   ```
5. **Push** to your fork:
   ```bash
   git push origin feature/AmazingFeature
   ```
6. **Open** a Pull Request from your fork to the main repository

### Why Fork First?
- ✅ You get credit for your contributions
- ✅ Keeps the main repository clean
- ✅ Allows for proper code review
- ✅ Maintains project history and attribution
- ✅ Enables collaborative development

### Direct Downloads
While the MIT License allows direct downloads and modifications, we encourage:
- ⭐ **Star** the repository if you find it useful
- 🍴 **Fork** it if you plan to modify or contribute
- 📝 **Open issues** for bugs or feature requests
- 💬 **Join discussions** for questions or ideas

## Support

For issues or questions:
- Open an issue on [GitHub](https://github.com/EL-HOUSS-BRAHIM/quick_chat/issues)
- Check the browser console for error messages
- Ensure your browser supports all required web APIs
