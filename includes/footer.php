    </div>
    <!-- Page Content Ends Here -->
    
    <!-- Common Footer Content -->
    <footer class="main-footer">
        <div class="footer-container">
            <div class="footer-content">
                <div class="footer-section">
                    <h4>Quick Chat</h4>
                    <p>Secure, accessible messaging platform</p>
                </div>
                <div class="footer-section">
                    <h4>Links</h4>
                    <ul>
                        <li><a href="privacy.html">Privacy Policy</a></li>
                        <li><a href="terms.html">Terms of Service</a></li>
                        <li><a href="mailto:support@quickchat.local">Support</a></li>
                    </ul>
                </div>
                <div class="footer-section">
                    <h4>Connect</h4>
                    <div class="social-links">
                        <a href="#" aria-label="Facebook"><i class="fab fa-facebook"></i></a>
                        <a href="#" aria-label="Twitter"><i class="fab fa-twitter"></i></a>
                        <a href="#" aria-label="LinkedIn"><i class="fab fa-linkedin"></i></a>
                    </div>
                </div>
            </div>
            <div class="footer-bottom">
                <p>&copy; <?php echo date('Y'); ?> Quick Chat. All rights reserved.</p>
            </div>
        </div>
    </footer>
    
    <!-- Base JavaScript -->
    <script src="assets/js/utils.js"></script>
    <script src="assets/js/theme.js"></script>
    <script src="assets/js/accessibility.js"></script>
    <script src="assets/js/error-handler.js"></script>
    
    <!-- Additional JavaScript -->
    <?php foreach ($additionalJS as $js): ?>
        <script src="<?php echo htmlspecialchars($js); ?>"></script>
    <?php endforeach; ?>
    
    <style>
        .main-footer {
            background: #2c3e50;
            color: #ecf0f1;
            margin-top: auto;
            padding: 2rem 0 1rem;
        }
        
        .footer-container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 1rem;
        }
        
        .footer-content {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 2rem;
            margin-bottom: 2rem;
        }
        
        .footer-section h4 {
            color: #667eea;
            margin-bottom: 1rem;
        }
        
        .footer-section ul {
            list-style: none;
            padding: 0;
        }
        
        .footer-section ul li {
            margin-bottom: 0.5rem;
        }
        
        .footer-section a {
            color: #bdc3c7;
            text-decoration: none;
            transition: color 0.2s ease;
        }
        
        .footer-section a:hover {
            color: #667eea;
        }
        
        .social-links {
            display: flex;
            gap: 1rem;
        }
        
        .social-links a {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: #34495e;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s ease;
        }
        
        .social-links a:hover {
            background: #667eea;
        }
        
        .footer-bottom {
            border-top: 1px solid #34495e;
            padding-top: 1rem;
            text-align: center;
            color: #95a5a6;
        }
        
        /* Ensure body has proper layout for sticky footer */
        body {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }
        
        .page-content {
            flex: 1;
        }
    </style>
    
    <script>
        // Common functionality for all pages
        
        // Theme switching
        function initTheme() {
            const savedTheme = localStorage.getItem('theme') || 'light';
            document.documentElement.setAttribute('data-theme', savedTheme);
        }
        
        // Initialize on page load
        document.addEventListener('DOMContentLoaded', function() {
            initTheme();
            
            // Initialize accessibility features
            if (typeof initAccessibility === 'function') {
                initAccessibility();
            }
            
            // Initialize error handling
            if (typeof initErrorHandler === 'function') {
                initErrorHandler();
            }
        });
        
        // Service Worker registration
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
                navigator.serviceWorker.register('sw.js')
                    .then(function(registration) {
                        console.log('ServiceWorker registration successful');
                    })
                    .catch(function(error) {
                        console.log('ServiceWorker registration failed: ', error);
                    });
            });
        }
        
        // Auto-logout on session expiry
        let sessionCheckInterval;
        
        function startSessionCheck() {
            sessionCheckInterval = setInterval(async function() {
                try {
                    const response = await fetch('api/auth.php?action=check_session', {
                        method: 'GET',
                        credentials: 'include'
                    });
                    
                    const result = await response.json();
                    
                    if (!result.authenticated) {
                        clearInterval(sessionCheckInterval);
                        alert('Your session has expired. Please log in again.');
                        window.location.href = 'auth.php';
                    }
                } catch (error) {
                    console.error('Session check failed:', error);
                }
            }, 300000); // Check every 5 minutes
        }
        
        // Start session monitoring for authenticated pages
        <?php if ($isAuthenticated): ?>
        startSessionCheck();
        <?php endif; ?>
    </script>
</body>
</html>
