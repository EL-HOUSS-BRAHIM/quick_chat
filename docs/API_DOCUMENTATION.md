# Quick Chat API Documentation

## Overview

The Quick Chat API provides comprehensive endpoints for real-time messaging, file sharing, user management, and WebRTC communication. All endpoints return JSON responses and use standard HTTP status codes.

## Base URL
```
https://your-domain.com/quick_chat/api/
```

## Authentication

Most endpoints require authentication using Bearer tokens or session cookies.

### Headers
```http
Authorization: Bearer <token>
Content-Type: application/json
```

## Rate Limiting

All endpoints are rate-limited:
- **Default**: 100 requests per minute per IP
- **Auth endpoints**: 10 requests per minute per IP
- **Upload endpoints**: 20 requests per minute per user

Rate limit headers are included in responses:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

---

## Authentication Endpoints

### POST /auth.php

Handles user authentication and registration.

#### Login
```http
POST /api/auth.php
Content-Type: application/json

{
  "action": "login",
  "username": "john_doe",
  "password": "secure_password123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 123,
    "username": "john_doe",
    "email": "john@example.com",
    "display_name": "John Doe",
    "avatar": "/uploads/avatars/123.jpg",
    "last_login": "2024-01-15T10:30:00Z"
  },
  "expires_at": "2024-01-16T10:30:00Z"
}
```

**Error Response (401 Unauthorized):**
```json
{
  "success": false,
  "error": "invalid_credentials",
  "message": "Invalid username or password"
}
```

#### Register
```http
POST /api/auth.php
Content-Type: application/json

{
  "action": "register",
  "username": "new_user",
  "email": "new@example.com",
  "password": "secure_password123",
  "display_name": "New User"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "user_id": 124
}
```

#### Logout
```http
POST /api/auth.php
Authorization: Bearer <token>

{
  "action": "logout"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## Message Endpoints

### GET /messages.php

Retrieve messages with pagination and filtering.

```http
GET /api/messages.php?limit=50&offset=0&recipient=user123&since=2024-01-15T00:00:00Z
Authorization: Bearer <token>
```

**Query Parameters:**
- `limit` (optional): Number of messages to return (default: 50, max: 100)
- `offset` (optional): Number of messages to skip (default: 0)
- `recipient` (optional): Filter messages by recipient user ID
- `since` (optional): Return messages newer than this timestamp
- `search` (optional): Search messages by content

**Response (200 OK):**
```json
{
  "success": true,
  "messages": [
    {
      "id": 1001,
      "content": "Hello, how are you?",
      "sender": {
        "id": 123,
        "username": "john_doe",
        "display_name": "John Doe",
        "avatar": "/uploads/avatars/123.jpg"
      },
      "recipient": {
        "id": 124,
        "username": "jane_doe",
        "display_name": "Jane Doe"
      },
      "timestamp": "2024-01-15T10:30:00Z",
      "message_type": "text",
      "attachments": [],
      "read_status": "delivered",
      "reactions": [
        {
          "emoji": "👍",
          "users": [{"id": 124, "username": "jane_doe"}],
          "count": 1
        }
      ],
      "reply_to": null,
      "edited": false,
      "edited_at": null
    }
  ],
  "pagination": {
    "total": 1250,
    "limit": 50,
    "offset": 0,
    "has_more": true
  }
}
```

### POST /messages.php

Send a new message.

```http
POST /api/messages.php
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "Hello there!",
  "recipient": "user124",
  "message_type": "text",
  "reply_to": null,
  "attachments": ["file_id_123"]
}
```

**Request Body:**
- `content` (required): Message content
- `recipient` (required): Recipient user ID or username
- `message_type` (optional): "text", "image", "file", "audio", "video" (default: "text")
- `reply_to` (optional): Message ID this is replying to
- `attachments` (optional): Array of file IDs

**Response (201 Created):**
```json
{
  "success": true,
  "message_id": 1002,
  "timestamp": "2024-01-15T10:31:00Z",
  "delivery_status": "sent"
}
```

### PUT /messages.php

Edit an existing message.

```http
PUT /api/messages.php
Authorization: Bearer <token>
Content-Type: application/json

