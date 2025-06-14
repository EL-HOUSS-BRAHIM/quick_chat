# Quick Chat Application

A secure, feature-rich chat application built with HTML, CSS, and JavaScript.

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

1. **Clone or download the project files**
   ```
   - index.html
   - styles.css
   - script.js
   - sw.js
   - README.md
   ```

2. **Open the application**
   - Simply open `index.html` in a modern web browser
   - Or serve it using a local server (recommended):
     ```bash
     # Using Python 3
     python -m http.server 8000
     
     # Using Node.js (if you have http-server installed)
     npx http-server
     
     # Using PHP
     php -S localhost:8000
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
├── styles.css          # Styling and responsive design
├── script.js           # Application logic and functionality
├── sw.js              # Service worker for offline support
└── README.md          # This documentation
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

This project is provided as-is for educational and demonstration purposes. Feel free to modify and use according to your needs.

## Support

For issues or questions, please check the browser console for error messages and ensure your browser supports all required web APIs.
