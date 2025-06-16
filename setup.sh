#!/bin/bash

# Quick Chat Setup Script
# This script helps set up the Quick Chat application

echo "🚀 Quick Chat Setup Script"
echo "=========================="

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo "❌ Please don't run this script as root"
    exit 1
fi

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p uploads/{avatars,files,images,videos,audio}
mkdir -p logs
mkdir -p certs

# Set permissions
echo "🔒 Setting permissions..."
chmod 755 uploads/
chmod 755 uploads/{avatars,files,images,videos,audio}
chmod 755 logs/
chmod 755 certs/

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "⚙️  Creating .env file..."
    cp .env.sample .env
    echo "✅ .env file created. Please edit it with your configuration."
else
    echo "ℹ️  .env file already exists."
fi

# Generate random keys for .env if not set
echo "🔑 Generating security keys..."
ENCRYPTION_KEY=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)
PASSWORD_PEPPER=$(openssl rand -hex 32)

# Update .env with generated keys (only if they're still default)
if grep -q "your-32-character-encryption-key-here" .env; then
    sed -i "s/your-32-character-encryption-key-here/$ENCRYPTION_KEY/g" .env
    echo "✅ Generated encryption key"
fi

if grep -q "your-jwt-secret-key-here" .env; then
    sed -i "s/your-jwt-secret-key-here/$JWT_SECRET/g" .env
    echo "✅ Generated JWT secret"
fi

if grep -q "your-password-pepper-here" .env; then
    sed -i "s/your-password-pepper-here/$PASSWORD_PEPPER/g" .env
    echo "✅ Generated password pepper"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your database and OAuth credentials"
echo "2. Run: php setup_db.php to create database tables"
echo "3. Configure your web server to point to this directory"
echo "4. Set up Google OAuth:"
echo "   - Go to https://console.developers.google.com/"
echo "   - Create a new project or select existing"
echo "   - Enable Google+ API"
echo "   - Create OAuth 2.0 credentials"
echo "   - Add authorized redirect URI: http://yourdomain.com/quick_chat/auth.php?action=google_callback"
echo "   - Update GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env"
echo ""
echo "5. (Optional) Set up Facebook OAuth:"
echo "   - Go to https://developers.facebook.com/"
echo "   - Create a new app"
echo "   - Add Facebook Login product"
echo "   - Add redirect URI: http://yourdomain.com/quick_chat/auth.php?action=facebook_callback"
echo "   - Update FACEBOOK_CLIENT_ID and FACEBOOK_CLIENT_SECRET in .env"
echo ""
echo "For more information, see README.md"