{
  "message_id": 1001,
  "content": "Hello there! (edited)"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Message updated successfully",
  "edited_at": "2024-01-15T10:32:00Z"
}
```

### DELETE /messages.php

Delete a message.

```http
DELETE /api/messages.php?message_id=1001
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Message deleted successfully"
}
```

---

## File Upload Endpoints

### POST /upload.php

Upload files with support for multiple file types.

```http
POST /api/upload.php
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <binary_data>
type: "avatar" | "message_attachment" | "document"
```

**Supported File Types:**
- **Images**: JPEG, PNG, GIF, WebP (max 10MB)
- **Documents**: PDF, DOC, DOCX, TXT (max 25MB)
- **Audio**: MP3, WAV, OGG (max 50MB)
- **Video**: MP4, WebM, MOV (max 100MB)

**Response (201 Created):**
```json
{
  "success": true,
  "file_id": "file_abc123",
  "file_url": "/uploads/files/2024/01/abc123.jpg",
  "thumbnail_url": "/uploads/thumbnails/abc123_thumb.jpg",
  "file_info": {
    "original_name": "vacation_photo.jpg",
    "file_type": "image/jpeg",
    "file_size": 2048576,
    "dimensions": {
      "width": 1920,
      "height": 1080
    },
    "upload_date": "2024-01-15T10:30:00Z"
  }
}
```

**Error Response (413 Payload Too Large):**
```json
{
  "success": false,
  "error": "file_too_large",
  "message": "File size exceeds maximum allowed size of 10MB",
  "max_size": 10485760
}
```

### GET /upload.php

Get file information and download URLs.

```http
GET /api/upload.php?file_id=file_abc123
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "file": {
    "id": "file_abc123",
    "url": "/uploads/files/2024/01/abc123.jpg",
    "thumbnail_url": "/uploads/thumbnails/abc123_thumb.jpg",
    "original_name": "vacation_photo.jpg",
    "file_type": "image/jpeg",
    "file_size": 2048576,
    "upload_date": "2024-01-15T10:30:00Z",
    "uploaded_by": {
      "id": 123,
      "username": "john_doe"
    }
  }
}
```

### DELETE /upload.php

Delete an uploaded file.

```http
DELETE /api/upload.php?file_id=file_abc123
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

---

## User Management Endpoints

### GET /users.php

Get user information and online status.

```http
GET /api/users.php?search=john&limit=20&online_only=true
Authorization: Bearer <token>
```

**Query Parameters:**
- `search` (optional): Search users by username or display name
- `limit` (optional): Number of users to return (default: 20, max: 100)
- `online_only` (optional): Return only online users (default: false)

**Response (200 OK):**
```json
{
  "success": true,
  "users": [
    {
      "id": 123,
      "username": "john_doe",
      "display_name": "John Doe",
      "email": "john@example.com",
      "avatar": "/uploads/avatars/123.jpg",
      "online_status": "online",
      "last_seen": "2024-01-15T10:30:00Z",
      "activity_status": "typing",
      "role": "user"
    }
  ],
  "total": 1
}
```

### PUT /users.php

Update user profile information.

```http
PUT /api/users.php
Authorization: Bearer <token>
Content-Type: application/json

{
  "display_name": "John Smith",
  "email": "john.smith@example.com",
  "bio": "Software developer and coffee enthusiast",
  "privacy_settings": {
    "show_online_status": true,
    "allow_calls": true,
    "read_receipts": true
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "user": {
    "id": 123,
    "username": "john_doe",
    "display_name": "John Smith",
    "email": "john.smith@example.com",
    "bio": "Software developer and coffee enthusiast",
    "updated_at": "2024-01-15T10:32:00Z"
  }
}
```

---

## Extended Features Endpoints

### POST /extended-features.php

Comprehensive endpoint for advanced features.

#### Update User Preferences
```http
POST /api/extended-features.php
Authorization: Bearer <token>
Content-Type: application/json

{
  "action": "update_preferences",
  "preferences": {
    "theme": "dark",
    "notifications": {
      "sound": true,
      "desktop": true,
      "email": false
    },
    "privacy": {
      "read_receipts": true,
      "typing_indicators": true,
      "online_status": true
    }
  }
}
```

#### Update Presence Status
```http
POST /api/extended-features.php
Authorization: Bearer <token>
Content-Type: application/json

{
  "action": "update_presence",
  "status": "online",
  "activity": "available",
  "custom_message": "Working on new features"
}
```

#### Send Typing Indicator
```http
POST /api/extended-features.php
Authorization: Bearer <token>
Content-Type: application/json

{
  "action": "typing_indicator",
  "recipient": "user124",
  "is_typing": true
}
```

#### Mark Messages as Read
```http
POST /api/extended-features.php
Authorization: Bearer <token>
Content-Type: application/json

{
  "action": "mark_read",
  "message_ids": [1001, 1002, 1003]
}
```

---

## Admin Endpoints

### GET /admin.php

Administrative functions (requires admin role).

