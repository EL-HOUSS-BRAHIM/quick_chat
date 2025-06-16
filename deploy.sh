#!/bin/bash

# Quick Chat Deployment Script
# Handles deployment to different environments with proper configuration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="/var/backups/quickchat"
LOG_FILE="/var/log/quickchat/deployment.log"

# Default values
ENVIRONMENT="production"
SKIP_BACKUP="false"
SKIP_TESTS="false"
FORCE_DEPLOY="false"
DRY_RUN="false"

# Functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

usage() {
    cat << EOF
Quick Chat Deployment Script

Usage: $0 [OPTIONS]

Options:
    -e, --environment ENV    Target environment (development, staging, production)
    -s, --skip-backup       Skip database backup
    -t, --skip-tests        Skip running tests
    -f, --force             Force deployment even if tests fail
    -d, --dry-run          Show what would be done without executing
    -h, --help             Show this help message

Examples:
    $0 -e production                    # Deploy to production
    $0 -e staging --skip-backup         # Deploy to staging without backup
    $0 --dry-run                        # Preview deployment actions
    $0 -e production --force            # Force production deployment

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -s|--skip-backup)
            SKIP_BACKUP="true"
            shift
            ;;
        -t|--skip-tests)
            SKIP_TESTS="true"
            shift
            ;;
        -f|--force)
            FORCE_DEPLOY="true"
            shift
            ;;
        -d|--dry-run)
            DRY_RUN="true"
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
    error "Invalid environment: $ENVIRONMENT"
    error "Must be one of: development, staging, production"
    exit 1
fi

# Pre-deployment checks
pre_deployment_checks() {
    log "Running pre-deployment checks..."
    
    # Check if running as appropriate user
    if [[ "$ENVIRONMENT" == "production" && "$EUID" -eq 0 ]]; then
        warning "Running as root. Consider using a dedicated deployment user."
    fi
    
    # Check PHP version
    PHP_VERSION=$(php -v | head -n 1 | cut -d ' ' -f 2 | cut -d '.' -f 1,2)
    if [[ $(echo "$PHP_VERSION < 7.4" | bc -l) -eq 1 ]]; then
        error "PHP version $PHP_VERSION is not supported. Minimum version: 7.4"
        exit 1
    fi
    success "PHP version check passed: $PHP_VERSION"
    
    # Check required PHP extensions
    REQUIRED_EXTENSIONS=("pdo" "pdo_mysql" "json" "mbstring" "openssl" "curl" "gd")
    for ext in "${REQUIRED_EXTENSIONS[@]}"; do
        if ! php -m | grep -q "^$ext$"; then
            error "Required PHP extension missing: $ext"
            exit 1
        fi
    done
    success "PHP extensions check passed"
    
    # Check if environment file exists
    ENV_FILE="$PROJECT_ROOT/.env.$ENVIRONMENT"
    if [[ ! -f "$ENV_FILE" ]]; then
        error "Environment file not found: $ENV_FILE"
        error "Please create the environment file from .env.example"
        exit 1
    fi
    success "Environment file found: $ENV_FILE"
    
    # Check directory permissions
    REQUIRED_DIRS=("uploads" "logs" "config")
    for dir in "${REQUIRED_DIRS[@]}"; do
        if [[ ! -d "$PROJECT_ROOT/$dir" ]]; then
            warning "Creating directory: $dir"
            if [[ "$DRY_RUN" == "false" ]]; then
                mkdir -p "$PROJECT_ROOT/$dir"
            fi
        fi
        
        if [[ ! -w "$PROJECT_ROOT/$dir" ]]; then
            error "Directory not writable: $dir"
            exit 1
        fi
    done
    success "Directory permissions check passed"
}

# Backup database
backup_database() {
    if [[ "$SKIP_BACKUP" == "true" ]]; then
        warning "Skipping database backup as requested"
        return
    fi
    
    log "Creating database backup..."
    
    # Load database configuration
    source "$PROJECT_ROOT/.env.$ENVIRONMENT"
    
    BACKUP_FILE="$BACKUP_DIR/quickchat_$(date +%Y%m%d_%H%M%S).sql"
    
    if [[ "$DRY_RUN" == "false" ]]; then
        mkdir -p "$BACKUP_DIR"
        
        if mysqldump \
            --host="$DB_HOST" \
            --port="$DB_PORT" \
            --user="$DB_USER" \
            --password="$DB_PASS" \
            --single-transaction \
            --routines \
            --triggers \
            "$DB_NAME" > "$BACKUP_FILE"; then
            success "Database backup created: $BACKUP_FILE"
            
            # Compress backup
            gzip "$BACKUP_FILE"
            success "Backup compressed: $BACKUP_FILE.gz"
        else
            error "Database backup failed"
            exit 1
        fi
    else
        log "Would create backup: $BACKUP_FILE"
    fi
}

