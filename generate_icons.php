<?php
/**
 * Simple script to generate PNG icons for the manifest
 */

// Define sizes to generate
$sizes = [192, 512];

// Source SVG code (a simple chat bubble icon)
$svgSource = <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="512" height="512">
    <rect width="24" height="24" fill="#3498db" rx="3" ry="3"/>
    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="#2980b9"/>
    <path d="M6 9h12M6 13h9" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
</svg>
SVG;

// Save the SVG to a temporary file
$tempSvg = __DIR__ . '/temp_icon.svg';
file_put_contents($tempSvg, $svgSource);

// Function to convert SVG to PNG using ImageMagick if available, or fallback to a simple colored square
function generatePng($svgPath, $outputPath, $size) {
    // Try using ImageMagick convert command if available
    $command = "convert -background none -resize {$size}x{$size} {$svgPath} {$outputPath} 2>&1";
    exec($command, $output, $returnCode);
    
    // If conversion failed or ImageMagick not available, create a simple colored PNG
    if ($returnCode !== 0) {
        // Create a simple colored square as fallback
        $image = imagecreatetruecolor($size, $size);
        $blue = imagecolorallocate($image, 52, 152, 219); // #3498db
        imagefill($image, 0, 0, $blue);
        
        // Add a simple chat bubble shape
        $darkBlue = imagecolorallocate($image, 41, 128, 185); // #2980b9
        $white = imagecolorallocate($image, 255, 255, 255);
        
        // Draw a rounded rectangle for the chat bubble
        $bubbleSize = intval($size * 0.8);
        $startX = intval(($size - $bubbleSize) / 2);
        $startY = intval(($size - $bubbleSize) / 2);
        imagefilledrectangle($image, $startX, $startY, $startX + $bubbleSize, $startY + $bubbleSize, $darkBlue);
        
        // Draw some lines to represent text
        $lineY1 = intval($size * 0.4);
        $lineY2 = intval($size * 0.6);
        $lineStartX = intval($size * 0.25);
        $lineEndX = intval($size * 0.75);
        imagesetthickness($image, intval($size * 0.03));
        imageline($image, $lineStartX, $lineY1, $lineEndX, $lineY1, $white);
        imageline($image, $lineStartX, $lineY2, $lineEndX - intval($size * 0.12), $lineY2, $white);
        
        // Save the image
        imagepng($image, $outputPath);
        imagedestroy($image);
    }
    
    return file_exists($outputPath);
}

// Generate PNGs for each size
$results = [];
foreach ($sizes as $size) {
    $outputPath = __DIR__ . "/assets/images/icon-{$size}.png";
    $success = generatePng($tempSvg, $outputPath, $size);
    $results[] = [
        'size' => $size,
        'path' => $outputPath,
        'success' => $success
    ];
}

// Remove temporary SVG
if (file_exists($tempSvg)) {
    unlink($tempSvg);
}

// Output results
echo "<!DOCTYPE html>
<html>
<head>
    <title>Icon Generator Results</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .success { color: green; }
        .error { color: red; }
        .result { margin-bottom: 20px; padding: 10px; border: 1px solid #ccc; }
        img { border: 1px solid #eee; }
    </style>
</head>
<body>
    <h1>Icon Generator Results</h1>";

foreach ($results as $result) {
    $statusClass = $result['success'] ? 'success' : 'error';
    $status = $result['success'] ? 'Successfully generated' : 'Failed to generate';
    
    echo "<div class='result'>";
    echo "<h2>{$size}x{$size} Icon</h2>";
    echo "<p class='{$statusClass}'>{$status}</p>";
    echo "<p>Path: {$result['path']}</p>";
    
    if ($result['success']) {
        $webPath = str_replace(__DIR__, '', $result['path']);
        echo "<p><img src='{$webPath}' width='{$result['size']}' height='{$result['size']}' alt='Generated icon'></p>";
    }
    
    echo "</div>";
}

echo "</body></html>";
?>
