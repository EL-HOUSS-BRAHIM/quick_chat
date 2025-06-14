<?php
/**
 * Avatar API endpoint
 * Generates default avatars or serves uploaded avatar images
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../classes/Database.php';
require_once __DIR__ . '/../classes/Security.php';

class AvatarAPI {
    private $db;
    private $security;
    
    public function __construct() {
        $this->db = Database::getInstance();
        $this->security = new Security();
    }
    
    public function handleRequest() {
        $user = $_GET['user'] ?? '';
        $size = min((int)($_GET['size'] ?? 100), 300); // Max 300px
        
        if (empty($user)) {
            $this->sendError('User parameter required', 400);
        }
        
        try {
            // Get user info
            $userInfo = $this->db->fetch("SELECT avatar, username, display_name FROM users WHERE username = ?", [$user]);
            
            if (!$userInfo) {
                $this->generateDefaultAvatar($user, $size);
                return;
            }
            
            // If user has custom avatar, serve it
            if ($userInfo['avatar'] && file_exists($userInfo['avatar'])) {
                $this->serveAvatar($userInfo['avatar']);
                return;
            }
            
            // Generate default avatar
            $this->generateDefaultAvatar($userInfo['display_name'] ?: $userInfo['username'], $size);
            
        } catch (Exception $e) {
            error_log("Avatar API error: " . $e->getMessage());
            $this->generateDefaultAvatar($user, $size);
        }
    }
    
    private function serveAvatar($avatarPath) {
        // Get file info
        $fileInfo = pathinfo($avatarPath);
        $mimeType = $this->getMimeType($fileInfo['extension']);
        
        // Set headers
        header('Content-Type: ' . $mimeType);
        header('Content-Length: ' . filesize($avatarPath));
        header('Cache-Control: public, max-age=3600'); // Cache for 1 hour
        header('ETag: "' . md5_file($avatarPath) . '"');
        
        // Check if client has cached version
        if (isset($_SERVER['HTTP_IF_NONE_MATCH']) && 
            $_SERVER['HTTP_IF_NONE_MATCH'] === '"' . md5_file($avatarPath) . '"') {
            http_response_code(304);
            exit;
        }
        
        // Serve file
        readfile($avatarPath);
        exit;
    }
    
    private function generateDefaultAvatar($name, $size) {
        // Create image
        $image = imagecreatetruecolor($size, $size);
        
        // Generate colors based on name
        $hash = md5($name);
        $hue = hexdec(substr($hash, 0, 2)) / 255 * 360;
        $saturation = 0.7;
        $lightness = 0.6;
        
        $rgb = $this->hslToRgb($hue, $saturation, $lightness);
        $bgColor = imagecolorallocate($image, $rgb[0], $rgb[1], $rgb[2]);
        
        // Fill background
        imagefill($image, 0, 0, $bgColor);
        
        // Add initials
        $initials = $this->getInitials($name);
        $textColor = imagecolorallocate($image, 255, 255, 255);
        
        // Calculate font size and position
        $fontSize = $size * 0.4;
        
        // Try to use a built-in font or create text
        if (function_exists('imagettftext')) {
            // Use built-in font if available
            $font = 5; // Built-in font
            $textWidth = imagefontwidth($font) * strlen($initials);
            $textHeight = imagefontheight($font);
            $x = ($size - $textWidth) / 2;
            $y = ($size - $textHeight) / 2;
            
            imagestring($image, $font, $x, $y, $initials, $textColor);
        } else {
            // Fallback: create a simple pattern instead of text
            $patternColor = imagecolorallocate($image, $rgb[0] + 30, $rgb[1] + 30, $rgb[2] + 30);
            
            // Create a simple geometric pattern
            for ($i = 0; $i < 5; $i++) {
                $x1 = rand(0, $size);
                $y1 = rand(0, $size);
                $x2 = rand(0, $size);
                $y2 = rand(0, $size);
                imageline($image, $x1, $y1, $x2, $y2, $patternColor);
            }
        }
        
        // Set headers
        header('Content-Type: image/png');
        header('Cache-Control: public, max-age=86400'); // Cache for 24 hours
        header('ETag: "' . md5($name . $size) . '"');
        
        // Check if client has cached version
        if (isset($_SERVER['HTTP_IF_NONE_MATCH']) && 
            $_SERVER['HTTP_IF_NONE_MATCH'] === '"' . md5($name . $size) . '"') {
            http_response_code(304);
            imagedestroy($image);
            exit;
        }
        
        // Output image
        imagepng($image);
        imagedestroy($image);
        exit;
    }
    
    private function getInitials($name) {
        $words = explode(' ', trim($name));
        $initials = '';
        
        foreach ($words as $word) {
            if (!empty($word)) {
                $initials .= strtoupper(substr($word, 0, 1));
                if (strlen($initials) >= 2) break;
            }
        }
        
        return $initials ?: strtoupper(substr($name, 0, 2));
    }
    
    private function hslToRgb($h, $s, $l) {
        $h /= 360;
        
        if ($s == 0) {
            $r = $g = $b = $l;
        } else {
            $hue2rgb = function($p, $q, $t) {
                if ($t < 0) $t += 1;
                if ($t > 1) $t -= 1;
                if ($t < 1/6) return $p + ($q - $p) * 6 * $t;
                if ($t < 1/2) return $q;
                if ($t < 2/3) return $p + ($q - $p) * (2/3 - $t) * 6;
                return $p;
            };
            
            $q = $l < 0.5 ? $l * (1 + $s) : $l + $s - $l * $s;
            $p = 2 * $l - $q;
            
            $r = $hue2rgb($p, $q, $h + 1/3);
            $g = $hue2rgb($p, $q, $h);
            $b = $hue2rgb($p, $q, $h - 1/3);
        }
        
        return [round($r * 255), round($g * 255), round($b * 255)];
    }
    
    private function getMimeType($extension) {
        $mimeTypes = [
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'gif' => 'image/gif',
            'webp' => 'image/webp'
        ];
        
        return $mimeTypes[strtolower($extension)] ?? 'image/png';
    }
    
    private function sendError($message, $code = 400) {
        http_response_code($code);
        
        // Create error image
        $image = imagecreatetruecolor(100, 100);
        $bgColor = imagecolorallocate($image, 200, 200, 200);
        $textColor = imagecolorallocate($image, 100, 100, 100);
        
        imagefill($image, 0, 0, $bgColor);
        imagestring($image, 3, 35, 45, '?', $textColor);
        
        header('Content-Type: image/png');
        imagepng($image);
        imagedestroy($image);
        exit;
    }
}

// Handle request
$api = new AvatarAPI();
$api->handleRequest();
?>
