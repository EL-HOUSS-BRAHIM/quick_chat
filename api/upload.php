<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config/config.php';

// Start session after configuration is loaded
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . '/../classes/Security.php';
require_once __DIR__ . '/../classes/Message.php';
require_once __DIR__ . '/../classes/User.php';

class FileUploadAPI {
    private $security;
    private $message;
    private $user;
    private $allowedTypes;
    private $maxFileSize;
    private $uploadPaths;
    
    public function __construct() {
        $this->security = new Security();
        $this->message = new Message();
        $this->user = new User();
        
        // Configuration
        $this->maxFileSize = 10 * 1024 * 1024; // 10MB
        
        $this->allowedTypes = [
            // Images
            'image/jpeg' => ['jpg', 'jpeg'],
            'image/png' => ['png'],
            'image/gif' => ['gif'],
            'image/webp' => ['webp'],
            
            // Videos
            'video/mp4' => ['mp4'],
            'video/webm' => ['webm'],
            'video/quicktime' => ['mov'],
            
            // Audio
            'audio/mpeg' => ['mp3'],
            'audio/wav' => ['wav'],
            'audio/ogg' => ['ogg'],
            'audio/webm' => ['webm'],
            
            // Documents
            'application/pdf' => ['pdf'],
            'text/plain' => ['txt'],
            'application/msword' => ['doc'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => ['docx'],
        ];
        
        $this->uploadPaths = [
            'image' => __DIR__ . '/../uploads/images/',
            'video' => __DIR__ . '/../uploads/videos/',
            'audio' => __DIR__ . '/../uploads/audio/',
            'document' => __DIR__ . '/../uploads/files/'
        ];
        
        // Check authentication
        if (!isset($_SESSION['user_id'])) {
            $this->sendError('Authentication required', 401);
        }
        
        // Create upload directories if they don't exist
        $this->createUploadDirectories();
    }
    
    public function handleRequest() {
        try {
            $method = $_SERVER['REQUEST_METHOD'];
            
            // Rate limiting
            $this->security->rateLimitCheck($_SESSION['user_id'], 'file_upload', 10, 60);
            
            switch ($method) {
                case 'POST':
                    $this->handleUpload();
                    break;
                    
                default:
                    $this->sendError('Method not allowed', 405);
            }
            
        } catch (Exception $e) {
            $this->sendError($e->getMessage(), $e->getCode() ?: 400);
        }
    }
    
    private function handleUpload() {
        // CSRF protection
        if (!$this->security->validateCSRF($_POST['csrf_token'] ?? '')) {
            $this->sendError('Invalid CSRF token', 403);
        }
        
        if (empty($_FILES['file'])) {
            $this->sendError('No file uploaded', 400);
        }
        
        $file = $_FILES['file'];
        $uploadType = $_POST['type'] ?? 'auto'; // auto, image, video, audio, document
        
        // Validate file
        $validation = $this->validateFile($file);
        if (!$validation['valid']) {
            $this->sendError($validation['error'], 400);
        }
        
        // Determine file category
        $category = $this->determineFileCategory($validation['mime_type'], $uploadType);
        
        // Generate secure filename
        $filename = $this->generateSecureFilename($validation['original_name'], $validation['extension']);
        
        // Get upload path
        $uploadPath = $this->uploadPaths[$category];
        $filePath = $uploadPath . $filename;
        $relativePath = 'uploads/' . $category . 's/' . $filename;
        
        // Move uploaded file
        if (!move_uploaded_file($file['tmp_name'], $filePath)) {
            $this->sendError('Failed to save file', 500);
        }
        
        // Process file based on type
        $processResult = $this->processFile($filePath, $category, $validation);
        
        // Create database record
        $messageData = [
            'user_id' => $_SESSION['user_id'],
            'content' => $_POST['message'] ?? '',
            'message_type' => $category,
            'file_path' => $relativePath,
            'file_name' => $validation['original_name'],
            'file_size' => $validation['size'],
            'mime_type' => $validation['mime_type']
        ];
        
        // Add target user if specified
        if (!empty($_POST['target_user_id'])) {
            $messageData['target_user_id'] = (int)$_POST['target_user_id'];
        }
        
        // Save message with file
        $message = $this->message->sendMessage(
            $messageData['user_id'],
            $messageData['content'],
            $messageData['message_type'],
            $messageData['file_path'],
            $messageData['target_user_id'] ?? null
        );
        
        if (!$message) {
            // Clean up uploaded file on database error
            unlink($filePath);
            $this->sendError('Failed to save message', 500);
        }
        
        // Add file metadata to response
        $message['file_info'] = [
            'original_name' => $validation['original_name'],
            'size' => $validation['size'],
            'mime_type' => $validation['mime_type'],
            'category' => $category,
            'thumbnail' => $processResult['thumbnail'] ?? null,
            'duration' => $processResult['duration'] ?? null,
            'dimensions' => $processResult['dimensions'] ?? null
        ];
        
        $this->sendResponse([
            'message' => 'File uploaded successfully',
            'data' => $message
        ]);
    }
    
    private function validateFile($file) {
        $result = ['valid' => false, 'error' => ''];
        
        // Check for upload errors
        if ($file['error'] !== UPLOAD_ERR_OK) {
            $result['error'] = $this->getUploadErrorMessage($file['error']);
            return $result;
        }
        
        // Check file size
        if ($file['size'] > $this->maxFileSize) {
            $result['error'] = 'File too large. Maximum size is ' . ($this->maxFileSize / 1024 / 1024) . 'MB';
            return $result;
        }
        
        if ($file['size'] <= 0) {
            $result['error'] = 'File is empty';
            return $result;
        }
        
        // Get file info
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);
        
        // Validate MIME type
        if (!array_key_exists($mimeType, $this->allowedTypes)) {
            $result['error'] = 'File type not allowed: ' . $mimeType;
            return $result;
        }
        
        // Validate file extension
        $pathInfo = pathinfo($file['name']);
        $extension = strtolower($pathInfo['extension'] ?? '');
        
        if (!in_array($extension, $this->allowedTypes[$mimeType])) {
            $result['error'] = 'File extension does not match MIME type';
            return $result;
        }
        
        // Additional security checks
        if (!$this->security->isFileSecure($file['tmp_name'])) {
            $result['error'] = 'File failed security validation';
            return $result;
        }
        
        $result['valid'] = true;
        $result['mime_type'] = $mimeType;
        $result['extension'] = $extension;
        $result['original_name'] = $pathInfo['filename'] . '.' . $extension;
        $result['size'] = $file['size'];
        
        return $result;
    }
    
