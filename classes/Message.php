<?php
require_once __DIR__ . '/Database.php';
require_once __DIR__ . '/Security.php';

class Message {
    private $db;
    private $security;
    
    public function __construct($db = null, $security = null) {
        $this->db = $db ?? Database::getInstance();
        $this->security = $security ?? new Security();
    }
    
    public function sendMessage($userId, $content, $messageType = 'text', $filePath = null, $replyToId = null, $groupId = null) {
        // Validate user
        if (!$this->validateUser($userId)) {
            throw new Exception("Invalid user");
        }
        
        // Validate group if specified
        if ($groupId && !$this->validateGroupMembership($userId, $groupId)) {
            throw new Exception("User is not a member of this group or has been banned");
        }
        
        // Rate limiting
        $this->security->rateLimitCheck($userId, 'send_message', Config::getMaxMessagesPerMinute(), 60);
        
        // Validate content based on type
        switch ($messageType) {
            case 'text':
                if (empty(trim($content))) {
                    throw new Exception("Message cannot be empty");
                }
                if (strlen($content) > 2000) {
                    throw new Exception("Message too long");
                }
                $content = $this->security->sanitizeInput($content);
                break;
                
            case 'image':
            case 'video':
            case 'audio':
            case 'file':
                if (!$filePath || !file_exists($filePath)) {
                    throw new Exception("File not found");
                }
                break;
                
            default:
                throw new Exception("Invalid message type");
        }
        
        // Validate reply reference
        if ($replyToId && !$this->messageExists($replyToId)) {
            throw new Exception("Reply message not found");
        }
        
        try {
            $this->db->beginTransaction();
            
            // Encrypt sensitive content if needed
            $isEncrypted = false;
            if ($messageType === 'text' && $this->shouldEncryptMessage($content)) {
                $content = $this->security->encryptData($content);
                $isEncrypted = true;
            }
            
            // Get file info if applicable
            $fileSize = null;
            $fileType = null;
            if ($filePath) {
                $fileSize = filesize($filePath);
                $finfo = finfo_open(FILEINFO_MIME_TYPE);
                $fileType = finfo_file($finfo, $filePath);
                finfo_close($finfo);
            }
            
            // Insert message
            $sql = "INSERT INTO messages (user_id, content, message_type, file_path, file_size, file_type, is_encrypted, reply_to_id, group_id) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
            
            $this->db->query($sql, [
                $userId,
                $content,
                $messageType,
                $filePath,
                $fileSize,
                $fileType,
                $isEncrypted ? 1 : 0, // Convert boolean to integer (1 or 0)
                $replyToId,
                $groupId
            ]);
            
            $messageId = $this->db->lastInsertId();
            
            // Log message send
            $this->logMessageEvent($userId, 'message_sent', [
                'message_id' => $messageId,
                'message_type' => $messageType,
                'encrypted' => $isEncrypted
            ]);
            
            $this->db->commit();
            
            // Return message data for real-time broadcasting
            return $this->getMessageById($messageId);
            
        } catch (Exception $e) {
            $this->db->rollback();
            throw $e;
        }
    }
    
    public function getMessages($limit = 50, $offset = 0, $beforeId = null) {
        $sql = "SELECT m.*, u.username, u.display_name, u.avatar,
                       rm.content as reply_content, ru.username as reply_username
                FROM messages m
                JOIN users u ON m.user_id = u.id
                LEFT JOIN messages rm ON m.reply_to_id = rm.id
                LEFT JOIN users ru ON rm.user_id = ru.id
                WHERE m.deleted_at IS NULL";
        
        $params = [];
        
        if ($beforeId) {
            $sql .= " AND m.id < ?";
            $params[] = $beforeId;
        }
        
        $sql .= " ORDER BY m.created_at DESC LIMIT ? OFFSET ?";
        $params[] = $limit;
        $params[] = $offset;
        
        $messages = $this->db->fetchAll($sql, $params);
        
        // Decrypt messages if needed and process
        foreach ($messages as &$message) {
            $message = $this->processMessage($message);
        }
        
        return array_reverse($messages); // Return in chronological order
    }
    
    public function getMessageById($messageId) {
        $sql = "SELECT m.*, u.username, u.display_name, u.avatar,
                       rm.content as reply_content, ru.username as reply_username
                FROM messages m
                JOIN users u ON m.user_id = u.id
                LEFT JOIN messages rm ON m.reply_to_id = rm.id
                LEFT JOIN users ru ON rm.user_id = ru.id
                WHERE m.id = ? AND m.deleted_at IS NULL";
        
        $message = $this->db->fetch($sql, [$messageId]);
        
        if ($message) {
            $message = $this->processMessage($message);
        }
        
        return $message;
    }
    