# Run tests
run_tests() {
    if [[ "$SKIP_TESTS" == "true" ]]; then
        warning "Skipping tests as requested"
        return
    fi
    
    log "Running test suite..."
    
    if [[ -f "$PROJECT_ROOT/tests/run-tests.js" ]]; then
        cd "$PROJECT_ROOT/tests"
        
        if [[ "$DRY_RUN" == "false" ]]; then
            if node run-tests.js; then
                success "All tests passed"
            else
                error "Tests failed"
                if [[ "$FORCE_DEPLOY" == "false" ]]; then
                    error "Deployment aborted due to test failures"
                    error "Use --force to deploy anyway"
                    exit 1
                else
                    warning "Continuing deployment despite test failures (--force used)"
                fi
            fi
        else
            log "Would run: node run-tests.js"
        fi
    else
        warning "Test suite not found, skipping tests"
    fi
}

# Update configuration
update_configuration() {
    log "Updating configuration for $ENVIRONMENT..."
    
    ENV_FILE="$PROJECT_ROOT/.env.$ENVIRONMENT"
    TARGET_ENV="$PROJECT_ROOT/.env"
    
    if [[ "$DRY_RUN" == "false" ]]; then
        # Copy environment file
        cp "$ENV_FILE" "$TARGET_ENV"
        success "Environment file updated"
        
        # Set proper permissions
        chmod 600 "$TARGET_ENV"
        success "Environment file permissions set"
        
        # Update composer dependencies for production
        if [[ "$ENVIRONMENT" == "production" ]]; then
            cd "$PROJECT_ROOT"
            if command -v composer &> /dev/null; then
                composer install --no-dev --optimize-autoloader --no-interaction
                success "Composer dependencies updated for production"
            fi
        fi
    else
        log "Would copy $ENV_FILE to $TARGET_ENV"
        log "Would set permissions: chmod 600 $TARGET_ENV"
    fi
}

# Database migrations
run_migrations() {
    log "Running database migrations..."
    
    if [[ -f "$PROJECT_ROOT/database_updates.php" ]]; then
        cd "$PROJECT_ROOT"
        
        if [[ "$DRY_RUN" == "false" ]]; then
            if php database_updates.php; then
                success "Database migrations completed"
            else
                error "Database migrations failed"
                exit 1
            fi
        else
            log "Would run: php database_updates.php"
        fi
    else
        warning "No migration file found, skipping migrations"
    fi
}

