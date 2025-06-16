<?php
/**
 * Quick Chat - Main Entry Point
 * Redirects users to appropriate pages based on authentication status
 */

// Load authentication system
require_once __DIR__ . '/includes/auth_check.php';

// Handle logout request
if (isset($_GET['action']) && $_GET['action'] === 'logout') {
    AuthChecker::logout();
    header('Location: auth.php?message=logged_out');
    exit();
}

// Redirect based on authentication status
if (AuthChecker::isAuthenticated()) {
    // User is logged in, redirect to dashboard
    header('Location: dashboard.php');
    exit();
} else {
    // User is not logged in, redirect to auth page
    header('Location: auth.php');
    exit();
}
