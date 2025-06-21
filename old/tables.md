# Database Tables Documentation

This document outlines all database tables used in the Quick Chat application, including their structure, data types, and relationships.

## Core Tables

### 1. users
**Purpose:** Store user account information and authentication data

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | Unique user identifier |
| username | VARCHAR(50) | NOT NULL, UNIQUE | User's login name |
| email | VARCHAR(255) | NOT NULL, UNIQUE | User's email address |
| password_hash | VARCHAR(255) | NOT NULL | Argon2ID hashed password |
| display_name | VARCHAR(100) | NOT NULL | User's display name |
| avatar | VARCHAR(255) | NULL | Path to user's avatar image |
| email_verified | BOOLEAN | DEFAULT FALSE | Email verification status |
| verification_token | VARCHAR(64) | NULL | Email verification token |
| is_active | BOOLEAN | DEFAULT TRUE | Account active status |
| is_online | BOOLEAN | DEFAULT FALSE | Current online status |
| last_seen | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last activity timestamp |
| locked_until | TIMESTAMP | NULL | Account lock expiration |
| failed_login_attempts | INT | DEFAULT 0 | Failed login counter |
| last_failed_login | TIMESTAMP | NULL | Last failed login attempt |
| reset_token | VARCHAR(64) | NULL | Password reset token |
| reset_token_expires | TIMESTAMP | NULL | Reset token expiration |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Account creation date |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | Last update |

**Indexes:**
- PRIMARY KEY (id)
- UNIQUE KEY (username)
- UNIQUE KEY (email)
- INDEX (is_online)
- INDEX (last_seen)

---

### 2. messages
**Purpose:** Store all chat messages including text, files, and metadata

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | Message unique identifier |
| user_id | INT | NOT NULL, FOREIGN KEY | Message sender (references users.id) |
| content | TEXT | NULL | Message content (encrypted if sensitive) |
| message_type | ENUM | NOT NULL | 'text', 'image', 'video', 'audio', 'file' |
| file_path | VARCHAR(500) | NULL | Path to uploaded file |
| file_size | INT | NULL | File size in bytes |
| file_type | VARCHAR(100) | NULL | MIME type of file |
| is_encrypted | BOOLEAN | DEFAULT FALSE | Whether content is encrypted |
| reply_to_id | INT | NULL, FOREIGN KEY | Referenced message ID (references messages.id) |
| group_id | INT | NULL, FOREIGN KEY | Group chat ID (references groups.id) |
| recipient_id | INT | NULL, FOREIGN KEY | Direct message recipient (references users.id) |
| edited_at | TIMESTAMP | NULL | Last edit timestamp |
| deleted_at | TIMESTAMP | NULL | Soft deletion timestamp |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Message creation time |

**Indexes:**
- PRIMARY KEY (id)
- FOREIGN KEY (user_id) REFERENCES users(id)
- FOREIGN KEY (reply_to_id) REFERENCES messages(id)
- FOREIGN KEY (group_id) REFERENCES groups(id)
- FOREIGN KEY (recipient_id) REFERENCES users(id)
- INDEX (created_at)
- INDEX (message_type)
- INDEX (deleted_at)

---

### 3. groups
**Purpose:** Store group chat information and settings

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | Group unique identifier |
| name | VARCHAR(100) | NOT NULL | Group name |
| description | TEXT | NULL | Group description |
| avatar | VARCHAR(255) | NULL | Path to group avatar image |
| is_public | BOOLEAN | DEFAULT FALSE | Whether group is publicly joinable |
| max_members | INT | DEFAULT 100 | Maximum member limit |
| created_by | INT | NOT NULL, FOREIGN KEY | Group creator (references users.id) |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Group creation time |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | Last update |

**Indexes:**
- PRIMARY KEY (id)
- FOREIGN KEY (created_by) REFERENCES users(id)
- INDEX (is_public)
- INDEX (created_at)

---

### 4. group_members
**Purpose:** Track group membership and roles

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | Membership record ID |
| group_id | INT | NOT NULL, FOREIGN KEY | Group ID (references groups.id) |
| user_id | INT | NOT NULL, FOREIGN KEY | User ID (references users.id) |
| role | ENUM | DEFAULT 'member' | 'admin', 'moderator', 'member' |
| is_banned | BOOLEAN | DEFAULT FALSE | Whether user is banned from group |
| banned_until | TIMESTAMP | NULL | Ban expiration time |
| joined_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Join timestamp |
| left_at | TIMESTAMP | NULL | Leave timestamp |

