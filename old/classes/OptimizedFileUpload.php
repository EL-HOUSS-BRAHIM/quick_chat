<?php
/**
 * Optimized File Upload Handler
 * Provides efficient file upload with batch processing and optimized queries
 */

class OptimizedFileUpload {
    private $db;
    private $security;
    private $allowedTypes;
    private $maxFileSize;
    private $uploadPath;
    
    public function __construct() {
        $this->db = Database::getInstance();
        $this->security = new Security();
        $this->allowedTypes = array_merge(
            Config::getAllowedImageTypes(),
            Config::getAllowedVideoTypes(),
            Config::getAllowedAudioTypes(),
            Config::getAllowedDocumentTypes()
        );
        $this->maxFileSize = Config::getMaxFileSize();
        $this->uploadPath = Config::getUploadPath();
    }
    
    /**
     * Handle batch file upload with optimized database operations
     * @param array $files Files to upload
     * @param int $userId User ID
     * @param int|null $messageId Associated message ID
     * @param int|null $groupId Associated group ID
     * @return array Upload results
     */
    public function handleBatchUpload($files, $userId, $messageId = null, $groupId = null) {
        $results = [];
        $uploadedFiles = [];
        
        try {
            // Begin transaction for atomic operations
            $this->db->beginTransaction();
            
            // Prepare optimized insert statement
            $insertSql = "INSERT INTO file_uploads (
                user_id, message_id, group_id, original_filename, stored_filename, 
                file_path, file_type, file_size, file_hash, thumbnail_path, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())";
            
            $insertStmt = $this->db->prepare($insertSql);
            
            foreach ($files as $fileIndex => $file) {
                try {
                    $uploadResult = $this->processSingleFile($file, $userId, $messageId, $groupId, $insertStmt);
                    $results[] = $uploadResult;
                    
                    if ($uploadResult['success']) {
                        $uploadedFiles[] = $uploadResult['file_id'];
                    }
                } catch (Exception $e) {
                    $results[] = [
                        'success' => false,
                        'filename' => $file['name'] ?? 'unknown',
                        'error' => $e->getMessage()
                    ];
                }
            }
            
            // Commit transaction
            $this->db->commit();
            
            // Update user storage quota in background
            $this->updateUserStorageQuota($userId);
            
            // Log successful batch upload
            $this->logUploadActivity($userId, count($uploadedFiles), 'batch_upload_success');
            
            return [
                'success' => true,
                'uploaded_count' => count($uploadedFiles),
                'total_count' => count($files),
                'file_ids' => $uploadedFiles,
                'results' => $results
            ];
            
        } catch (Exception $e) {
            // Rollback transaction on error
            $this->db->rollback();
            
            // Clean up any uploaded files
            $this->cleanupFailedUploads($results);
            
            error_log("Batch upload failed: " . $e->getMessage());
            throw new Exception("Batch upload failed: " . $e->getMessage());
        }
    }
    
    /**
     * Process a single file upload with optimizations
     */
    private function processSingleFile($file, $userId, $messageId, $groupId, $insertStmt) {
        // Validate file
        $this->validateFile($file);
        
        // Generate unique filename
        $fileInfo = pathinfo($file['name']);
        $extension = strtolower($fileInfo['extension']);
        $storedFilename = uniqid() . '_' . time() . '.' . $extension;
        
        // Determine storage path based on file type
        $subPath = $this->getFileSubPath($file['type']);
        $fullPath = $this->uploadPath . $subPath;
        
        // Ensure directory exists
        if (!is_dir($fullPath)) {
            mkdir($fullPath, 0755, true);
        }
        
        $filePath = $fullPath . $storedFilename;
        
        // Move uploaded file
        if (!move_uploaded_file($file['tmp_name'], $filePath)) {
            throw new Exception("Failed to move uploaded file");
        }
        
        // Calculate file hash for deduplication
        $fileHash = hash_file('sha256', $filePath);
        
        // Check for duplicate files (optional optimization)
        if (Config::isDeduplicationEnabled()) {
            $duplicateFileId = $this->checkForDuplicate($fileHash, $userId);
            if ($duplicateFileId) {
                unlink($filePath); // Remove duplicate
                return [
                    'success' => true,
                    'filename' => $file['name'],
                    'file_id' => $duplicateFileId,
                    'duplicate' => true
                ];
            }
        }
        
        // Generate thumbnail for images
        $thumbnailPath = null;
        if (strpos($file['type'], 'image/') === 0) {
            $thumbnailPath = $this->generateThumbnail($filePath, $storedFilename);
        }
        
        // Insert file record using prepared statement
        $insertStmt->execute([
            $userId,
            $messageId,
            $groupId,
            $file['name'],
            $storedFilename,
            $subPath . $storedFilename,
            $file['type'],
            $file['size'],
            $fileHash,
            $thumbnailPath
        ]);
        
        $fileId = $this->db->lastInsertId();
        
        return [
            'success' => true,
            'filename' => $file['name'],
            'file_id' => $fileId,
            'file_path' => $subPath . $storedFilename,
            'file_size' => $file['size'],
            'file_type' => $file['type'],
            'thumbnail_path' => $thumbnailPath
        ];
    }
    
    /**
     * Validate uploaded file
     */
    private function validateFile($file) {
        if ($file['error'] !== UPLOAD_ERR_OK) {
            throw new Exception("File upload error: " . $this->getUploadErrorMessage($file['error']));
        }
        
        if ($file['size'] > $this->maxFileSize) {
            throw new Exception("File size exceeds maximum allowed size");
        }
        
        if (!in_array($file['type'], $this->allowedTypes)) {
            throw new Exception("File type not allowed");
        }
        
        // Additional security checks
        $this->security->validateFileUpload($file);
    }
    
    /**
     * Get file sub-path based on type
     */
    private function getFileSubPath($mimeType) {
        if (strpos($mimeType, 'image/') === 0) return 'images/';
        if (strpos($mimeType, 'video/') === 0) return 'videos/';
        if (strpos($mimeType, 'audio/') === 0) return 'audio/';
        return 'files/';
    }
    
    /**
     * Check for duplicate files to save storage
     */
    private function checkForDuplicate($fileHash, $userId) {
        $stmt = $this->db->prepare("
            SELECT id FROM file_uploads 
            WHERE file_hash = ? AND user_id = ? 
            LIMIT 1
        ");
        $stmt->execute([$fileHash, $userId]);
        $result = $stmt->fetch();
        
        return $result ? $result['id'] : null;
    }
    
    /**
     * Generate thumbnail for images
     */
    private function generateThumbnail($filePath, $filename) {
        try {
            $thumbnailDir = $this->uploadPath . 'thumbnails/';
            if (!is_dir($thumbnailDir)) {
                mkdir($thumbnailDir, 0755, true);
            }
            
            $thumbnailPath = $thumbnailDir . 'thumb_' . $filename;
            
            // Create thumbnail using GD or ImageMagick
            if (extension_loaded('gd')) {
                $this->createThumbnailGD($filePath, $thumbnailPath);
            } elseif (extension_loaded('imagick')) {
                $this->createThumbnailImageMagick($filePath, $thumbnailPath);
            }
            
            return file_exists($thumbnailPath) ? 'thumbnails/thumb_' . $filename : null;
        } catch (Exception $e) {
            error_log("Thumbnail generation failed: " . $e->getMessage());
            return null;
        }
    }
    
    /**
     * Create thumbnail using GD
     */
    private function createThumbnailGD($sourcePath, $thumbnailPath, $maxWidth = 200, $maxHeight = 200) {
        $imageInfo = getimagesize($sourcePath);
        if (!$imageInfo) return false;
        
        list($width, $height, $type) = $imageInfo;
        
        // Calculate thumbnail dimensions
        $ratio = min($maxWidth / $width, $maxHeight / $height);
        $thumbWidth = intval($width * $ratio);
        $thumbHeight = intval($height * $ratio);
        
        // Create source image
        $source = null;
        switch ($type) {
            case IMAGETYPE_JPEG:
                $source = imagecreatefromjpeg($sourcePath);
                break;
            case IMAGETYPE_PNG:
                $source = imagecreatefrompng($sourcePath);
                break;
            case IMAGETYPE_GIF:
                $source = imagecreatefromgif($sourcePath);
                break;
            default:
                return false;
        }
        
        if (!$source) return false;
        
        // Create thumbnail
        $thumbnail = imagecreatetruecolor($thumbWidth, $thumbHeight);
        
        // Preserve transparency for PNG and GIF
        if ($type == IMAGETYPE_PNG || $type == IMAGETYPE_GIF) {
            imagealphablending($thumbnail, false);
            imagesavealpha($thumbnail, true);
            $transparent = imagecolorallocatealpha($thumbnail, 255, 255, 255, 127);
            imagefilledrectangle($thumbnail, 0, 0, $thumbWidth, $thumbHeight, $transparent);
        }
        
        imagecopyresampled($thumbnail, $source, 0, 0, 0, 0, $thumbWidth, $thumbHeight, $width, $height);
        
        // Save thumbnail
        $result = false;
        switch ($type) {
            case IMAGETYPE_JPEG:
                $result = imagejpeg($thumbnail, $thumbnailPath, 85);
                break;
            case IMAGETYPE_PNG:
                $result = imagepng($thumbnail, $thumbnailPath, 8);
                break;
            case IMAGETYPE_GIF:
                $result = imagegif($thumbnail, $thumbnailPath);
                break;
        }
        
        // Clean up
        imagedestroy($source);
        imagedestroy($thumbnail);
        
        return $result;
    }
    
    /**
     * Create thumbnail using ImageMagick
     */
    private function createThumbnailImageMagick($sourcePath, $thumbnailPath, $maxWidth = 200, $maxHeight = 200) {
        try {
            // Check if Imagick extension is available
            if (!class_exists('Imagick')) {
                return false;
            }
            
            $imagick = new Imagick($sourcePath);
            
            // Get original dimensions
            $originalWidth = $imagick->getImageWidth();
            $originalHeight = $imagick->getImageHeight();
            
            // Calculate thumbnail dimensions
            $ratio = min($maxWidth / $originalWidth, $maxHeight / $originalHeight);
            $thumbWidth = intval($originalWidth * $ratio);
            $thumbHeight = intval($originalHeight * $ratio);
            
            // Resize image
            $imagick->resizeImage($thumbWidth, $thumbHeight, Imagick::FILTER_LANCZOS, 1);
            
            // Set compression quality
            $imagick->setImageCompressionQuality(85);
            
            // Write thumbnail
            $result = $imagick->writeImage($thumbnailPath);
            
            // Clean up
            $imagick->destroy();
            
            return $result;
            
        } catch (Exception $e) {
            error_log("ImageMagick thumbnail creation failed: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Update user storage quota
     */
    private function updateUserStorageQuota($userId) {
        try {
            $stmt = $this->db->prepare("
                UPDATE users SET 
                    storage_used = (
                        SELECT COALESCE(SUM(file_size), 0) 
                        FROM file_uploads 
                        WHERE user_id = ?
                    ),
                    updated_at = NOW()
                WHERE id = ?
            ");
            $stmt->execute([$userId, $userId]);
        } catch (Exception $e) {
            error_log("Failed to update user storage quota: " . $e->getMessage());
        }
    }
    
    /**
     * Log upload activity for monitoring
     */
    private function logUploadActivity($userId, $fileCount, $activity) {
        try {
            $stmt = $this->db->prepare("
                INSERT INTO upload_activity_log (
                    user_id, activity_type, file_count, ip_address, user_agent, created_at
                ) VALUES (?, ?, ?, ?, ?, NOW())
            ");
            $stmt->execute([
                $userId,
                $activity,
                $fileCount,
                $_SERVER['REMOTE_ADDR'] ?? 'unknown',
                $_SERVER['HTTP_USER_AGENT'] ?? 'unknown'
            ]);
        } catch (Exception $e) {
            error_log("Failed to log upload activity: " . $e->getMessage());
        }
    }
    
    /**
     * Clean up files from failed uploads
     */
    private function cleanupFailedUploads($results) {
        foreach ($results as $result) {
            if (isset($result['file_path']) && file_exists($this->uploadPath . $result['file_path'])) {
                unlink($this->uploadPath . $result['file_path']);
            }
        }
    }
    
    /**
     * Get upload error message
     */
    private function getUploadErrorMessage($errorCode) {
        $messages = [
            UPLOAD_ERR_INI_SIZE => 'File exceeds upload_max_filesize',
            UPLOAD_ERR_FORM_SIZE => 'File exceeds MAX_FILE_SIZE',
            UPLOAD_ERR_PARTIAL => 'File was only partially uploaded',
            UPLOAD_ERR_NO_FILE => 'No file was uploaded',
            UPLOAD_ERR_NO_TMP_DIR => 'Missing temporary folder',
            UPLOAD_ERR_CANT_WRITE => 'Failed to write file to disk',
            UPLOAD_ERR_EXTENSION => 'File upload stopped by extension'
        ];
        
        return $messages[$errorCode] ?? 'Unknown upload error';
    }
}