    public function editMessage($messageId, $userId, $newContent) {
        // Verify ownership
        $message = $this->getMessageById($messageId);
        if (!$message || $message['user_id'] != $userId) {
            throw new Exception("Message not found or access denied");
        }
        
        // Check if message can be edited (within time limit)
        $createdAt = new DateTime($message['created_at']);
        $now = new DateTime();
        $timeDiff = $now->diff($createdAt);
        
        if ($timeDiff->i > 15) { // 15 minutes edit window
            throw new Exception("Message can no longer be edited");
        }
        
        // Validate new content
        if (empty(trim($newContent))) {
            throw new Exception("Message cannot be empty");
        }
        
        if (strlen($newContent) > 2000) {
            throw new Exception("Message too long");
        }
        
        $newContent = $this->security->sanitizeInput($newContent);
        
        // Encrypt if needed
        $isEncrypted = false;
        if ($this->shouldEncryptMessage($newContent)) {
            $newContent = $this->security->encryptData($newContent);
            $isEncrypted = true;
        }
        
        // Update message
        $sql = "UPDATE messages SET content = ?, is_encrypted = ?, edited_at = NOW() WHERE id = ?";
        $this->db->query($sql, [$newContent, $isEncrypted ? 1 : 0, $messageId]);
        
        $this->logMessageEvent($userId, 'message_edited', ['message_id' => $messageId]);
        
        return $this->getMessageById($messageId);
    }
    
    public function deleteMessage($messageId, $userId) {
        // Verify ownership or admin privileges
        $message = $this->getMessageById($messageId);
        if (!$message || $message['user_id'] != $userId) {
            throw new Exception("Message not found or access denied");
        }
        
        // Soft delete
        $sql = "UPDATE messages SET deleted_at = NOW() WHERE id = ?";
        $this->db->query($sql, [$messageId]);
        
        // Delete associated file if exists
        if ($message['file_path'] && file_exists($message['file_path'])) {
            unlink($message['file_path']);
        }
        
        $this->logMessageEvent($userId, 'message_deleted', ['message_id' => $messageId]);
        
        return true;
    }
    
    public function addReaction($messageId, $userId, $reaction) {
        // Validate reaction (emoji)
        if (!$this->isValidEmoji($reaction)) {
            throw new Exception("Invalid reaction");
        }
        
        // Check if message exists
        if (!$this->messageExists($messageId)) {
            throw new Exception("Message not found");
        }
        
        // Add or update reaction
        $sql = "INSERT INTO message_reactions (message_id, user_id, emoji) 
                VALUES (?, ?, ?) 
                ON DUPLICATE KEY UPDATE created_at = NOW()";
        
        $this->db->query($sql, [$messageId, $userId, $reaction]);
        
        return $this->getMessageReactions($messageId);
    }
    
    public function removeReaction($messageId, $userId, $reaction) {
        $sql = "DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?";
        $this->db->query($sql, [$messageId, $userId, $reaction]);
        
        return $this->getMessageReactions($messageId);
    }
    
    // Uses the comprehensive version defined later in the file
    
    public function searchMessages($query, $userId = null, $limit = 20) {
        $sql = "SELECT m.*, u.username, u.display_name, u.avatar
                FROM messages m
                JOIN users u ON m.user_id = u.id
                WHERE m.deleted_at IS NULL 
                AND m.message_type = 'text'
                AND (m.content LIKE ? OR u.username LIKE ?)";
        
        $params = ["%$query%", "%$query%"];
        
        if ($userId) {
            $sql .= " AND m.user_id = ?";
            $params[] = $userId;
        }
        
        $sql .= " ORDER BY m.created_at DESC LIMIT ?";
        $params[] = $limit;
        
        $messages = $this->db->fetchAll($sql, $params);
        
        foreach ($messages as &$message) {
            $message = $this->processMessage($message);
        }
        
        return $messages;
    }
    
    public function getMessageStats($userId = null) {
        $sql = "SELECT 
                    COUNT(*) as total_messages,
                    COUNT(CASE WHEN message_type = 'text' THEN 1 END) as text_messages,
                    COUNT(CASE WHEN message_type = 'image' THEN 1 END) as image_messages,
                    COUNT(CASE WHEN message_type = 'video' THEN 1 END) as video_messages,
                    COUNT(CASE WHEN message_type = 'audio' THEN 1 END) as audio_messages,
                    COUNT(CASE WHEN message_type = 'file' THEN 1 END) as file_messages,
                    COUNT(CASE WHEN edited_at IS NOT NULL THEN 1 END) as edited_messages
                FROM messages 
                WHERE deleted_at IS NULL";
        
        $params = [];
        
        if ($userId) {
            $sql .= " AND user_id = ?";
            $params[] = $userId;
        }
        
        return $this->db->fetch($sql, $params);
    }
    
    public function cleanupOldMessages($daysOld = 90) {
        // Hard delete messages older than specified days
        $sql = "DELETE FROM messages WHERE deleted_at IS NOT NULL AND deleted_at < DATE_SUB(NOW(), INTERVAL ? DAY)";
        $result = $this->db->query($sql, [$daysOld]);
        
        return $result->rowCount();
    }
    
    // Dashboard and statistics methods
    public function getUserMessageCount($userId) {
        $sql = "SELECT COUNT(*) as count FROM messages WHERE user_id = ? AND deleted_at IS NULL";
        $result = $this->db->fetch($sql, [$userId]);
        return $result['count'];
    }
    