**Indexes:**
- PRIMARY KEY (id)
- FOREIGN KEY (group_id) REFERENCES groups(id)
- FOREIGN KEY (user_id) REFERENCES users(id)
- UNIQUE KEY (group_id, user_id)
- INDEX (role)

---

### 5. sessions
**Purpose:** Track user sessions and authentication

This table has been replaced by the `user_sessions` table to avoid redundancy.

---

### 6. message_reactions
**Purpose:** Store emoji reactions to messages

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | Reaction ID |
| message_id | INT | NOT NULL, FOREIGN KEY | Message ID (references messages.id) |
| user_id | INT | NOT NULL, FOREIGN KEY | User ID (references users.id) |
| emoji | VARCHAR(10) | NOT NULL | Emoji character(s) |
| group_id | INT | NULL, FOREIGN KEY | Group ID if in a group chat |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Reaction timestamp |

**Indexes:**
- PRIMARY KEY (id)
- FOREIGN KEY (message_id) REFERENCES messages(id)
- FOREIGN KEY (user_id) REFERENCES users(id)
- UNIQUE KEY (message_id, user_id, emoji)

---

### 7. user_settings
**Purpose:** Store user preferences and configuration

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | Setting record ID |
| user_id | INT | NOT NULL, FOREIGN KEY | User ID (references users.id) |
| setting_key | VARCHAR(50) | NOT NULL | Setting identifier |
| setting_value | TEXT | NULL | Setting value (JSON or string) |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Setting creation time |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | Last update |

**Indexes:**
- PRIMARY KEY (id)
- FOREIGN KEY (user_id) REFERENCES users(id)
- UNIQUE KEY (user_id, setting_key)

---

### 8. user_sessions
**Purpose:** Track active user sessions for authentication and security

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | Session record ID |
| session_id | VARCHAR(128) | NOT NULL, UNIQUE | Unique session identifier |
| user_id | INT | NOT NULL, FOREIGN KEY | User ID (references users.id) |
| login_type | ENUM('password', 'remember_me', 'oauth') | DEFAULT 'password' | Type of login |
| expires_at | TIMESTAMP | NOT NULL | Session expiration time |
| ip_address | VARCHAR(45) | NOT NULL | User's IP address |
| user_agent | TEXT | NULL | User's browser/client info |
| is_active | BOOLEAN | DEFAULT TRUE | Whether session is active |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Session creation time |
| last_activity | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | Last activity time |

**Indexes:**
- PRIMARY KEY (id)
- FOREIGN KEY (user_id) REFERENCES users(id)
- UNIQUE KEY (session_id)
- INDEX (expires_at)
- INDEX (last_activity)
- INDEX (is_active)

---

## Security & Audit Tables

### 9. rate_limits
**Purpose:** Track API rate limiting by user/action

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | Rate limit record ID |
| identifier | VARCHAR(255) | NOT NULL | IP address or user ID |
| action_type | VARCHAR(50) | NOT NULL | Action being rate limited |
| attempts | INT | DEFAULT 1 | Number of attempts in window |
| window_start | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Rate limit window start |

**Indexes:**
- PRIMARY KEY (id)
- UNIQUE KEY (identifier, action_type)
- INDEX (window_start)

---

### 10. audit_logs
**Purpose:** Security and user activity logging

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | Log entry ID |
| user_id | INT | NULL, FOREIGN KEY | User ID if applicable (references users.id) |
| event_type | VARCHAR(50) | NOT NULL | Type of event logged |
| event_data | JSON | NULL | Additional event details |
| ip_address | VARCHAR(45) | NOT NULL | Client IP address |
| user_agent | TEXT | NULL | Client user agent |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Event timestamp |

**Indexes:**
- PRIMARY KEY (id)
- FOREIGN KEY (user_id) REFERENCES users(id)
- INDEX (event_type)
- INDEX (created_at)
- INDEX (ip_address)

---

### 11. notifications
**Purpose:** Store user notifications and alerts

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | Notification ID |
| user_id | INT | NOT NULL, FOREIGN KEY | Recipient user ID (references users.id) |
| type | VARCHAR(50) | NOT NULL | Notification type |
| title | VARCHAR(255) | NOT NULL | Notification title |
| message | TEXT | NOT NULL | Notification content |
| data | JSON | NULL | Additional notification data |
| is_read | BOOLEAN | DEFAULT FALSE | Read status |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| read_at | TIMESTAMP | NULL | Read timestamp |

