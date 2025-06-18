<?php
require_once 'config/config.php';
require_once 'classes/Database.php';
require_once 'classes/Security.php';
require_once 'classes/Message.php';
require_once 'classes/User.php';

session_start();

// Initialize classes
$security = new Security();
$db = Database::getInstance();
$message = new Message();
$user = new User();

// Check if invite code is provided
$inviteCode = isset($_GET['code']) ? $_GET['code'] : null;

// Validate invite code
if (!$inviteCode) {
    header('Location: index.php');
    exit;
}

// Check if the invite code exists
$sql = "SELECT gi.*, g.name as group_name, g.description, g.avatar, 
               u.username as creator_username, u.display_name as creator_display_name
        FROM group_invite_links gi
        JOIN groups g ON gi.group_id = g.id
        JOIN users u ON g.created_by = u.id
        WHERE gi.invite_code = ?";
$stmt = $db->prepare($sql);
$stmt->execute([$inviteCode]);
$invite = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$invite) {
    $error = "Invalid invite link";
} else {
    // Check if invite is expired
    if ($invite['expires_at'] && strtotime($invite['expires_at']) < time()) {
        $error = "This invite link has expired";
    }
    
    // Check if invite has reached max uses
    if ($invite['max_uses'] && $invite['use_count'] >= $invite['max_uses']) {
        $error = "This invite link has reached its maximum number of uses";
    }
}

// Handle the join action
if (isset($_POST['join']) && isset($_SESSION['user_id']) && !isset($error)) {
    try {
        $group = $message->useGroupInviteLink($inviteCode, $_SESSION['user_id']);
        
        // Redirect to the group chat
        header("Location: chat.php?group=" . $group['id']);
        exit;
    } catch (Exception $e) {
        $error = $e->getMessage();
    }
}

// Get page title
$pageTitle = isset($invite) ? "Join " . htmlspecialchars($invite['group_name']) : "Join Group";

// Include header
include 'includes/header.php';
?>

<div class="container mt-5">
    <div class="row justify-content-center">
        <div class="col-md-8">
            <div class="card">
                <?php if (isset($error)): ?>
                    <div class="card-header bg-danger text-white">
                        <h4 class="mb-0">Error</h4>
                    </div>
                    <div class="card-body text-center">
                        <p class="lead"><?php echo htmlspecialchars($error); ?></p>
                        <a href="index.php" class="btn btn-primary">Return to Home</a>
                    </div>
                <?php elseif (!isset($_SESSION['user_id'])): ?>
                    <div class="card-header bg-primary text-white">
                        <h4 class="mb-0">Sign In Required</h4>
                    </div>
                    <div class="card-body text-center">
                        <p class="lead">You need to sign in to join <strong><?php echo htmlspecialchars($invite['group_name']); ?></strong></p>
                        <a href="auth.php?redirect=<?php echo urlencode('join-group.php?code=' . $inviteCode); ?>" class="btn btn-primary">Sign In</a>
                    </div>
                <?php else: ?>
                    <div class="card-header bg-primary text-white">
                        <h4 class="mb-0">Join Group</h4>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-4 text-center mb-3">
                                <?php if ($invite['avatar']): ?>
                                    <img src="<?php echo htmlspecialchars($invite['avatar']); ?>" alt="Group Avatar" class="img-fluid rounded-circle mb-3" style="max-width: 150px;">
                                <?php else: ?>
                                    <div class="group-avatar-placeholder mb-3">
                                        <?php echo strtoupper(substr($invite['group_name'], 0, 2)); ?>
                                    </div>
                                <?php endif; ?>
                            </div>
                            <div class="col-md-8">
                                <h3><?php echo htmlspecialchars($invite['group_name']); ?></h3>
                                <p class="text-muted">Created by <?php echo htmlspecialchars($invite['creator_display_name'] ?: $invite['creator_username']); ?></p>
                                
                                <?php if ($invite['description']): ?>
                                    <p><?php echo nl2br(htmlspecialchars($invite['description'])); ?></p>
                                <?php endif; ?>
                                
                                <form method="post">
                                    <input type="hidden" name="csrf_token" value="<?php echo $security->generateCSRFToken(); ?>">
                                    <button type="submit" name="join" class="btn btn-success btn-lg">Join Group</button>
                                    <a href="index.php" class="btn btn-outline-secondary">Cancel</a>
                                </form>
                            </div>
                        </div>
                    </div>
                <?php endif; ?>
            </div>
        </div>
    </div>
</div>

<?php include 'includes/footer.php'; ?>