    public function getRecentMessages($userId, $limit = 10) {
        $sql = "SELECT m.*, u.username, u.display_name, u.avatar 
                FROM messages m 
                JOIN users u ON m.user_id = u.id 
                WHERE m.deleted_at IS NULL 
                ORDER BY m.created_at DESC 
                LIMIT ?";
        
        return $this->db->fetchAll($sql, [$limit]);
    }
    
    public function getTodayMessageCount() {
        $sql = "SELECT COUNT(*) as count FROM messages WHERE DATE(created_at) = CURDATE() AND deleted_at IS NULL";
        $result = $this->db->fetch($sql);
        return $result['count'] ?? 0;
    }
    
    public function getDirectMessages($userId1, $userId2, $limit = 50, $offset = 0) {
        // Note: This method needs to be updated based on actual chat architecture
        // Current messages table doesn't have recipient_id column
        // For now, returning messages from both users ordered by time
        $sql = "SELECT m.*, u.username, u.display_name, u.avatar
                FROM messages m
                JOIN users u ON m.user_id = u.id
                WHERE m.user_id IN (?, ?)
                AND m.deleted_at IS NULL
                ORDER BY m.created_at DESC
                LIMIT ? OFFSET ?";
        
        return $this->db->fetchAll($sql, [$userId1, $userId2, $limit, $offset]);
    }
    
    private function processMessage($message) {
        // Decrypt if encrypted
        if ($message['is_encrypted'] && $message['content']) {
            $message['content'] = $this->security->decryptData($message['content']);
        }
        
        // Add additional data
        $message['reactions'] = $this->getMessageReactions($message['id']);
        $message['formatted_date'] = date('Y-m-d H:i:s', strtotime($message['created_at']));
        
        // Process file URLs
        if ($message['file_path']) {
            $message['file_url'] = $this->getFileUrl($message['file_path']);
        }
        
        return $message;
    }
    
    private function validateUser($userId) {
        $result = $this->db->fetch("SELECT id FROM users WHERE id = ?", [$userId]);
        return $result !== false;
    }
    
    private function messageExists($messageId) {
        $result = $this->db->fetch("SELECT id FROM messages WHERE id = ? AND deleted_at IS NULL", [$messageId]);
        return $result !== false;
    }
    
    private function shouldEncryptMessage($content) {
        // Implement logic to determine if message should be encrypted
        // For example, check for sensitive keywords or user preferences
        $sensitiveKeywords = ['password', 'ssn', 'credit card', 'bank account'];
        
        foreach ($sensitiveKeywords as $keyword) {
            if (stripos($content, $keyword) !== false) {
                return true;
            }
        }
        
        return false;
    }
    
    private function isValidEmoji($emoji) {
        // Basic emoji validation - in production, use a more comprehensive check
        return preg_match('/^(?:[\x{1F600}-\x{1F64F}]|[\x{1F300}-\x{1F5FF}]|[\x{1F680}-\x{1F6FF}]|[\x{1F1E0}-\x{1F1FF}]|[\x{2600}-\x{26FF}]|[\x{2700}-\x{27BF}])+$/u', $emoji);
    }
    
    private function getFileUrl($filePath) {
        // Convert file path to URL
        $baseUrl = Config::getAppUrl();
        $relativePath = str_replace(__DIR__ . '/../', '', $filePath);
        return $baseUrl . '/' . $relativePath;
    }
    
    private function logMessageEvent($userId, $action, $details = []) {
        $sql = "INSERT INTO audit_logs (user_id, event_type, event_data, ip_address, user_agent) 
                VALUES (?, ?, ?, ?, ?)";
        
        $this->db->query($sql, [
            $userId,
            $action,
            json_encode($details),
            $_SERVER['REMOTE_ADDR'] ?? '',
            $_SERVER['HTTP_USER_AGENT'] ?? ''
        ]);
    }
    
    /**
     * Validate if a user is a member of a group and not banned
     * 
     * @param int $userId The user ID
     * @param int $groupId The group ID
     * @return bool True if user is a valid member, false otherwise
     */
    public function validateGroupMembership($userId, $groupId) {
        // Check if the group exists
        $stmt = $this->db->prepare("SELECT id FROM `groups` WHERE id = ?");
        $stmt->execute([$groupId]);
        if ($stmt->rowCount() === 0) {
            return false;
        }
        
        // Check if user is banned from the group
        $stmt = $this->db->prepare("SELECT id FROM group_banned_users WHERE group_id = ? AND user_id = ?");
        $stmt->execute([$groupId, $userId]);
        if ($stmt->rowCount() > 0) {
            return false;
        }
        
        // Check if user is a member of the group
        $stmt = $this->db->prepare("SELECT id FROM group_members WHERE group_id = ? AND user_id = ?");
        $stmt->execute([$groupId, $userId]);
        if ($stmt->rowCount() === 0) {
            // Check if the group is public, in which case they can send messages without being a member
            $stmt = $this->db->prepare("SELECT is_public FROM `groups` WHERE id = ?");
            $stmt->execute([$groupId]);
            $group = $stmt->fetch(PDO::FETCH_ASSOC);
            return $group && $group['is_public'];
        }
        
        return true;
    }
    