#### Get System Statistics
```http
GET /api/admin.php?action=stats
Authorization: Bearer <admin_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "stats": {
    "total_users": 1250,
    "active_users_24h": 89,
    "total_messages": 50000,
    "messages_24h": 1250,
    "total_files": 2500,
    "storage_used": "15.5 GB",
    "storage_limit": "100 GB",
    "system_uptime": "15 days, 3 hours",
    "avg_response_time": "125ms"
  }
}
```

#### Get User List (Admin)
```http
GET /api/admin.php?action=users&page=1&limit=50
Authorization: Bearer <admin_token>
```

#### Moderate Content
```http
POST /api/admin.php
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "action": "moderate_message",
  "message_id": 1001,
  "action_type": "hide",
  "reason": "Inappropriate content"
}
```

#### System Configuration
```http
POST /api/admin.php
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "action": "update_config",
  "config": {
    "max_file_size": 10485760,
    "allowed_file_types": ["jpg", "png", "pdf"],
    "message_retention_days": 365,
    "rate_limit_per_minute": 100
  }
}
```

---

## WebRTC Signaling Endpoints

### GET /webrtc/turn-credentials.php

Get TURN server credentials for WebRTC connections.

```http
GET /api/webrtc/turn-credentials.php
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "credentials": {
    "username": "temp_user_123",
    "password": "temp_pass_456",
    "ttl": 3600,
    "urls": [
      "turn:turn.example.com:3478",
      "turns:turn.example.com:5349"
    ]
  },
  "ice_servers": [
    {
      "urls": ["turn:turn.example.com:3478"],
      "username": "temp_user_123",
      "credential": "temp_pass_456"
    }
  ]
}
```

---

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| 400  | Bad Request | Invalid request format or missing required fields |
| 401  | Unauthorized | Invalid or missing authentication token |
| 403  | Forbidden | Insufficient permissions for this action |
| 404  | Not Found | Requested resource does not exist |
| 413  | Payload Too Large | File or request body exceeds size limits |
| 422  | Unprocessable Entity | Validation errors in request data |
| 429  | Too Many Requests | Rate limit exceeded |
| 500  | Internal Server Error | Server-side error occurred |

### Error Response Format
```json
{
  "success": false,
  "error": "error_code",
  "message": "Human-readable error description",
  "details": {
    "field": "validation_error",
    "code": "VALIDATION_FAILED"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## Webhook Events

The API can send webhook notifications for real-time events:

### Message Events
- `message.sent` - New message sent
- `message.delivered` - Message delivered to recipient
- `message.read` - Message read by recipient
- `message.edited` - Message content edited
- `message.deleted` - Message deleted

### User Events
- `user.online` - User came online
- `user.offline` - User went offline
- `user.typing` - User started/stopped typing

### File Events
- `file.uploaded` - File successfully uploaded
- `file.processed` - File processing completed (thumbnails, etc.)

### Example Webhook Payload
```json
{
  "event": "message.sent",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "message_id": 1001,
    "sender_id": 123,
    "recipient_id": 124,
    "content": "Hello!",
    "message_type": "text"
  }
}
```

---

## SDK Examples

### JavaScript/Node.js
```javascript
const QuickChatAPI = require('@quickchat/api-client');

const client = new QuickChatAPI({
  baseUrl: 'https://your-domain.com/quick_chat/api',
  token: 'your-auth-token'
});

// Send a message
const message = await client.messages.send({
  content: 'Hello, world!',
  recipient: 'user123'
});

// Upload a file
const file = await client.files.upload(fileData, {
  type: 'message_attachment'
});
```

### PHP
```php
<?php
$client = new QuickChatAPI([
    'base_url' => 'https://your-domain.com/quick_chat/api',
    'token' => 'your-auth-token'
]);

// Get messages
$messages = $client->messages()->get([
    'limit' => 50,
    'recipient' => 'user123'
]);

// Send message
$result = $client->messages()->send([
    'content' => 'Hello from PHP!',
    'recipient' => 'user123'
]);
?>
```

---

## Changelog

### v1.2.0 (2024-01-15)
- Added message editing and deletion endpoints
- Enhanced file upload with thumbnail generation
- Added comprehensive admin endpoints
- Improved error handling and validation
- Added webhook support for real-time events

### v1.1.0 (2024-01-01)
- Added extended features endpoint
- Implemented user presence system
- Added typing indicators
- Enhanced user preferences management

### v1.0.0 (2023-12-01)
- Initial API release
- Basic messaging functionality
- User authentication and management
- File upload support
- WebRTC signaling endpoints
