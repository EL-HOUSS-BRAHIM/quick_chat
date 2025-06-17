<?php
/**
 * Dashboard - Quick Chat
 * Main dashboard redirect
 */

// Require authentication
require_once __DIR__ . '/includes/auth_check.php';
$currentUser = AuthChecker::requireAuth();

// Redirect to the modern dashboard
header('Location: dashboard-new.php');
exit();
?>
