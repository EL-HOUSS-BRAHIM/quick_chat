# Quick Chat Application

Quick Chat is a modern, real-time chat application built with PHP and JavaScript.

## New Architecture

As of June 2025, we have modernized the application architecture to follow best practices:

- **Front Controller Pattern**: All requests go through a single entry point
- **Modern Routing**: Using FastRoute for clean, maintainable routes
- **PSR-4 Autoloading**: Proper class namespacing and autoloading with Composer
- **MVC Architecture**: Separation of concerns with Models, Views, and Controllers
- **API Standardization**: Consistent API responses and versioning
- **Enhanced Security**: CSP, CSRF protection, rate limiting, and more

## Directory Structure

```
quick_chat/
├── app/                    # Application core
│   ├── controllers/        # Controller classes
│   ├── models/             # Model classes
│   ├── services/           # Service classes
│   ├── middleware/         # Middleware classes
│   ├── routes/             # Route definitions
│   └── views/              # View templates
├── api/                    # API endpoints
│   └── v1/                 # API version 1
├── assets/                 # Frontend assets
│   ├── css/                # CSS files
│   ├── js/                 # JavaScript files
│   ├── images/             # Image files
│   └── scss/               # SCSS source files
├── classes/                # Legacy classes (being migrated)
├── config/                 # Configuration files
├── public/                 # Public directory (web root)
│   ├── index.php           # Front controller
│   └── .htaccess           # Apache configuration
├── uploads/                # User uploads
├── vendor/                 # Composer dependencies
├── .env                    # Environment variables
└── composer.json           # Composer configuration
```

## Installation

1. Clone the repository
2. Run `composer install`
3. Copy `.env.example` to `.env` and configure
4. Set up your web server to point to the `public` directory
5. Ensure the `uploads` directory is writable

## Development Setup

### Requirements

- PHP 8.1+
- MySQL 8.0+
- Node.js 18+
- Composer
- npm

### Setup Steps

1. Install PHP dependencies:
   ```
   composer install
   ```

2. Install JavaScript dependencies:
   ```
   npm install
   ```

3. Build frontend assets:
   ```
   npm run build
   ```

4. For development, you can use:
   ```
   npm run dev
   ```

## API Documentation

The API is now versioned at `/api/v1/` and follows a standard response format:

```json
{
  "status": "success|error",
  "data": { ... },
  "message": "Error message if applicable",
  "errors": { ... }
}
```

Detailed API documentation is available at `/api/v1/docs`.

## Contributing

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
