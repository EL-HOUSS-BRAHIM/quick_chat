<?php
/**
 * File Upload Security Enhancements
 * Enhanced file upload handling with security checks
 */

class SecureFileUpload {
    private $allowedTypes = [
        // Images
        'image/jpeg' => ['jpg', 'jpeg'],
        'image/png' => ['png'],
        'image/gif' => ['gif'],
        'image/webp' => ['webp'],
        'image/svg+xml' => ['svg'],
        
        // Documents
        'application/pdf' => ['pdf'],
        'text/plain' => ['txt'],
        'application/msword' => ['doc'],
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => ['docx'],
        'application/vnd.ms-excel' => ['xls'],
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => ['xlsx'],
        'application/vnd.ms-powerpoint' => ['ppt'],
        'application/vnd.openxmlformats-officedocument.presentationml.presentation' => ['pptx'],
        
        // Audio
        'audio/mpeg' => ['mp3'],
        'audio/wav' => ['wav'],
        'audio/ogg' => ['ogg'],
        'audio/mp4' => ['m4a'],
        
        // Video
        'video/mp4' => ['mp4'],
        'video/webm' => ['webm'],
        'video/ogg' => ['ogv'],
        'video/quicktime' => ['mov'],
        
        // Archives
        'application/zip' => ['zip'],
        'application/x-rar-compressed' => ['rar'],
        'application/x-7z-compressed' => ['7z']
    ];
    
    private $maxFileSize = 10485760; // 10MB
    private $maxFilesPerUser = 50; // Per hour
    private $uploadPath;
    private $database;
    
    public function __construct($database, $uploadPath = 'uploads/') {
        $this->database = $database;
        $this->uploadPath = rtrim($uploadPath, '/') . '/';
        $this->ensureUploadDirectories();
    }
    
    /**
     * Upload file with security checks
     */
    public function uploadFile($file, $userId, $targetUserId = null) {
        try {
            // Rate limiting check
            if (!$this->checkUploadRateLimit($userId)) {
                throw new Exception('Upload rate limit exceeded. Please wait before uploading more files.');
            }
            
            // Basic file validation
            $this->validateFile($file);
            
            // Security checks
            $this->performSecurityChecks($file);
            
            // Generate secure filename
            $filename = $this->generateSecureFilename($file['name']);
            $filePath = $this->getUploadPath($file['type']) . $filename;
            $fullPath = $this->uploadPath . $filePath;
            
            // Move uploaded file
            if (!move_uploaded_file($file['tmp_name'], $fullPath)) {
                throw new Exception('Failed to save uploaded file');
            }
            
            // Set secure permissions
            chmod($fullPath, 0644);
            
            // Process file based on type
            $this->processUploadedFile($fullPath, $file['type']);
            
            // Save to database
            $fileId = $this->saveFileRecord($userId, $filename, $filePath, $file, $targetUserId);
            
            // Log upload
            $this->logUpload($userId, $fileId, $filename, $file['size']);
            
            return [
                'success' => true,
                'file_id' => $fileId,
                'filename' => $filename,
                'file_path' => $filePath,
                'file_size' => $file['size'],
                'file_type' => $file['type']
            ];
            
        } catch (Exception $e) {
            // Clean up on error
            if (isset($fullPath) && file_exists($fullPath)) {
                unlink($fullPath);
            }
            
            error_log("File upload error: " . $e->getMessage());
            throw $e;
        }
    }
    
