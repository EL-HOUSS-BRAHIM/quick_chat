<?php
/**
 * Google SSO Implementation for Quick Chat
 * Handles Google OAuth2 authentication
 */

class GoogleSSO {
    private $clientId;
    private $clientSecret;
    private $redirectUri;
    private $scope;
    
    public function __construct() {
        $this->clientId = Config::getGoogleClientId();
        $this->clientSecret = Config::getGoogleClientSecret();
        $this->redirectUri = Config::getSiteUrl() . '/auth.php?action=google_callback';
        $this->scope = 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';
    }
    
    /**
     * Generate Google OAuth2 login URL
     */
    public function getLoginUrl($state = null) {
        if (!$this->clientId) {
            throw new Exception('Google Client ID not configured');
        }
        
        $params = [
            'client_id' => $this->clientId,
            'redirect_uri' => $this->redirectUri,
            'scope' => $this->scope,
            'response_type' => 'code',
            'access_type' => 'offline',
            'prompt' => 'consent'
        ];
        
        if ($state) {
            $params['state'] = $state;
        }
        
        return 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query($params);
    }
    
    /**
     * Exchange authorization code for access token
     */
    public function getAccessToken($code) {
        if (!$this->clientId || !$this->clientSecret) {
            throw new Exception('Google OAuth credentials not configured');
        }
        
        $data = [
            'client_id' => $this->clientId,
            'client_secret' => $this->clientSecret,
            'redirect_uri' => $this->redirectUri,
            'grant_type' => 'authorization_code',
            'code' => $code
        ];
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, 'https://oauth2.googleapis.com/token');
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/x-www-form-urlencoded',
            'Accept: application/json'
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        
        if (curl_error($ch)) {
            throw new Exception('cURL error: ' . curl_error($ch));
        }
        
        curl_close($ch);
        
        if ($httpCode !== 200) {
            throw new Exception('Token exchange failed with HTTP code: ' . $httpCode);
        }
        
        $tokenData = json_decode($response, true);
        
        if (!$tokenData || isset($tokenData['error'])) {
            throw new Exception('Token exchange failed: ' . ($tokenData['error_description'] ?? 'Unknown error'));
        }
        
        return $tokenData;
    }
    
    /**
     * Get user info from Google API
     */
    public function getUserInfo($accessToken) {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, 'https://www.googleapis.com/oauth2/v2/userinfo');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $accessToken,
            'Accept: application/json'
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        
        if (curl_error($ch)) {
            throw new Exception('cURL error: ' . curl_error($ch));
        }
        
        curl_close($ch);
        
        if ($httpCode !== 200) {
            throw new Exception('Failed to get user info with HTTP code: ' . $httpCode);
        }
        
        $userInfo = json_decode($response, true);
        
        if (!$userInfo || isset($userInfo['error'])) {
            throw new Exception('Failed to get user info: ' . ($userInfo['error']['message'] ?? 'Unknown error'));
        }
        
        return $userInfo;
    }
    
    /**
     * Handle Google OAuth callback
     */
    public function handleCallback($code, $state = null) {
        try {
            // Exchange code for access token
            $tokenData = $this->getAccessToken($code);
            
            // Get user info
            $userInfo = $this->getUserInfo($tokenData['access_token']);
            
            // Create or update user in database
            $user = new User();
            $existingUser = $user->getUserByEmail($userInfo['email']);
            
            if ($existingUser) {
                // Update existing user
                $userId = $existingUser['id'];
                $user->updateGoogleSSO($userId, $userInfo['id'], $userInfo);
            } else {
                // Create new user
                $userData = [
                    'username' => $this->generateUsername($userInfo['email']),
                    'email' => $userInfo['email'],
                    'display_name' => $userInfo['name'] ?? $userInfo['email'],
                    'google_id' => $userInfo['id'],
                    'avatar_url' => $userInfo['picture'] ?? null,
                    'email_verified' => true,
                    'created_via' => 'google_sso'
                ];
                
                $userId = $user->createUserFromSSO($userData);
            }
            
            // Create session
            $sessionData = $user->createSession($userId, 'google_sso');
            
            // Set session variables
            $_SESSION['user_id'] = $userId;
            $_SESSION['session_id'] = $sessionData['session_id'];
            $_SESSION['login_method'] = 'google_sso';
            
            // Log successful login
            error_log("Google SSO login successful for user ID: " . $userId);
            
            return [
                'success' => true,
                'user_id' => $userId,
                'redirect' => 'dashboard.php'
            ];
            
        } catch (Exception $e) {
            error_log("Google SSO error: " . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }
    
    /**
     * Generate unique username from email
     */
    private function generateUsername($email) {
        $user = new User();
        $baseUsername = strtolower(explode('@', $email)[0]);
        $baseUsername = preg_replace('/[^a-z0-9_]/', '', $baseUsername);
        
        $username = $baseUsername;
        $counter = 1;
        
        while ($user->getUserByUsername($username)) {
            $username = $baseUsername . '_' . $counter;
            $counter++;
        }
        
        return $username;
    }
    
    /**
     * Revoke Google access token
     */
    public function revokeToken($accessToken) {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, 'https://oauth2.googleapis.com/revoke');
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query(['token' => $accessToken]));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        return $httpCode === 200;
    }
}
?>