    private function determineFileCategory($mimeType, $requestedType) {
        if ($requestedType !== 'auto') {
            return $requestedType;
        }
        
        if (strpos($mimeType, 'image/') === 0) {
            return 'image';
        } elseif (strpos($mimeType, 'video/') === 0) {
            return 'video';
        } elseif (strpos($mimeType, 'audio/') === 0) {
            return 'audio';
        } else {
            return 'document';
        }
    }
    
    private function generateSecureFilename($originalName, $extension) {
        $baseName = pathinfo($originalName, PATHINFO_FILENAME);
        $baseName = preg_replace('/[^a-zA-Z0-9_-]/', '', $baseName);
        $baseName = substr($baseName, 0, 50); // Limit length
        
        if (empty($baseName)) {
            $baseName = 'file';
        }
        
        $timestamp = time();
        $random = bin2hex(random_bytes(8));
        
        return $baseName . '_' . $timestamp . '_' . $random . '.' . $extension;
    }
    
    private function processFile($filePath, $category, $validation) {
        $result = [];
        
        switch ($category) {
            case 'image':
                $result = $this->processImage($filePath, $validation);
                break;
                
            case 'video':
                $result = $this->processVideo($filePath, $validation);
                break;
                
            case 'audio':
                $result = $this->processAudio($filePath, $validation);
                break;
        }
        
        return $result;
    }
    
    private function processImage($filePath, $validation) {
        $result = [];
        
        try {
            // Get image dimensions
            $imageInfo = getimagesize($filePath);
            if ($imageInfo) {
                $result['dimensions'] = [
                    'width' => $imageInfo[0],
                    'height' => $imageInfo[1]
                ];
            }
            
            // Generate thumbnail for large images
            if ($imageInfo && ($imageInfo[0] > 800 || $imageInfo[1] > 600)) {
                $thumbnailPath = $this->generateImageThumbnail($filePath, $validation['mime_type']);
                if ($thumbnailPath) {
                    $result['thumbnail'] = $thumbnailPath;
                }
            }
            
            // Strip EXIF data for privacy
            $this->stripImageMetadata($filePath, $validation['mime_type']);
            
        } catch (Exception $e) {
            error_log("Image processing error: " . $e->getMessage());
        }
        
        return $result;
    }
    