    /**
     * Validate uploaded file
     */
    private function validateFile($file) {
        // Check for upload errors
        if ($file['error'] !== UPLOAD_ERR_OK) {
            $errors = [
                UPLOAD_ERR_INI_SIZE => 'File too large (server limit)',
                UPLOAD_ERR_FORM_SIZE => 'File too large (form limit)',
                UPLOAD_ERR_PARTIAL => 'File partially uploaded',
                UPLOAD_ERR_NO_FILE => 'No file uploaded',
                UPLOAD_ERR_NO_TMP_DIR => 'No temporary directory',
                UPLOAD_ERR_CANT_WRITE => 'Cannot write file',
                UPLOAD_ERR_EXTENSION => 'File upload stopped by extension'
            ];
            
            $errorMessage = $errors[$file['error']] ?? 'Unknown upload error';
            throw new Exception($errorMessage);
        }
        
        // Check file size
        if ($file['size'] > $this->maxFileSize) {
            throw new Exception('File size exceeds maximum allowed size of ' . $this->formatBytes($this->maxFileSize));
        }
        
        if ($file['size'] == 0) {
            throw new Exception('Empty file not allowed');
        }
        
        // Check file type
        $mimeType = $this->getMimeType($file['tmp_name']);
        if (!isset($this->allowedTypes[$mimeType])) {
            throw new Exception('File type not allowed: ' . $mimeType);
        }
        
        // Check file extension
        $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!in_array($extension, $this->allowedTypes[$mimeType])) {
            throw new Exception('File extension does not match MIME type');
        }
    }
    
    /**
     * Perform security checks
     */
    private function performSecurityChecks($file) {
        $filePath = $file['tmp_name'];
        $mimeType = $this->getMimeType($filePath);
        
        // Check for executable files
        if ($this->isExecutableFile($filePath, $file['name'])) {
            throw new Exception('Executable files are not allowed');
        }
        
        // Scan for malware (if ClamAV is available)
        if ($this->isClamAvailable()) {
            if (!$this->scanWithClamAv($filePath)) {
                throw new Exception('File failed security scan');
            }
        }
        
        // Image-specific checks
        if (strpos($mimeType, 'image/') === 0) {
            $this->validateImage($filePath, $mimeType);
        }
        
        // Document-specific checks
        if (in_array($mimeType, ['application/pdf', 'application/msword'])) {
            $this->validateDocument($filePath, $mimeType);
        }
        
        // Check file headers
        if (!$this->validateFileHeaders($filePath, $mimeType)) {
            throw new Exception('File headers do not match expected format');
        }
    }
    
    /**
     * Validate image files
     */
    private function validateImage($filePath, $mimeType) {
        // Verify it's actually an image
        $imageInfo = @getimagesize($filePath);
        if ($imageInfo === false) {
            throw new Exception('Invalid image file');
        }
        
        // Check image dimensions (prevent zip bombs)
        $maxWidth = 8000;
        $maxHeight = 8000;
        
        if ($imageInfo[0] > $maxWidth || $imageInfo[1] > $maxHeight) {
            throw new Exception("Image dimensions too large. Maximum: {$maxWidth}x{$maxHeight}");
        }
        
        // Strip EXIF data for privacy
        if ($mimeType === 'image/jpeg') {
            $this->stripExifData($filePath);
        }
        
        // SVG-specific validation
        if ($mimeType === 'image/svg+xml') {
            $this->validateSvg($filePath);
        }
    }
    
    /**
     * Validate SVG files for security
     */
    private function validateSvg($filePath) {
        $content = file_get_contents($filePath);
        
        // Check for dangerous elements/attributes
        $dangerousPatterns = [
            '/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi',
            '/on\w+\s*=/i',
            '/javascript:/i',
            '/data:.*base64/i',
            '/<iframe/i',
            '/<object/i',
            '/<embed/i',
            '/<form/i'
        ];
        
        foreach ($dangerousPatterns as $pattern) {
            if (preg_match($pattern, $content)) {
                throw new Exception('SVG file contains potentially dangerous content');
            }
        }
    }
    
    /**
     * Strip EXIF data from JPEG images
     */
    private function stripExifData($filePath) {
        try {
            $image = imagecreatefromjpeg($filePath);
            if ($image !== false) {
                imagejpeg($image, $filePath, 90);
                imagedestroy($image);
            }
        } catch (Exception $e) {
            // Log but don't fail upload if EXIF stripping fails
            error_log("Failed to strip EXIF data: " . $e->getMessage());
        }
    }
    
    /**
     * Validate document files
     */
    private function validateDocument($filePath, $mimeType) {
        // Basic size check for documents
        $maxDocSize = 50 * 1024 * 1024; // 50MB for documents
        if (filesize($filePath) > $maxDocSize) {
            throw new Exception('Document file too large');
        }
        
        // PDF-specific validation
        if ($mimeType === 'application/pdf') {
            $this->validatePdf($filePath);
        }
    }
    
    /**
     * Validate PDF files
     */
    private function validatePdf($filePath) {
        $header = file_get_contents($filePath, false, null, 0, 5);
        if ($header !== '%PDF-') {
            throw new Exception('Invalid PDF file format');
        }
    }
    
    /**
     * Check if file is executable
     */
    private function isExecutableFile($filePath, $filename) {
        $executableExtensions = [
            'exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js', 'jar',
            'app', 'deb', 'pkg', 'rpm', 'run', 'bin', 'sh', 'py', 'pl',
            'php', 'asp', 'aspx', 'jsp', 'cgi'
        ];
        
        $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        return in_array($extension, $executableExtensions);
    }
    
    /**
     * Validate file headers match MIME type
     */
    private function validateFileHeaders($filePath, $expectedMimeType) {
        $fileSignatures = [
            'image/jpeg' => ["\xFF\xD8\xFF"],
            'image/png' => ["\x89\x50\x4E\x47\x0D\x0A\x1A\x0A"],
            'image/gif' => ["GIF87a", "GIF89a"],
            'application/pdf' => ["%PDF-"],
            'application/zip' => ["PK\x03\x04", "PK\x05\x06", "PK\x07\x08"]
        ];
        
        if (!isset($fileSignatures[$expectedMimeType])) {
            return true; // No signature to check
        }
        
        $fileHeader = file_get_contents($filePath, false, null, 0, 20);
        $signatures = $fileSignatures[$expectedMimeType];
        
        foreach ($signatures as $signature) {
            if (strpos($fileHeader, $signature) === 0) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Check if ClamAV is available
     */
    private function isClamAvailable() {
        return function_exists('exec') && !empty(shell_exec('which clamscan'));
    }
    
    /**
     * Scan file with ClamAV
     */
    private function scanWithClamAv($filePath) {
        $command = 'clamscan --no-summary --infected ' . escapeshellarg($filePath);
        $output = [];
        $returnCode = 0;
        
        exec($command, $output, $returnCode);
        
        // Return code 0 = clean, 1 = infected, 2 = error
        return $returnCode === 0;
    }
    
    /**
     * Get MIME type of file
     */
    private function getMimeType($filePath) {
        if (function_exists('finfo_file')) {
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $mimeType = finfo_file($finfo, $filePath);
            finfo_close($finfo);
            return $mimeType;
        } elseif (function_exists('mime_content_type')) {
            return mime_content_type($filePath);
        } else {
            return 'application/octet-stream';
        }
    }
    
    /**
     * Generate secure filename
     */
    private function generateSecureFilename($originalName) {
        $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
        $baseName = pathinfo($originalName, PATHINFO_FILENAME);
        
        // Sanitize base name
        $baseName = preg_replace('/[^a-zA-Z0-9\-_\.]/', '_', $baseName);
        $baseName = substr($baseName, 0, 50); // Limit length
        
        // Generate unique filename
        $timestamp = time();
        $random = bin2hex(random_bytes(8));
        
        return $baseName . '_' . $timestamp . '_' . $random . '.' . $extension;
    }
    
    /**
     * Get upload path based on file type
     */
    private function getUploadPath($mimeType) {
        if (strpos($mimeType, 'image/') === 0) {
            return 'images/';
        } elseif (strpos($mimeType, 'audio/') === 0) {
            return 'audio/';
        } elseif (strpos($mimeType, 'video/') === 0) {
            return 'videos/';
        } else {
            return 'files/';
        }
    }
    
    /**
     * Process uploaded file (thumbnails, compression, etc.)
     */
    private function processUploadedFile($filePath, $mimeType) {
        if (strpos($mimeType, 'image/') === 0) {
            $this->generateImageThumbnail($filePath);
            $this->compressImage($filePath);
        } elseif (strpos($mimeType, 'video/') === 0) {
            // Generate video thumbnail if ffmpeg is available
            $this->generateVideoThumbnail($filePath);
        }
    }
    
    /**
     * Generate image thumbnail
     */
    private function generateImageThumbnail($filePath) {
        try {
            $imageInfo = getimagesize($filePath);
            if (!$imageInfo) return;
            
            $thumbnailPath = preg_replace('/\.(jpg|jpeg|png|gif)$/i', '_thumb.$1', $filePath);
            $maxSize = 200;
            
            list($width, $height) = $imageInfo;
            
            // Calculate thumbnail dimensions
            if ($width > $height) {
                $thumbWidth = $maxSize;
                $thumbHeight = intval($height * $maxSize / $width);
            } else {
                $thumbHeight = $maxSize;
                $thumbWidth = intval($width * $maxSize / $height);
            }
            
            // Create thumbnail
            $source = null;
            switch ($imageInfo[2]) {
                case IMAGETYPE_JPEG:
                    $source = imagecreatefromjpeg($filePath);
                    break;
                case IMAGETYPE_PNG:
                    $source = imagecreatefrompng($filePath);
                    break;
                case IMAGETYPE_GIF:
                    $source = imagecreatefromgif($filePath);
                    break;
            }
            
            if ($source) {
                $thumbnail = imagecreatetruecolor($thumbWidth, $thumbHeight);
                imagecopyresampled($thumbnail, $source, 0, 0, 0, 0, $thumbWidth, $thumbHeight, $width, $height);
                
                switch ($imageInfo[2]) {
                    case IMAGETYPE_JPEG:
                        imagejpeg($thumbnail, $thumbnailPath, 80);
                        break;
                    case IMAGETYPE_PNG:
                        imagepng($thumbnail, $thumbnailPath, 8);
                        break;
                    case IMAGETYPE_GIF:
                        imagegif($thumbnail, $thumbnailPath);
                        break;
                }
                
                imagedestroy($source);
                imagedestroy($thumbnail);
            }
        } catch (Exception $e) {
            error_log("Thumbnail generation failed: " . $e->getMessage());
        }
    }
    
    /**
     * Compress image if too large
     */
    private function compressImage($filePath) {
        $maxFileSize = 2 * 1024 * 1024; // 2MB
        
        if (filesize($filePath) <= $maxFileSize) {
            return;
        }
        
        try {
            $imageInfo = getimagesize($filePath);
            if (!$imageInfo) return;
            
            if ($imageInfo[2] === IMAGETYPE_JPEG) {
                $image = imagecreatefromjpeg($filePath);
                if ($image) {
                    imagejpeg($image, $filePath, 70); // Reduce quality
                    imagedestroy($image);
                }
            }
        } catch (Exception $e) {
            error_log("Image compression failed: " . $e->getMessage());
        }
    }
    
    /**
     * Generate video thumbnail
     */
    private function generateVideoThumbnail($filePath) {
        if (!function_exists('exec')) return;
        
        $thumbnailPath = preg_replace('/\.[^.]+$/', '_thumb.jpg', $filePath);
        $command = 'ffmpeg -i ' . escapeshellarg($filePath) . ' -ss 00:00:01 -vframes 1 -y ' . escapeshellarg($thumbnailPath) . ' 2>/dev/null';
        
        exec($command);
    }
    
    /**
     * Check upload rate limit
     */
    private function checkUploadRateLimit($userId) {
        $stmt = $this->database->prepare("
            SELECT COUNT(*) as upload_count 
            FROM file_uploads 
            WHERE user_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
        ");
        
        if (!$stmt) {
            return true; // Allow if query fails
        }
        
        $stmt->bind_param("i", $userId);
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();
        
        return $row['upload_count'] < $this->maxFilesPerUser;
    }
    
    /**
     * Save file record to database
     */
    private function saveFileRecord($userId, $filename, $filePath, $fileInfo, $targetUserId = null) {
        $stmt = $this->database->prepare("
            INSERT INTO file_uploads (user_id, target_user_id, filename, file_path, file_size, mime_type, created_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW())
        ");
        
        $stmt->bind_param("iissss", 
            $userId, 
            $targetUserId, 
            $filename, 
            $filePath, 
            $fileInfo['size'], 
            $fileInfo['type']
        );
        
        $stmt->execute();
        return $this->database->insert_id;
    }
    
    /**
     * Log upload activity
     */
    private function logUpload($userId, $fileId, $filename, $fileSize) {
        error_log("File upload: User {$userId} uploaded {$filename} ({$this->formatBytes($fileSize)}) - File ID: {$fileId}");
    }
    
    /**
     * Ensure upload directories exist
     */
    private function ensureUploadDirectories() {
        $directories = [
            $this->uploadPath,
            $this->uploadPath . 'images/',
            $this->uploadPath . 'audio/',
            $this->uploadPath . 'videos/',
            $this->uploadPath . 'files/'
        ];
        
        foreach ($directories as $dir) {
            if (!is_dir($dir)) {
                mkdir($dir, 0755, true);
            }
        }
        
        // Create .htaccess for security
        $htaccessContent = "
# Deny direct access to uploaded files
<Files *>
    Order Deny,Allow
    Deny from all
</Files>

# Allow access to images, audio, video
<FilesMatch '\.(jpg|jpeg|png|gif|webp|svg|mp3|wav|ogg|m4a|mp4|webm|ogv|mov)$'>
    Order Allow,Deny
    Allow from all
</FilesMatch>

# Prevent execution of scripts
AddHandler cgi-script .php .pl .py .jsp .asp .sh .cgi
Options -ExecCGI
";
        
        file_put_contents($this->uploadPath . '.htaccess', $htaccessContent);
    }
    
    /**
     * Format bytes for display
     */
    private function formatBytes($bytes, $precision = 2) {
        $units = array('B', 'KB', 'MB', 'GB', 'TB');
        
        for ($i = 0; $bytes > 1024 && $i < count($units) - 1; $i++) {
            $bytes /= 1024;
        }
        
        return round($bytes, $precision) . ' ' . $units[$i];
    }
    
    /**
     * Delete file and cleanup
     */
    public function deleteFile($fileId, $userId) {
        $stmt = $this->database->prepare("
            SELECT file_path FROM file_uploads 
            WHERE id = ? AND user_id = ?
        ");
        
        $stmt->bind_param("ii", $fileId, $userId);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($row = $result->fetch_assoc()) {
            $filePath = $this->uploadPath . $row['file_path'];
            
            // Delete file and thumbnail
            if (file_exists($filePath)) {
                unlink($filePath);
            }
            
            $thumbnailPath = preg_replace('/\.([^.]+)$/', '_thumb.$1', $filePath);
            if (file_exists($thumbnailPath)) {
                unlink($thumbnailPath);
            }
            
            // Delete from database
            $stmt = $this->database->prepare("DELETE FROM file_uploads WHERE id = ?");
            $stmt->bind_param("i", $fileId);
            $stmt->execute();
            
            return true;
        }
        
        return false;
    }
}