**Indexes:**
- PRIMARY KEY (id)
- FOREIGN KEY (user_id) REFERENCES users(id)
- INDEX (is_read)
- INDEX (created_at)

---

### 12. file_uploads
**Purpose:** Track uploaded files and metadata

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | Upload record ID |
| user_id | INT | NOT NULL, FOREIGN KEY | Uploader user ID (references users.id) |
| original_filename | VARCHAR(255) | NOT NULL | Original file name |
| stored_filename | VARCHAR(255) | NOT NULL | Stored file name |
| file_path | VARCHAR(500) | NOT NULL | Full file path |
| file_size | INT | NOT NULL | File size in bytes |
| mime_type | VARCHAR(100) | NOT NULL | File MIME type |
| file_hash | VARCHAR(64) | NOT NULL | SHA-256 hash of file |
| upload_type | VARCHAR(50) | NOT NULL | 'avatar', 'message', 'group_avatar' |
| is_deleted | BOOLEAN | DEFAULT FALSE | Deletion status |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Upload timestamp |

**Indexes:**
- PRIMARY KEY (id)
- FOREIGN KEY (user_id) REFERENCES users(id)
- INDEX (file_hash)
- INDEX (upload_type)
- INDEX (is_deleted)

---

## Extended Features Tables

### 13. group_invites
**Purpose:** Track group invitation links and codes

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | Invite ID |
| group_id | INT | NOT NULL, FOREIGN KEY | Group ID (references groups.id) |
| created_by | INT | NOT NULL, FOREIGN KEY | Creator user ID (references users.id) |
| invite_code | VARCHAR(32) | NOT NULL, UNIQUE | Unique invite code |
| max_uses | INT | NULL | Maximum number of uses |
| current_uses | INT | DEFAULT 0 | Current usage count |
| expires_at | TIMESTAMP | NULL | Expiration time |
| is_active | BOOLEAN | DEFAULT TRUE | Active status |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |

**Indexes:**
- PRIMARY KEY (id)
- FOREIGN KEY (group_id) REFERENCES groups(id)
- FOREIGN KEY (created_by) REFERENCES users(id)
- UNIQUE KEY (invite_code)

---

### 14. message_read_receipts
**Purpose:** Track message read status in groups

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | Receipt ID |
| message_id | INT | NOT NULL, FOREIGN KEY | Message ID (references messages.id) |
| user_id | INT | NOT NULL, FOREIGN KEY | Reader user ID (references users.id) |
| read_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Read timestamp |

**Indexes:**
- PRIMARY KEY (id)
- FOREIGN KEY (message_id) REFERENCES messages(id)
- FOREIGN KEY (user_id) REFERENCES users(id)
- UNIQUE KEY (message_id, user_id)

---

## Database Configuration

### Storage Engine
- **Engine:** InnoDB (for foreign key support and transactions)
- **Character Set:** utf8mb4 (for full Unicode support including emojis)
- **Collation:** utf8mb4_unicode_ci

### Key Constraints
- All foreign key constraints are enforced with CASCADE DELETE where appropriate
- Unique constraints prevent duplicate entries
- Index optimization for frequently queried columns

### Data Retention
- **Messages:** Soft deletion with cleanup after 90 days
- **Sessions:** Auto-cleanup of expired sessions
- **Rate Limits:** Auto-cleanup after 1 hour
- **Audit Logs:** Retention for 90 days
- **Notifications:** User-configurable retention

### Security Features
- Encrypted sensitive data in messages table
- Password hashing with Argon2ID
- IP address tracking for security events
- Session management with expiration
- Rate limiting per user/action type

---

## Migration Notes

When creating these tables:

1. **Foreign Key Constraints:** Enable foreign key checks
2. **Character Encoding:** Use utf8mb4 for all tables
3. **Indexes:** Create all listed indexes for performance
4. **Default Values:** Set appropriate defaults for timestamps and booleans
5. **Auto-increment:** Start all auto-increment fields at 1

### Sample Creation Order
1. users
2. groups
3. user_settings
4. user_sessions
5. messages
6. group_members
7. message_reactions
8. message_read_receipts
9. file_uploads
10. notifications
11. group_invites
12. rate_limits
13. audit_logs
