<?php
// Generate default avatar image
$width = 150;
$height = 150;

// Create a new image
$image = imagecreate($width, $height);

// Set background color (light gray)
$bg_color = imagecolorallocate($image, 240, 240, 240);
$text_color = imagecolorallocate($image, 153, 153, 153);

// Fill background
imagefill($image, 0, 0, $bg_color);

// Add a simple user icon representation
$center_x = $width / 2;
$center_y = $height / 2;

// Draw head (circle)
$head_radius = 25;
imagefilledellipse($image, $center_x, $center_y - 15, $head_radius * 2, $head_radius * 2, $text_color);

// Draw body (ellipse)
$body_width = 50;
$body_height = 40;
imagefilledellipse($image, $center_x, $center_y + 25, $body_width, $body_height, $text_color);

// Save the image
$output_path = __DIR__ . '/assets/images/default-avatar.png';
imagepng($image, $output_path);
imagedestroy($image);

echo "Default avatar created at: " . $output_path . "\n";
?>
