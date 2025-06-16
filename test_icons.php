<?php
// Test script to check if icon files are accessible
$icons = [
    'assets/images/icon-192.png',
    'assets/images/icon-512.png'
];

echo "<!DOCTYPE html>
<html>
<head>
    <title>Icon Test</title>
</head>
<body>
    <h1>Icon Accessibility Test</h1>";

foreach ($icons as $icon) {
    $fullPath = __DIR__ . '/' . $icon;
    $webPath = '/' . $icon;
    $exists = file_exists($fullPath);
    
    echo "<div style='margin-bottom: 20px;'>";
    echo "<h2>Icon: {$icon}</h2>";
    echo "<p>File exists: " . ($exists ? "Yes" : "No") . "</p>";
    
    if ($exists) {
        $size = filesize($fullPath);
        $perms = substr(sprintf('%o', fileperms($fullPath)), -4);
        echo "<p>File size: {$size} bytes</p>";
        echo "<p>Permissions: {$perms}</p>";
        echo "<p>Image preview:</p>";
        echo "<img src='{$icon}' alt='Icon preview' style='border: 1px solid #ccc;'>";
    } else {
        echo "<p style='color: red;'>File not found</p>";
    }
    
    echo "</div>";
}

echo "</body></html>";
?>
