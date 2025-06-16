<?php
require_once __DIR__ . '/Database.php';
require_once __DIR__ . '/Security.php';

class Message {
    private $db;
    private $security;
    
    public function __construct() {
        $this->db = Database::getInstance();
        $this->security = new Security();
    }
    
    public function sendMessage($userId, $content, $messageType = 'text', $filePath = null, $replyToId = null) {
        // Validate user
        if (!$this->validateUser($userId)) {
            throw new Exception("Invalid user");
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
            $sql = "INSERT INTO messages (user_id, content, message_type, file_path, file_size, file_type, is_encrypted, reply_to_id) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
            
            $this->db->query($sql, [
                $userId,
                $content,
                $messageType,
                $filePath,
                $fileSize,
                $fileType,
                $isEncrypted,
                $replyToId
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
        $this->db->query($sql, [$newContent, $isEncrypted, $messageId]);
        
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
        $sql = "INSERT INTO message_reactions (message_id, user_id, reaction) 
                VALUES (?, ?, ?) 
                ON DUPLICATE KEY UPDATE created_at = NOW()";
        
        $this->db->query($sql, [$messageId, $userId, $reaction]);
        
        return $this->getMessageReactions($messageId);
    }
    
    public function removeReaction($messageId, $userId, $reaction) {
        $sql = "DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND reaction = ?";
        $this->db->query($sql, [$messageId, $userId, $reaction]);
        
        return $this->getMessageReactions($messageId);
    }
    
    public function getMessageReactions($messageId) {
        $sql = "SELECT reaction, COUNT(*) as count, 
                       GROUP_CONCAT(u.username) as users
                FROM message_reactions mr
                JOIN users u ON mr.user_id = u.id
                WHERE mr.message_id = ?
                GROUP BY reaction";
        
        return $this->db->fetchAll($sql, [$messageId]);
    }
    
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
        return $result['count'] ?? 0;
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
        $sql = "INSERT INTO audit_logs (user_id, action, details, ip_address, user_agent) 
                VALUES (?, ?, ?, ?, ?)";
        
        $this->db->query($sql, [
            $userId,
            $action,
            json_encode($details),
            $_SERVER['REMOTE_ADDR'] ?? '',
            $_SERVER['HTTP_USER_AGENT'] ?? ''
        ]);
    }
}
?>
