<?php
// Sample configuration file for Quick Chat
// Copy this file to config.php and modify the values

class Config {
    // Database settings
    const DB_HOST = 'localhost';
    const DB_NAME = 'quick_chat';
    const DB_USER = 'your_db_user';
    const DB_PASS = 'your_db_password';
    const DB_CHARSET = 'utf8mb4';
    
    // Security settings - CHANGE THESE IN PRODUCTION!
    const ENCRYPTION_KEY = 'change-this-encryption-key-in-production';
    const JWT_SECRET = 'change-this-jwt-secret-in-production';
    const PASSWORD_PEPPER = 'change-this-password-pepper-in-production';
    
    // Application settings
    const APP_URL = 'http://localhost/quick_chat';
    
    // Email settings (for password reset)
    const SMTP_HOST = 'smtp.gmail.com';
    const SMTP_PORT = 587;
    const SMTP_USERNAME = 'your-email@gmail.com';
    const SMTP_PASSWORD = 'your-app-password';
    const FROM_EMAIL = 'noreply@quickchat.com';
    const FROM_NAME = 'Quick Chat';
    
    // Other methods...
    // Copy all methods from the main config.php file
}
?>