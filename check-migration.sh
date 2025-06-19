#!/bin/bash
# Quick Chat JavaScript Migration Helper
# This script helps check and complete the migration of JavaScript files to the new modular architecture

echo "Quick Chat JavaScript Migration Helper"
echo "====================================="

# Base directories
JS_DIR="./assets/js"
CORE_DIR="$JS_DIR/core"
UI_DIR="$JS_DIR/ui"
FEATURES_DIR="$JS_DIR/features"
UTILS_DIR="$JS_DIR/utils"

# Create directories if they don't exist
mkdir -p "$CORE_DIR" "$UI_DIR" "$FEATURES_DIR/chat" "$FEATURES_DIR/admin" "$FEATURES_DIR/profile" "$FEATURES_DIR/webrtc" "$UTILS_DIR"

# Check for files that need to be migrated
echo -e "\nChecking for files that need to be migrated..."

# Function to check if a file exists and has a compatibility layer
check_file() {
  local file="$1"
  local path="$JS_DIR/$file"
  
  if [ -f "$path" ]; then
    if grep -q "DEPRECATED" "$path"; then
      echo "✅ $file - Has compatibility layer"
    else
      echo "❌ $file - Needs compatibility layer"
    fi
  else
    echo "❓ $file - Not found"
  fi
}

# List of files to check
FILES=(
  "accessibility.js"
  "admin-config.js"
  "app-compatibility.js"
  "app.js"
  "call-interface.js"
  "config.js"
  "emoji.js"
  "file-management.js"
  "file-optimization.js"
  "file-upload-progress.js"
  "group-chat.js"
  "message-reactions.js"
  "message-search.js"
  "private-chat.js"
  "pwa-manager.js"
  "realtime-features.js"
  "security.js"
  "user-mentions.js"
  "user-preferences.js"
  "virtual-scroll-messaging.js"
)

# Check each file
for file in "${FILES[@]}"; do
  check_file "$file"
done

# Check if module-loader.js exists
if [ -f "$JS_DIR/module-loader.js" ]; then
  echo -e "\n✅ Module loader is ready"
else
  echo -e "\n❌ Module loader is missing"
fi

# Check if main.js exists
if [ -f "$JS_DIR/main.js" ]; then
  echo -e "✅ Main entry file is ready"
else
  echo -e "❌ Main entry file is missing"
fi

echo -e "\nMigration check complete."
echo "For complete instructions, see MIGRATION-GUIDE.md"