    private function processVideo($filePath, $validation) {
        $result = [];
        
        // For now, just return basic info
        // In a full implementation, you might use FFmpeg to get duration, generate thumbnails, etc.
        
        return $result;
    }
    
    private function processAudio($filePath, $validation) {
        $result = [];
        
        // For now, just return basic info
        // In a full implementation, you might extract duration, metadata, etc.
        
        return $result;
    }
    
    private function generateImageThumbnail($filePath, $mimeType) {
        try {
            $thumbnailDir = dirname($filePath) . '/thumbnails/';
            if (!is_dir($thumbnailDir)) {
                mkdir($thumbnailDir, 0755, true);
            }
            
            $thumbnailPath = $thumbnailDir . 'thumb_' . basename($filePath);
            
            // Simple thumbnail generation (you might want to use a more robust library)
            $maxWidth = 300;
            $maxHeight = 200;
            
            switch ($mimeType) {
                case 'image/jpeg':
                    $source = imagecreatefromjpeg($filePath);
                    break;
                case 'image/png':
                    $source = imagecreatefrompng($filePath);
                    break;
                case 'image/gif':
                    $source = imagecreatefromgif($filePath);
                    break;
                default:
                    return null;
            }
            
            if (!$source) return null;
            
            $width = imagesx($source);
            $height = imagesy($source);
            
            $ratio = min($maxWidth / $width, $maxHeight / $height);
            $newWidth = (int)($width * $ratio);
            $newHeight = (int)($height * $ratio);
            
            $thumbnail = imagecreatetruecolor($newWidth, $newHeight);
            imagecopyresampled($thumbnail, $source, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
            
            $success = false;
            switch ($mimeType) {
                case 'image/jpeg':
                    $success = imagejpeg($thumbnail, $thumbnailPath, 85);
                    break;
                case 'image/png':
                    $success = imagepng($thumbnail, $thumbnailPath, 8);
                    break;
            }
            
            imagedestroy($source);
            imagedestroy($thumbnail);
            
            return $success ? str_replace(__DIR__ . '/../', '', $thumbnailPath) : null;
            
        } catch (Exception $e) {
            error_log("Thumbnail generation error: " . $e->getMessage());
            return null;
        }
    }
    
    private function stripImageMetadata($filePath, $mimeType) {
        // Strip EXIF data for privacy (basic implementation)
        try {
            if ($mimeType === 'image/jpeg' && function_exists('exif_read_data')) {
                // For a full implementation, you'd want to use a library like Imagick
                // to properly strip metadata while preserving image quality
            }
        } catch (Exception $e) {
            error_log("Metadata stripping error: " . $e->getMessage());
        }
    }
    
    private function createUploadDirectories() {
        foreach ($this->uploadPaths as $path) {
            if (!is_dir($path)) {
                mkdir($path, 0755, true);
            }
            
            // Create thumbnails subdirectory for images
            if (strpos($path, 'images') !== false) {
                $thumbDir = $path . 'thumbnails/';
                if (!is_dir($thumbDir)) {
                    mkdir($thumbDir, 0755, true);
                }
            }
        }
    }
    
    private function getUploadErrorMessage($errorCode) {
        switch ($errorCode) {
            case UPLOAD_ERR_INI_SIZE:
            case UPLOAD_ERR_FORM_SIZE:
                return 'File is too large';
            case UPLOAD_ERR_PARTIAL:
                return 'File upload was interrupted';
            case UPLOAD_ERR_NO_FILE:
                return 'No file was uploaded';
            case UPLOAD_ERR_NO_TMP_DIR:
                return 'Server configuration error: no temporary directory';
            case UPLOAD_ERR_CANT_WRITE:
                return 'Server configuration error: cannot write to disk';
            case UPLOAD_ERR_EXTENSION:
                return 'File upload blocked by server extension';
            default:
                return 'Unknown upload error';
        }
    }
    
    private function sendResponse($data, $statusCode = 200) {
        http_response_code($statusCode);
        echo json_encode(array_merge(['success' => true], $data));
        exit;
    }
    
    private function sendError($message, $statusCode = 400) {
        http_response_code($statusCode);
        echo json_encode([
            'success' => false,
            'error' => $message,
            'timestamp' => date('c')
        ]);
        exit;
    }
}

// Initialize and handle request
$api = new FileUploadAPI();
$api->handleRequest();
?>
