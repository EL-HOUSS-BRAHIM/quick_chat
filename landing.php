<?php
$pageTitle = 'Quick Chat - Secure Messaging Platform';
$pageClass = 'landing-page';
$additionalCSS = [];
$additionalJS = [];

// Check if user is already logged in
require_once __DIR__ . '/includes/auth_check.php';

if (AuthChecker::isAuthenticated()) {
    header('Location: dashboard.php');
    exit();
}

$csrfToken = AuthChecker::getCSRFToken();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo htmlspecialchars($pageTitle); ?></title>
    
    <!-- Base Stylesheets -->
    <link rel="stylesheet" href="assets/css/styles.css">
    <link rel="stylesheet" href="assets/css/enhanced-chat.css">
    <link rel="stylesheet" href="assets/css/accessibility.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    
    <!-- SEO Meta Tags -->
    <meta name="description" content="Quick Chat - A secure, accessible, and feature-rich messaging platform with end-to-end encryption, real-time communication, and modern web technologies.">
    <meta name="keywords" content="secure messaging, chat app, end-to-end encryption, real-time chat, web chat, PHP chat, accessible messaging, private messaging, instant messaging, communication platform">
    <meta name="author" content="Quick Chat Team">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="<?php echo (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https://' : 'http://') . $_SERVER['HTTP_HOST'] . '/landing.php'; ?>">
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="<?php echo (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https://' : 'http://') . $_SERVER['HTTP_HOST'] . '/landing.php'; ?>">
    <meta property="og:title" content="Quick Chat - Secure Messaging Platform">
    <meta property="og:description" content="Experience secure, real-time messaging with end-to-end encryption, accessibility features, and modern web technology.">
    <meta property="og:image" content="<?php echo (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https://' : 'http://') . $_SERVER['HTTP_HOST']; ?>/assets/images/og-image.svg">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:site_name" content="Quick Chat">
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="<?php echo (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https://' : 'http://') . $_SERVER['HTTP_HOST'] . '/landing.php'; ?>">
    <meta name="twitter:title" content="Quick Chat - Secure Messaging Platform">
    <meta name="twitter:description" content="Experience secure, real-time messaging with end-to-end encryption, accessibility features, and modern web technology.">
    <meta name="twitter:image" content="<?php echo (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https://' : 'http://') . $_SERVER['HTTP_HOST']; ?>/assets/images/twitter-image.svg">
    <meta name="twitter:creator" content="@quickchat">
    
    <!-- PWA Related -->
    <meta name="theme-color" content="#667eea">
    <link rel="manifest" href="manifest.json">
    <link rel="apple-touch-icon" href="assets/images/icon-192.png">
    
    <!-- Structured Data for SEO -->
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "name": "Quick Chat",
        "description": "A secure, accessible, and feature-rich messaging platform with end-to-end encryption and real-time communication.",
        "url": "<?php echo (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https://' : 'http://') . $_SERVER['HTTP_HOST']; ?>",
        "applicationCategory": "CommunicationApplication",
        "operatingSystem": "Web Browser",
        "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD"
        },
        "author": {
            "@type": "Organization",
            "name": "Quick Chat Team"
        },
        "screenshot": "<?php echo (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https://' : 'http://') . $_SERVER['HTTP_HOST']; ?>/assets/images/screenshot1.svg"
    }
    </script>
    
    <style>
        .landing-page {
            margin: 0;
            padding: 0;
            font-family: 'Inter', sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        
        .hero-section {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            color: white;
            position: relative;
            overflow: hidden;
        }
        
        .hero-section::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.3);
            z-index: 1;
        }
        
        .hero-content {
            position: relative;
            z-index: 2;
            max-width: 800px;
            padding: 2rem;
        }
        
        .hero-title {
            font-size: 3.5rem;
            font-weight: 700;
            margin-bottom: 1rem;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
        }
        
        .hero-subtitle {
            font-size: 1.25rem;
            margin-bottom: 2rem;
            opacity: 0.9;
        }
        
        .cta-buttons {
            display: flex;
            gap: 1rem;
            justify-content: center;
            flex-wrap: wrap;
            margin-bottom: 3rem;
        }
        
        .cta-button {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 1rem 2rem;
            border: none;
            border-radius: 50px;
            font-size: 1.1rem;
            font-weight: 600;
            text-decoration: none;
            transition: all 0.3s ease;
            cursor: pointer;
        }
        
        .cta-button.primary {
            background: #fff;
            color: #667eea;
        }
        
        .cta-button.primary:hover {
            background: #f8f9fa;
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
        }
        
        .cta-button.secondary {
            background: transparent;
            color: white;
            border: 2px solid white;
        }
        
        .cta-button.secondary:hover {
            background: white;
            color: #667eea;
            transform: translateY(-2px);
        }
        
        .features-preview {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 2rem;
            margin-top: 3rem;
        }
        
        .feature-card {
            background: rgba(255, 255, 255, 0.1);
            padding: 2rem;
            border-radius: 15px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            transition: transform 0.3s ease;
        }
        
        .feature-card:hover {
            transform: translateY(-5px);
        }
        
        .feature-icon {
            font-size: 3rem;
            margin-bottom: 1rem;
            color: #fff;
        }
        
        .feature-title {
            font-size: 1.5rem;
            font-weight: 600;
            margin-bottom: 1rem;
        }
        
        .feature-description {
            opacity: 0.9;
            line-height: 1.6;
        }
        
        .stats-section {
            background: rgba(255, 255, 255, 0.1);
            padding: 3rem 2rem;
            margin-top: 4rem;
            border-radius: 20px;
            backdrop-filter: blur(10px);
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 2rem;
            text-align: center;
        }
        
        .stat-item {
            padding: 1rem;
        }
        
        .stat-number {
            font-size: 3rem;
            font-weight: 700;
            color: #fff;
            margin-bottom: 0.5rem;
        }
        
        .stat-label {
            font-size: 1.1rem;
            opacity: 0.9;
        }
        
        .floating-elements {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            pointer-events: none;
            z-index: 1;
        }
        
        .floating-element {
            position: absolute;
            color: rgba(255, 255, 255, 0.1);
            animation: float 6s ease-in-out infinite;
        }
        
        .floating-element:nth-child(1) { top: 20%; left: 10%; animation-delay: 0s; }
        .floating-element:nth-child(2) { top: 60%; right: 10%; animation-delay: 2s; }
        .floating-element:nth-child(3) { bottom: 20%; left: 20%; animation-delay: 4s; }
        .floating-element:nth-child(4) { top: 40%; right: 20%; animation-delay: 1s; }
        
        @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-20px); }
        }
        
        .scroll-indicator {
            position: absolute;
            bottom: 2rem;
            left: 50%;
            transform: translateX(-50%);
            color: white;
            animation: bounce 2s infinite;
        }
        
        @keyframes bounce {
            0%, 20%, 50%, 80%, 100% { transform: translateX(-50%) translateY(0); }
            40% { transform: translateX(-50%) translateY(-10px); }
            60% { transform: translateX(-50%) translateY(-5px); }
        }
        
        /* Responsive Design */
        @media (max-width: 768px) {
            .hero-title {
                font-size: 2.5rem;
            }
            
            .hero-subtitle {
                font-size: 1.1rem;
            }
            
            .cta-buttons {
                flex-direction: column;
                align-items: center;
            }
            
            .cta-button {
                width: 100%;
                max-width: 300px;
            }
            
            .features-preview {
                grid-template-columns: 1fr;
            }
            
            .stats-grid {
                grid-template-columns: repeat(2, 1fr);
            }
        }
        
        @media (max-width: 480px) {
            .hero-title {
                font-size: 2rem;
            }
            
            .hero-content {
                padding: 1rem;
            }
            
            .stats-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body class="landing-page">
    <div class="hero-section">
        <div class="floating-elements">
            <div class="floating-element"><i class="fas fa-comments" style="font-size: 4rem;"></i></div>
            <div class="floating-element"><i class="fas fa-shield-alt" style="font-size: 3rem;"></i></div>
            <div class="floating-element"><i class="fas fa-users" style="font-size: 3.5rem;"></i></div>
            <div class="floating-element"><i class="fas fa-lock" style="font-size: 2.5rem;"></i></div>
        </div>
        
        <div class="hero-content">
            <h1 class="hero-title">Quick Chat</h1>
            <p class="hero-subtitle">Secure, accessible, and feature-rich messaging platform with end-to-end encryption</p>
            
            <div class="cta-buttons">
                <a href="auth.php" class="cta-button primary">
                    <i class="fas fa-rocket"></i>
                    Get Started Free
                </a>
                <a href="#features" class="cta-button secondary">
                    <i class="fas fa-info-circle"></i>
                    Learn More
                </a>
            </div>
            
            <div class="features-preview" id="features">
                <div class="feature-card">
                    <div class="feature-icon">
                        <i class="fas fa-shield-alt"></i>
                    </div>
                    <h3 class="feature-title">End-to-End Encryption</h3>
                    <p class="feature-description">Your messages are encrypted and secure, ensuring complete privacy in all communications.</p>
                </div>
                
                <div class="feature-card">
                    <div class="feature-icon">
                        <i class="fas fa-bolt"></i>
                    </div>
                    <h3 class="feature-title">Real-Time Messaging</h3>
                    <p class="feature-description">Instant message delivery with live typing indicators and read receipts.</p>
                </div>
                
                <div class="feature-card">
                    <div class="feature-icon">
                        <i class="fas fa-universal-access"></i>
                    </div>
                    <h3 class="feature-title">Accessibility First</h3>
                    <p class="feature-description">Built with accessibility in mind, supporting screen readers and keyboard navigation.</p>
                </div>
                
                <div class="feature-card">
                    <div class="feature-icon">
                        <i class="fas fa-video"></i>
                    </div>
                    <h3 class="feature-title">Video & Voice Calls</h3>
                    <p class="feature-description">High-quality video and voice calls with WebRTC technology.</p>
                </div>
                
                <div class="feature-card">
                    <div class="feature-icon">
                        <i class="fas fa-mobile-alt"></i>
                    </div>
                    <h3 class="feature-title">Progressive Web App</h3>
                    <p class="feature-description">Works offline and can be installed on any device for a native app experience.</p>
                </div>
                
                <div class="feature-card">
                    <div class="feature-icon">
                        <i class="fas fa-file-upload"></i>
                    </div>
                    <h3 class="feature-title">File Sharing</h3>
                    <p class="feature-description">Share documents, images, and files securely with built-in virus scanning.</p>
                </div>
            </div>
            
            <div class="stats-section">
                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-number">99.9%</div>
                        <div class="stat-label">Uptime</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">256-bit</div>
                        <div class="stat-label">Encryption</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">24/7</div>
                        <div class="stat-label">Support</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">GDPR</div>
                        <div class="stat-label">Compliant</div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="scroll-indicator">
            <i class="fas fa-chevron-down"></i>
        </div>
    </div>
    
    <script>
        // Smooth scrolling for anchor links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
        
        // Add some interactive animations
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, observerOptions);
        
        // Observe feature cards for animation
        document.querySelectorAll('.feature-card').forEach(card => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(30px)';
            card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            observer.observe(card);
        });
        
        console.log('Quick Chat Landing Page loaded successfully');
    </script>
</body>
</html>