    /**
     * Create a new group chat
     * 
     * @param int $creatorId The user ID creating the group
     * @param string $name The group name
     * @param string $description The group description
     * @param bool $isPublic Whether the group is public
     * @param string $avatar The group avatar path
     * @return array The created group data
     */
    public function createGroupChat($creatorId, $name, $description = '', $isPublic = false, $avatar = null) {
        // Validate user
        if (!$this->validateUser($creatorId)) {
            throw new Exception("Invalid user");
        }
        
        // Validate name
        if (empty(trim($name))) {
            throw new Exception("Group name cannot be empty");
        }
        
        // Create group
        $stmt = $this->db->prepare("
            INSERT INTO groups (name, description, created_by, is_public, avatar)
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $this->security->sanitizeInput($name),
            $this->security->sanitizeInput($description),
            $creatorId,
            $isPublic ? 1 : 0,
            $avatar
        ]);
        
        $groupId = $this->db->lastInsertId();
        
        // Add creator as admin
        $stmt = $this->db->prepare("
            INSERT INTO group_members (group_id, user_id, is_admin)
            VALUES (?, ?, 1)
        ");
        $stmt->execute([$groupId, $creatorId]);
        
        // Return the created group
        $stmt = $this->db->prepare("SELECT * FROM `groups` WHERE id = ?");
        $stmt->execute([$groupId]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
    
    /**
     * Add a user to a group
     * 
     * @param int $groupId The group ID
     * @param int $userId The user ID to add
     * @param int $addedBy The user ID adding the member
     * @param bool $isAdmin Whether the user should be an admin
     * @return bool Success status
     */
    public function addGroupMember($groupId, $userId, $addedBy, $isAdmin = false) {
        // Validate the group exists
        $stmt = $this->db->prepare("SELECT id, created_by FROM `groups` WHERE id = ?");
        $stmt->execute([$groupId]);
        if ($stmt->rowCount() === 0) {
            throw new Exception("Group not found");
        }
        $group = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // Validate the adder has permission
        $stmt = $this->db->prepare("SELECT is_admin FROM group_members WHERE group_id = ? AND user_id = ?");
        $stmt->execute([$groupId, $addedBy]);
        $adder = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$adder && $group['created_by'] !== $addedBy) {
            throw new Exception("You don't have permission to add members");
        }
        
        // Check if user is banned
        $stmt = $this->db->prepare("SELECT id FROM group_banned_users WHERE group_id = ? AND user_id = ?");
        $stmt->execute([$groupId, $userId]);
        if ($stmt->rowCount() > 0) {
            throw new Exception("This user is banned from the group");
        }
        
        // Check if user is already a member
        $stmt = $this->db->prepare("SELECT id FROM group_members WHERE group_id = ? AND user_id = ?");
        $stmt->execute([$groupId, $userId]);
        if ($stmt->rowCount() > 0) {
            throw new Exception("User is already a member of this group");
        }
        
        // Add the user
        $stmt = $this->db->prepare("
            INSERT INTO group_members (group_id, user_id, is_admin)
            VALUES (?, ?, ?)
        ");
        $stmt->execute([$groupId, $userId, $isAdmin ? 1 : 0]);
        
        return true;
    }
    
    /**
     * Remove a user from a group
     * 
     * @param int $groupId The group ID
     * @param int $userId The user ID to remove
     * @param int $removedBy The user ID removing the member
     * @return bool Success status
     */
    public function removeGroupMember($groupId, $userId, $removedBy) {
        // Validate the group exists
        $stmt = $this->db->prepare("SELECT id, created_by FROM `groups` WHERE id = ?");
        $stmt->execute([$groupId]);
        if ($stmt->rowCount() === 0) {
            throw new Exception("Group not found");
        }
        $group = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // Validate the remover has permission
        $stmt = $this->db->prepare("SELECT is_admin FROM group_members WHERE group_id = ? AND user_id = ?");
        $stmt->execute([$groupId, $removedBy]);
        $remover = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$remover && $group['created_by'] !== $removedBy) {
            throw new Exception("You don't have permission to remove members");
        }
        
        // Cannot remove the creator
        if ($userId === $group['created_by'] && $removedBy !== $userId) {
            throw new Exception("Cannot remove the group creator");
        }
        
        // Remove the user
        $stmt = $this->db->prepare("
            DELETE FROM group_members 
            WHERE group_id = ? AND user_id = ?
        ");
        $stmt->execute([$groupId, $userId]);
        
        return true;
    }
    
    /**
     * Ban a user from a group
     * 
     * @param int $groupId The group ID
     * @param int $userId The user ID to ban
     * @param int $bannedBy The user ID banning the member
     * @param string $reason The reason for the ban
     * @return bool Success status
     */
    public function banGroupMember($groupId, $userId, $bannedBy, $reason = '') {
        // Validate the group exists
        $stmt = $this->db->prepare("SELECT id, created_by FROM groups WHERE id = ?");
        $stmt->execute([$groupId]);
        if ($stmt->rowCount() === 0) {
            throw new Exception("Group not found");
        }
        $group = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // Validate the banner has permission
        $stmt = $this->db->prepare("SELECT is_admin FROM group_members WHERE group_id = ? AND user_id = ?");
        $stmt->execute([$groupId, $bannedBy]);
        $banner = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$banner && $group['created_by'] !== $bannedBy) {
            throw new Exception("You don't have permission to ban members");
        }
        
        // Cannot ban the creator
        if ($userId === $group['created_by']) {
            throw new Exception("Cannot ban the group creator");
        }
        
        // Remove from members if they are a member
        $this->removeGroupMember($groupId, $userId, $bannedBy);
        
        // Add to banned users
        $stmt = $this->db->prepare("
            INSERT INTO group_banned_users (group_id, user_id, banned_by, reason)
            VALUES (?, ?, ?, ?)
        ");
        $stmt->execute([
            $groupId, 
            $userId, 
            $bannedBy, 
            $this->security->sanitizeInput($reason)
        ]);
        
        return true;
    }
    
    /**
     * Update group settings
     * 
     * @param int $groupId The group ID
     * @param int $userId The user ID making the change
     * @param array $settings The settings to update
     * @return array The updated group data
     */
    public function updateGroupSettings($groupId, $userId, $settings) {
        // Validate the group exists
        $stmt = $this->db->prepare("SELECT id, created_by FROM groups WHERE id = ?");
        $stmt->execute([$groupId]);
        if ($stmt->rowCount() === 0) {
            throw new Exception("Group not found");
        }
        $group = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // Validate the user has permission
        $stmt = $this->db->prepare("SELECT is_admin FROM group_members WHERE group_id = ? AND user_id = ?");
        $stmt->execute([$groupId, $userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$user && $group['created_by'] !== $userId) {
            throw new Exception("You don't have permission to change group settings");
        }
        
        // Prepare update fields
        $updateFields = [];
        $params = [];
        
        if (isset($settings['name']) && !empty(trim($settings['name']))) {
            $updateFields[] = "name = ?";
            $params[] = $this->security->sanitizeInput($settings['name']);
        }
        
        if (isset($settings['description'])) {
            $updateFields[] = "description = ?";
            $params[] = $this->security->sanitizeInput($settings['description']);
        }
        
        if (isset($settings['is_public'])) {
            $updateFields[] = "is_public = ?";
            $params[] = $settings['is_public'] ? 1 : 0;
        }
        
        if (isset($settings['avatar'])) {
            $updateFields[] = "avatar = ?";
            $params[] = $settings['avatar'];
        }
        
        if (empty($updateFields)) {
            throw new Exception("No valid fields to update");
        }
        
        // Update the group
        $params[] = $groupId;
        $stmt = $this->db->prepare("
            UPDATE groups 
            SET " . implode(', ', $updateFields) . "
            WHERE id = ?
        ");
        $stmt->execute($params);
        
        // Return the updated group
        $stmt = $this->db->prepare("SELECT * FROM `groups` WHERE id = ?");
        $stmt->execute([$groupId]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
    
    /**
     * Get all groups a user is a member of
     * 
     * @param int $userId The user ID
     * @return array List of groups
     */
    public function getUserGroups($userId) {
        $stmt = $this->db->prepare("
            SELECT g.*, gm.is_admin, 
                   (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
            FROM `groups` g
            JOIN group_members gm ON g.id = gm.group_id
            WHERE gm.user_id = ?
            ORDER BY g.updated_at DESC
        ");
        $stmt->execute([$userId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    /**
     * Get all public groups
     * 
     * @return array List of public groups
     */
    public function getPublicGroups() {
        $stmt = $this->db->prepare("
            SELECT g.*, 
                   (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
            FROM `groups` g
            WHERE g.is_public = 1
            ORDER BY g.updated_at DESC
        ");
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    /**
     * Get group members
     * 
     * @param int $groupId The group ID
     * @return array List of members
     */
    public function getGroupMembers($groupId) {
        $stmt = $this->db->prepare("
            SELECT u.id, u.username, u.display_name, u.avatar, u.status,
                   gm.is_admin, gm.joined_at
            FROM group_members gm
            JOIN users u ON gm.user_id = u.id
            WHERE gm.group_id = ?
            ORDER BY gm.is_admin DESC, u.display_name ASC
        ");
        $stmt->execute([$groupId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    /**
     * Mark a group message as read by a user
     * 
     * @param int $messageId The message ID
     * @param int $userId The user ID
     * @param int $groupId The group ID
     * @return bool Success status
     */
    public function markGroupMessageAsRead($messageId, $userId, $groupId) {
        // Validate user
        if (!$this->validateUser($userId)) {
            throw new Exception("Invalid user");
        }
        
        // Validate group membership
        if (!$this->validateGroupMembership($userId, $groupId)) {
            throw new Exception("User is not a member of this group");
        }
        
        // Check if message exists and belongs to the group
        $stmt = $this->db->prepare("
            SELECT id FROM messages 
            WHERE id = ? AND group_id = ? AND user_id != ?
        ");
        $stmt->execute([$messageId, $groupId, $userId]);
        
        if ($stmt->rowCount() === 0) {
            // Message doesn't exist, doesn't belong to the group, or was sent by the current user
            return false;
        }
        
        // Check if read receipt already exists
        $stmt = $this->db->prepare("
            SELECT id FROM message_read_receipts 
            WHERE message_id = ? AND user_id = ?
        ");
        $stmt->execute([$messageId, $userId]);
        
        if ($stmt->rowCount() > 0) {
            // Already marked as read
            return true;
        }
        
        // Insert read receipt
        $stmt = $this->db->prepare("
            INSERT INTO message_read_receipts (message_id, user_id, group_id, read_at)
            VALUES (?, ?, ?, NOW())
        ");
        $stmt->execute([$messageId, $userId, $groupId]);
        
        return true;
    }
    
    /**
     * Get read receipts for a group message
     * 
     * @param int $messageId The message ID
     * @param int $groupId The group ID
     * @return array The read receipts data
     */
    public function getGroupMessageReadReceipts($messageId, $groupId) {
        $stmt = $this->db->prepare("
            SELECT r.user_id, r.read_at, u.username, u.display_name, u.avatar
            FROM message_read_receipts r
            JOIN users u ON r.user_id = u.id
            WHERE r.message_id = ? AND r.group_id = ?
            ORDER BY r.read_at ASC
        ");
        $stmt->execute([$messageId, $groupId]);
        
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    /**
     * Add a reaction to a message
     * 
     * @param int $messageId The message ID
     * @param int $userId The user ID
     * @param string $emoji The emoji reaction
     * @param int|null $groupId The group ID (if applicable)
     * @return bool Success status
     */
    public function addMessageReaction($messageId, $userId, $emoji, $groupId = null) {
        // Validate user
        if (!$this->validateUser($userId)) {
            throw new Exception("Invalid user");
        }
        
        // Validate message
        $sql = "SELECT id, user_id, group_id FROM messages WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$messageId]);
        $message = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$message) {
            throw new Exception("Message not found");
        }
        
        // If group message, validate group membership
        if ($groupId) {
            if ($message['group_id'] != $groupId) {
                throw new Exception("Message does not belong to the specified group");
            }
            
            if (!$this->validateGroupMembership($userId, $groupId)) {
                throw new Exception("User is not a member of this group");
            }
        }
        
        // Sanitize emoji
        $emoji = $this->security->sanitizeInput($emoji);
        
        // Check if reaction already exists
        $sql = "SELECT id FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$messageId, $userId, $emoji]);
        
        if ($stmt->rowCount() > 0) {
            // Reaction already exists, remove it (toggle behavior)
            $sql = "DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([$messageId, $userId, $emoji]);
            return false; // Indicates reaction was removed
        }
        
        // Add reaction
        $sql = "INSERT INTO message_reactions (message_id, user_id, emoji, group_id, created_at) 
                VALUES (?, ?, ?, ?, NOW())";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$messageId, $userId, $emoji, $groupId]);
        
        return true; // Indicates reaction was added
    }
    
    /**
     * Remove a message reaction
     * 
     * @param int $messageId The message ID
     * @param int $userId The user ID
     * @param string $emoji The emoji reaction
     * @return bool Success status
     */
    public function removeMessageReaction($messageId, $userId, $emoji) {
        // Validate user
        if (!$this->validateUser($userId)) {
            throw new Exception("Invalid user");
        }
        
        // Sanitize emoji
        $emoji = $this->security->sanitizeInput($emoji);
        
        // Remove reaction
        $sql = "DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$messageId, $userId, $emoji]);
        
        return $stmt->rowCount() > 0;
    }
    
    /**
     * Get reactions for a message
     * 
     * @param int $messageId The message ID
     * @return array The reactions data
     */
    public function getMessageReactions($messageId) {
        // Get reaction counts by emoji
        $sql = "
            SELECT emoji, COUNT(*) as count, GROUP_CONCAT(user_id) as user_ids
            FROM message_reactions
            WHERE message_id = ?
            GROUP BY emoji
            ORDER BY count DESC, emoji ASC
        ";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$messageId]);
        $reactions = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Process user IDs
        foreach ($reactions as &$reaction) {
            $userIds = explode(',', $reaction['user_ids']);
            $reaction['user_ids'] = array_map('intval', $userIds);
            $reaction['count'] = intval($reaction['count']);
        }
        
        return $reactions;
    }
    
    /**
     * Update a user's notification settings for a group
     * 
     * @param int $userId The user ID
     * @param int $groupId The group ID
     * @param array $settings Notification settings array
     * @return array The updated settings
     */
    public function updateGroupNotificationSettings($userId, $groupId, $settings) {
        // Validate user and group membership
        if (!$this->validateUser($userId)) {
            throw new Exception("Invalid user");
        }
        
        if (!$this->validateGroupMembership($userId, $groupId)) {
            throw new Exception("User is not a member of this group");
        }
        
        // Check if settings already exist
        $sql = "SELECT id FROM group_notification_settings WHERE user_id = ? AND group_id = ?";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$userId, $groupId]);
        $exists = $stmt->rowCount() > 0;
        
        if ($exists) {
            // Update existing settings
            $updateFields = [];
            $params = [];
            
            if (isset($settings['muted'])) {
                $updateFields[] = "muted = ?";
                $params[] = $settings['muted'] ? 1 : 0;
            }
            
            if (isset($settings['notify_all_messages'])) {
                $updateFields[] = "notify_all_messages = ?";
                $params[] = $settings['notify_all_messages'] ? 1 : 0;
            }
            
            if (isset($settings['notify_mentions'])) {
                $updateFields[] = "notify_mentions = ?";
                $params[] = $settings['notify_mentions'] ? 1 : 0;
            }
            
            if (isset($settings['notify_reactions'])) {
                $updateFields[] = "notify_reactions = ?";
                $params[] = $settings['notify_reactions'] ? 1 : 0;
            }
            
            if (empty($updateFields)) {
                throw new Exception("No valid settings to update");
            }
            
            $params[] = $userId;
            $params[] = $groupId;
            
            $sql = "UPDATE group_notification_settings 
                    SET " . implode(', ', $updateFields) . ", updated_at = NOW()
                    WHERE user_id = ? AND group_id = ?";
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
        } else {
            // Insert new settings
            $muted = isset($settings['muted']) ? ($settings['muted'] ? 1 : 0) : 0;
            $notifyAllMessages = isset($settings['notify_all_messages']) ? ($settings['notify_all_messages'] ? 1 : 0) : 1;
            $notifyMentions = isset($settings['notify_mentions']) ? ($settings['notify_mentions'] ? 1 : 0) : 1;
            $notifyReactions = isset($settings['notify_reactions']) ? ($settings['notify_reactions'] ? 1 : 0) : 1;
            
            $sql = "INSERT INTO group_notification_settings 
                    (user_id, group_id, muted, notify_all_messages, notify_mentions, notify_reactions)
                    VALUES (?, ?, ?, ?, ?, ?)";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([$userId, $groupId, $muted, $notifyAllMessages, $notifyMentions, $notifyReactions]);
        }
        
        // Return updated settings
        $sql = "SELECT * FROM group_notification_settings WHERE user_id = ? AND group_id = ?";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$userId, $groupId]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
    
    /**
     * Get a user's notification settings for a group
     * 
     * @param int $userId The user ID
     * @param int $groupId The group ID
     * @return array The notification settings
     */
    public function getGroupNotificationSettings($userId, $groupId) {
        // Validate user and group membership
        if (!$this->validateUser($userId)) {
            throw new Exception("Invalid user");
        }
        
        if (!$this->validateGroupMembership($userId, $groupId)) {
            throw new Exception("User is not a member of this group");
        }
        
        // Get settings or return defaults
        $sql = "SELECT * FROM group_notification_settings WHERE user_id = ? AND group_id = ?";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$userId, $groupId]);
        
        if ($stmt->rowCount() > 0) {
            return $stmt->fetch(PDO::FETCH_ASSOC);
        } else {
            // Return default settings
            return [
                'user_id' => $userId,
                'group_id' => $groupId,
                'muted' => false,
                'notify_all_messages' => true,
                'notify_mentions' => true,
                'notify_reactions' => true
            ];
        }
    }
    
    /**
     * Create a group invitation link
     * 
     * @param int $groupId The group ID
     * @param int $createdBy The user ID creating the link
     * @param int|null $maxUses Maximum number of uses (null for unlimited)
     * @param string|null $expiresAt Expiration timestamp (null for no expiration)
     * @return array The created invite link data
     */
    public function createGroupInviteLink($groupId, $createdBy, $maxUses = null, $expiresAt = null) {
        // Validate group
        $sql = "SELECT id, created_by FROM groups WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$groupId]);
        
        if ($stmt->rowCount() === 0) {
            throw new Exception("Group not found");
        }
        
        $group = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // Check if user has permission (admin or creator)
        $sql = "SELECT is_admin FROM group_members WHERE group_id = ? AND user_id = ?";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$groupId, $createdBy]);
        $member = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$member && $group['created_by'] !== $createdBy) {
            throw new Exception("You don't have permission to create invite links");
        }
        
        // Generate unique invite code
        $inviteCode = bin2hex(random_bytes(16));
        
        // Insert invite link
        $sql = "INSERT INTO group_invite_links 
                (group_id, created_by, invite_code, max_uses, expires_at)
                VALUES (?, ?, ?, ?, ?)";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$groupId, $createdBy, $inviteCode, $maxUses, $expiresAt]);
        
        $inviteId = $this->db->lastInsertId();
        
        // Return the created invite link
        $sql = "SELECT * FROM group_invite_links WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$inviteId]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
    
    /**
     * Use a group invitation link to join a group
     * 
     * @param string $inviteCode The invite code
     * @param int $userId The user ID joining the group
     * @return array The group data
     */
    public function useGroupInviteLink($inviteCode, $userId) {
        // Validate user
        if (!$this->validateUser($userId)) {
            throw new Exception("Invalid user");
        }
        
        // Find the invite link
        $sql = "SELECT * FROM group_invite_links WHERE invite_code = ?";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$inviteCode]);
        
        if ($stmt->rowCount() === 0) {
            throw new Exception("Invalid invite link");
        }
        
        $invite = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // Check if invite is expired
        if ($invite['expires_at'] && strtotime($invite['expires_at']) < time()) {
            throw new Exception("Invite link has expired");
        }
        
        // Check if invite has reached max uses
        if ($invite['max_uses'] && $invite['use_count'] >= $invite['max_uses']) {
            throw new Exception("Invite link has reached maximum uses");
        }
        
        // Check if user is already a member
        $sql = "SELECT id FROM group_members WHERE group_id = ? AND user_id = ?";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$invite['group_id'], $userId]);
        
        if ($stmt->rowCount() > 0) {
            throw new Exception("You are already a member of this group");
        }
        
        // Check if user is banned
        $sql = "SELECT id FROM group_banned_users WHERE group_id = ? AND user_id = ?";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$invite['group_id'], $userId]);
        
        if ($stmt->rowCount() > 0) {
            throw new Exception("You have been banned from this group");
        }
        
        // Add user to group
        $sql = "INSERT INTO group_members (group_id, user_id, is_admin) VALUES (?, ?, 0)";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$invite['group_id'], $userId]);
        
        // Increment use count
        $sql = "UPDATE group_invite_links SET use_count = use_count + 1 WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$invite['id']]);
        
        // Get group details
        $sql = "SELECT * FROM `groups` WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$invite['group_id']]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
    
    /**
     * Search for messages in a group chat
     * 
     * @param int $groupId The group ID
     * @param string $query The search query
     * @param int $userId The user ID performing the search
     * @param int $limit The maximum number of results to return
     * @return array The search results
     */
    public function searchGroupMessages($groupId, $query, $userId, $limit = 20) {
        // Validate user and group membership
        if (!$this->validateUser($userId)) {
            throw new Exception("Invalid user");
        }
        
        if (!$this->validateGroupMembership($userId, $groupId)) {
            throw new Exception("User is not a member of this group");
        }
        
        // Search messages
        $sql = "SELECT m.*, u.username, u.display_name, u.avatar
                FROM messages m
                JOIN users u ON m.user_id = u.id
                JOIN group_message_search gms ON m.id = gms.message_id
                WHERE m.group_id = ? 
                AND m.deleted_at IS NULL
                AND MATCH(gms.message_content) AGAINST (? IN NATURAL LANGUAGE MODE)
                ORDER BY m.created_at DESC
                LIMIT ?";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$groupId, $query, $limit]);
        $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Process messages
        foreach ($messages as &$message) {
            $message = $this->processMessage($message);
        }
        
        return $messages;
    }
    
    /**
     * Apply moderation action to a user in a group
     * 
     * @param int $groupId The group ID
     * @param int $userId The user ID being moderated
     * @param int $moderatorId The user ID performing the moderation
     * @param string $actionType The type of action (warn, mute, kick, ban, unban)
     * @param int|null $duration Duration in minutes (null for permanent)
     * @param string|null $reason The reason for the action
     * @return array The moderation action data
     */
    public function moderateGroupUser($groupId, $userId, $moderatorId, $actionType, $duration = null, $reason = null) {
        // Validate group
        $sql = "SELECT id, created_by FROM groups WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$groupId]);
        
        if ($stmt->rowCount() === 0) {
            throw new Exception("Group not found");
        }
        
        $group = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // Check if moderator has permission (admin or creator)
        $sql = "SELECT is_admin FROM group_members WHERE group_id = ? AND user_id = ?";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$groupId, $moderatorId]);
        $moderator = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$moderator && $group['created_by'] !== $moderatorId) {
            throw new Exception("You don't have permission to moderate users");
        }
        
        // Cannot moderate the creator
        if ($userId === $group['created_by']) {
            throw new Exception("Cannot moderate the group creator");
        }
        
        // Calculate expiration time if duration is provided
        $expiresAt = null;
        if ($duration) {
            $expiresAt = date('Y-m-d H:i:s', strtotime("+$duration minutes"));
        }
        
        // Insert moderation action
        $sql = "INSERT INTO group_moderation_actions 
                (group_id, user_id, moderator_id, action_type, duration, reason, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$groupId, $userId, $moderatorId, $actionType, $duration, $reason, $expiresAt]);
        
        $actionId = $this->db->lastInsertId();
        
        // Apply action effects
        switch ($actionType) {
            case 'kick':
            case 'ban':
                // Remove from group
                $this->removeGroupMember($groupId, $userId, $moderatorId);
                
                // If banning, add to banned users
                if ($actionType === 'ban') {
                    $sql = "INSERT INTO group_banned_users (group_id, user_id, banned_by, reason)
                            VALUES (?, ?, ?, ?)
                            ON DUPLICATE KEY UPDATE banned_by = ?, reason = ?, banned_at = NOW()";
                    $stmt = $this->db->prepare($sql);
                    $stmt->execute([$groupId, $userId, $moderatorId, $reason, $moderatorId, $reason]);
                }
                break;
                
            case 'unban':
                // Remove from banned users
                $sql = "DELETE FROM group_banned_users WHERE group_id = ? AND user_id = ?";
                $stmt = $this->db->prepare($sql);
                $stmt->execute([$groupId, $userId]);
                break;
        }
        
        // Return the moderation action
        $sql = "SELECT * FROM group_moderation_actions WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$actionId]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
}
?>
