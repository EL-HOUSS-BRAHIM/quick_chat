<?php
/**
 * Database initialization script for Quick Chat
 * Run this script once to set up the database tables
 */

require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/classes/Database.php';

echo "Quick Chat Database Setup\n";
echo "========================\n\n";

try {
    // Get database instance
    $db = Database::getInstance();
    
    echo "✓ Database connection established\n";
    
    // Create tables
    echo "Creating database tables...\n";
    $db->createTables();
    
    echo "✓ All tables created successfully\n\n";
    
    // Create upload directories
    echo "Creating upload directories...\n";
    
    $directories = [
        Config::getUploadPath(),
        Config::getUploadPath() . 'images/',
        Config::getUploadPath() . 'videos/',
        Config::getUploadPath() . 'audio/',
        Config::getUploadPath() . 'files/',
        Config::getAvatarPath(),
        __DIR__ . '/logs/'
    ];
    
    foreach ($directories as $dir) {
        if (!is_dir($dir)) {
            if (mkdir($dir, 0755, true)) {
                echo "✓ Created directory: $dir\n";
            } else {
                echo "✗ Failed to create directory: $dir\n";
            }
        } else {
            echo "✓ Directory exists: $dir\n";
        }
        
        // Create .htaccess file for upload directories
        if (strpos($dir, 'uploads') !== false) {
            $htaccessFile = $dir . '.htaccess';
            if (!file_exists($htaccessFile)) {
                $htaccessContent = "# Deny direct access to uploaded files\n";
                $htaccessContent .= "Options -Indexes\n";
                $htaccessContent .= "<FilesMatch \"\\.(php|phtml|php3|php4|php5|pl|py|jsp|asp|sh|cgi)$\">\n";
                $htaccessContent .= "    Order allow,deny\n";
                $htaccessContent .= "    Deny from all\n";
                $htaccessContent .= "</FilesMatch>\n";
                
                if (file_put_contents($htaccessFile, $htaccessContent)) {
                    echo "✓ Created .htaccess file in: $dir\n";
                }
            }
        }
    }
    
    // Create admin user (optional)
    echo "\nCreating admin user...\n";
    
    $adminUsername = 'admin';
    $adminEmail = 'admin@quickchat.local';
    $adminPassword = 'Admin123!'; // Change this in production
    
    try {
        require_once __DIR__ . '/classes/User.php';
        $user = new User();
        
        // Check if admin user already exists
        if (!$user->getUserByUsername($adminUsername)) {
            $adminId = $user->register($adminUsername, $adminEmail, $adminPassword);
            
            // Mark admin email as verified
            $db->query("UPDATE users SET email_verified = TRUE WHERE id = ?", [$adminId]);
            
            echo "✓ Admin user created successfully\n";
            echo "  Username: $adminUsername\n";
            echo "  Email: $adminEmail\n";
            echo "  Password: $adminPassword\n";
            echo "  ⚠️  Please change the admin password after first login!\n";
        } else {
            echo "✓ Admin user already exists\n";
        }
    } catch (Exception $e) {
        echo "✗ Failed to create admin user: " . $e->getMessage() . "\n";
    }
    
    // Create sample configuration file
    echo "\nCreating sample configuration...\n";
    
    $configSample = __DIR__ . '/config/config.sample.php';
    if (!file_exists($configSample)) {
        $sampleConfig = '<?php
// Sample configuration file for Quick Chat
// Copy this file to config.php and modify the values

class Config {
    // Database settings
    const DB_HOST = \'localhost\';
    const DB_NAME = \'quick_chat\';
    const DB_USER = \'your_db_user\';
    const DB_PASS = \'your_db_password\';
    const DB_CHARSET = \'utf8mb4\';
    
    // Security settings - CHANGE THESE IN PRODUCTION!
    const ENCRYPTION_KEY = \'change-this-encryption-key-in-production\';
    const JWT_SECRET = \'change-this-jwt-secret-in-production\';
    const PASSWORD_PEPPER = \'change-this-password-pepper-in-production\';
    
    // Application settings
    const APP_URL = \'http://localhost/quick_chat\';
    
    // Email settings (for password reset)
    const SMTP_HOST = \'smtp.gmail.com\';
    const SMTP_PORT = 587;
    const SMTP_USERNAME = \'your-email@gmail.com\';
    const SMTP_PASSWORD = \'your-app-password\';
    const FROM_EMAIL = \'noreply@quickchat.com\';
    const FROM_NAME = \'Quick Chat\';
    
    // Other methods...
    // Copy all methods from the main config.php file
}
?>';
        
        if (file_put_contents($configSample, $sampleConfig)) {
            echo "✓ Sample configuration file created\n";
        }
    }
    
    // Create README
    echo "\nCreating README file...\n";
    
    $readmeContent = "# Quick Chat - Enhanced PHP Version

## Features

- 🔐 Secure user authentication with password hashing
- 💬 Real-time messaging (polling-based)
- 📁 File upload support (images, videos, audio, documents)
- 🎤 Audio recording capability
- 😊 Emoji support
- 🔍 Message search
- 📱 Responsive design
- 🌙 Dark/Light theme support
- 🔔 Desktop notifications
- 🛡️ CSRF protection
- 📊 Rate limiting
- 🔍 SQL injection prevention
- 🎯 XSS protection
- 📝 Audit logging

## Installation

1. Set up your web server (Apache/Nginx) with PHP 7.4+
2. Create a MySQL database named 'quick_chat'
3. Import the database schema by running: `php setup.php`
4. Configure your database settings in `config/config.php`
5. Set proper permissions on the `uploads/` and `logs/` directories
6. Access the application in your web browser

## Configuration

Copy `config/config.sample.php` to `config/config.php` and update:

- Database credentials
- Encryption keys (generate secure random keys)
- Email settings for password reset
- File upload limits
- Application URL

## Security Features

- Password hashing with Argon2ID
- CSRF token protection
- Rate limiting for API endpoints
- File upload validation
- SQL injection prevention
- XSS protection with input sanitization
- Session management with secure cookies
- Audit logging for security events

## File Structure

- `index.php` - Main application file
- `config/` - Configuration files
- `classes/` - PHP classes (Database, User, Message, Security)
- `api/` - API endpoints
- `assets/` - CSS, JavaScript, and other assets
- `uploads/` - File upload directory
- `logs/` - Application logs

## Default Admin Account

- Username: admin
- Email: admin@quickchat.local
- Password: Admin123!

⚠️ **IMPORTANT**: Change the admin password immediately after first login!

## Requirements

- PHP 7.4 or higher
- MySQL 5.7 or higher
- Web server (Apache/Nginx)
- Modern web browser with JavaScript enabled

## License

This project is open source and available under the MIT License.

## Support

For support and questions, please check the documentation or create an issue.
";
    
    if (file_put_contents(__DIR__ . '/README.md', $readmeContent)) {
        echo "✓ README file created\n";
    }
    
    echo "\n" . str_repeat("=", 50) . "\n";
    echo "✅ Quick Chat setup completed successfully!\n\n";
    echo "Next steps:\n";
    echo "1. Configure your settings in config/config.php\n";
    echo "2. Change the admin password after first login\n";
    echo "3. Test the application in your web browser\n";
    echo "4. Customize the appearance and features as needed\n\n";
    echo "Admin login credentials:\n";
    echo "Username: admin\n";
    echo "Password: Admin123!\n\n";
    echo "Enjoy your enhanced Quick Chat application! 🚀\n";
    
} catch (Exception $e) {
    echo "✗ Setup failed: " . $e->getMessage() . "\n";
    echo "Please check your database configuration and try again.\n";
    exit(1);
}
?>