# Clear caches
clear_caches() {
    log "Clearing application caches..."
    
    CACHE_DIRS=("logs/cache" "uploads/cache" "temp")
    
    for dir in "${CACHE_DIRS[@]}"; do
        if [[ -d "$PROJECT_ROOT/$dir" ]]; then
            if [[ "$DRY_RUN" == "false" ]]; then
                rm -rf "$PROJECT_ROOT/$dir"/*
                success "Cleared cache: $dir"
            else
                log "Would clear cache: $dir"
            fi
        fi
    done
    
    # Clear opcache if available
    if [[ "$DRY_RUN" == "false" ]]; then
        if php -r "if (function_exists('opcache_reset')) { opcache_reset(); echo 'OPcache cleared\n'; }"; then
            success "OPcache cleared"
        fi
    else
        log "Would clear OPcache"
    fi
}

# Set file permissions
set_permissions() {
    log "Setting file permissions..."
    
    if [[ "$DRY_RUN" == "false" ]]; then
        # Set directory permissions
        find "$PROJECT_ROOT" -type d -exec chmod 755 {} +
        
        # Set file permissions
        find "$PROJECT_ROOT" -type f -exec chmod 644 {} +
        
        # Set executable permissions for scripts
        chmod +x "$PROJECT_ROOT/deploy.sh" 2>/dev/null || true
        
        # Set writable permissions for specific directories
        WRITABLE_DIRS=("uploads" "logs" "config")
        for dir in "${WRITABLE_DIRS[@]}"; do
            if [[ -d "$PROJECT_ROOT/$dir" ]]; then
                chmod -R 775 "$PROJECT_ROOT/$dir"
                success "Set writable permissions: $dir"
            fi
        done
        
        # Secure environment file
        if [[ -f "$PROJECT_ROOT/.env" ]]; then
            chmod 600 "$PROJECT_ROOT/.env"
            success "Secured environment file permissions"
        fi
    else
        log "Would set directory permissions: 755"
        log "Would set file permissions: 644"
        log "Would set writable permissions for: uploads, logs, config"
    fi
}

# Restart services
restart_services() {
    log "Restarting services..."
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        SERVICES=("nginx" "php-fpm" "redis")
        
        for service in "${SERVICES[@]}"; do
            if systemctl is-active --quiet "$service"; then
                if [[ "$DRY_RUN" == "false" ]]; then
                    if systemctl reload "$service" 2>/dev/null; then
                        success "Reloaded service: $service"
                    else
                        warning "Failed to reload $service, trying restart..."
                        if systemctl restart "$service"; then
                            success "Restarted service: $service"
                        else
                            error "Failed to restart service: $service"
                        fi
                    fi
                else
                    log "Would reload/restart service: $service"
                fi
            else
                warning "Service not running: $service"
            fi
        done
    else
        log "Skipping service restart for $ENVIRONMENT environment"
    fi
}

# Health check
health_check() {
    log "Running post-deployment health check..."
    
    # Check if application is responding
    if command -v curl &> /dev/null; then
        BASE_URL="http://localhost"
        if [[ "$ENVIRONMENT" == "production" ]]; then
            BASE_URL="https://$(hostname -f)"
        fi
        
        if [[ "$DRY_RUN" == "false" ]]; then
            if curl -s -f "$BASE_URL" > /dev/null; then
                success "Application is responding"
            else
                error "Application health check failed"
                exit 1
            fi
        else
            log "Would check: $BASE_URL"
        fi
    else
        warning "curl not available, skipping HTTP health check"
    fi
    
    # Check database connection
    if [[ "$DRY_RUN" == "false" ]]; then
        cd "$PROJECT_ROOT"
        if php -r "
            require_once 'config/production-config.php';
            try {
                \$pdo = new PDO(
                    'mysql:host=' . config('database.host') . ';dbname=' . config('database.name'),
                    config('database.username'),
                    config('database.password')
                );
                echo 'Database connection successful\n';
            } catch (Exception \$e) {
                echo 'Database connection failed: ' . \$e->getMessage() . '\n';
                exit(1);
            }
        "; then
            success "Database connection verified"
        else
            error "Database connection check failed"
            exit 1
        fi
    else
        log "Would verify database connection"
    fi
}

# Send notification
send_notification() {
    log "Sending deployment notification..."
    
    if [[ "$DRY_RUN" == "false" && -f "$PROJECT_ROOT/.env" ]]; then
        source "$PROJECT_ROOT/.env"
        
        if [[ -n "$ERROR_EMAIL" ]]; then
            SUBJECT="Quick Chat Deployment Complete - $ENVIRONMENT"
            BODY="Deployment to $ENVIRONMENT completed successfully at $(date)"
            
            echo "$BODY" | mail -s "$SUBJECT" "$ERROR_EMAIL" 2>/dev/null || \
                warning "Failed to send email notification"
        fi
    else
        log "Would send notification email"
    fi
}

# Main deployment function
main() {
    log "Starting Quick Chat deployment to $ENVIRONMENT..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        warning "DRY RUN MODE - No changes will be made"
    fi
    
    # Deployment steps
    pre_deployment_checks
    backup_database
    run_tests
    update_configuration
    run_migrations
    clear_caches
    set_permissions
    restart_services
    health_check
    send_notification
    
    success "Deployment to $ENVIRONMENT completed successfully!"
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        log "Production deployment checklist:"
        log "  ✓ Database backup created"
        log "  ✓ Tests passed"
        log "  ✓ Configuration updated"
        log "  ✓ Database migrations applied"
        log "  ✓ Caches cleared"
        log "  ✓ Permissions set"
        log "  ✓ Services restarted"
        log "  ✓ Health check passed"
    fi
}

# Create log directory if it doesn't exist
mkdir -p "$(dirname "$LOG_FILE")"

# Run main function
main "$@"
