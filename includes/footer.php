</main>

<!-- Global JavaScript -->
<script src="assets/js/app.js"></script>
<script src="assets/js/security.js"></script>
<script src="assets/js/pwa-manager.js"></script>

<!-- Module Loader (New Architecture) -->
<script src="assets/js/module-loader.js"></script>

<!-- Additional JavaScript -->
<?php if (isset($additionalJS) && is_array($additionalJS)): ?>
    <?php foreach ($additionalJS as $js): ?>
        <script src="<?php echo htmlspecialchars($js); ?>"></script>
    <?php endforeach; ?>
<?php endif; ?>

<!-- Service Worker Registration -->
<script>
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js')
            .then(function(registration) {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            }, function(err) {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}
</script>

<!-- Global Configuration -->
<script>
window.quickChatConfig = {
    csrfToken: '<?php echo $_SESSION['csrf_token'] ?? ''; ?>',
    userId: <?php echo json_encode($_SESSION['user_id'] ?? null); ?>,
    username: '<?php echo htmlspecialchars($currentUser['username'] ?? '', ENT_QUOTES); ?>',
    apiBase: '/api',
    websocketUrl: '<?php echo Config::isWebSocketEnabled() ? 'ws://' . Config::getWebSocketHost() . ':' . Config::getWebSocketPort() : ''; ?>',
    maxFileSize: <?php echo Config::getMaxFileSize(); ?>,
    features: {
        websocket: <?php echo Config::isWebSocketEnabled() ? 'true' : 'false'; ?>,
        voiceCall: <?php echo Config::isFeatureEnabled('VOICE_CALL') ? 'true' : 'false'; ?>,
        videoCall: <?php echo Config::isFeatureEnabled('VIDEO_CALL') ? 'true' : 'false'; ?>,
        fileUpload: <?php echo Config::isFeatureEnabled('FILE_UPLOAD') ? 'true' : 'false'; ?>
    }
};
</script>

</body>
</html>
