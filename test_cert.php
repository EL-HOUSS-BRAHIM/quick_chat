<?php
$caPath = __DIR__ . "/.cert/ca.pem";
echo "CA Path: $caPath\n";
echo "File exists: " . (file_exists($caPath) ? "Yes" : "No") . "\n";

if (file_exists($caPath)) {
    echo "File content (first 100 chars):\n";
    echo substr(file_get_contents($caPath), 0, 100) . "...\n";
    echo "File permissions: " . substr(sprintf('%o', fileperms($caPath)), -4) . "\n";
}

echo "\nDirectory listing of .cert folder:\n";
$cert_dir = __DIR__ . "/.cert";
if (is_dir($cert_dir)) {
    $files = scandir($cert_dir);
    foreach ($files as $file) {
        if ($file == "." || $file == "..") continue;
        echo "- $file (size: " . filesize("$cert_dir/$file") . " bytes)\n";
    }
} else {
    echo "Directory does not exist!\n";
}
?>
