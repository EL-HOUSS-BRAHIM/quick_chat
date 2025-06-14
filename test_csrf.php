<?php
// Simple CSRF token test
// Load configuration first (which sets session settings)
require_once __DIR__ . '/config/config.php';

// Start session after configuration is loaded
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Generate CSRF token if not exists
if (!isset($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

echo "Session ID: " . session_id() . "\n";
echo "CSRF Token in session: " . $_SESSION['csrf_token'] . "\n";
echo "Session status: " . session_status() . "\n";

if ($_POST) {
    echo "POST data received:\n";
    echo "CSRF token from POST: " . ($_POST['csrf_token'] ?? 'NOT SET') . "\n";
    echo "Tokens match: " . (isset($_SESSION['csrf_token']) && hash_equals($_SESSION['csrf_token'], $_POST['csrf_token'] ?? '') ? 'YES' : 'NO') . "\n";
}
?>

<!DOCTYPE html>
<html>
<head>
    <title>CSRF Test</title>
    <meta name="csrf-token" content="<?php echo htmlspecialchars($_SESSION['csrf_token']); ?>">
</head>
<body>
    <h1>CSRF Token Test</h1>
    
    <p>Session CSRF Token: <strong><?php echo htmlspecialchars($_SESSION['csrf_token']); ?></strong></p>
    
    <form method="POST" action="">
        <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($_SESSION['csrf_token']); ?>">
        <button type="submit">Test CSRF Token</button>
    </form>
    
    <script>
        const metaToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        console.log('Meta CSRF token:', metaToken);
        
        const hiddenToken = document.querySelector('input[name="csrf_token"]')?.value;
        console.log('Hidden input token:', hiddenToken);
    </script>
</body>
</html>
