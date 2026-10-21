<?php
// login.php - Authenticate user
// Expects POST JSON: {"email": "...", "password": "..."}
// Returns: {"status": "success", "data": {"user_id": 1}} or error

require_once 'db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse('error', null, 'Only POST allowed');
}

$input = json_decode(file_get_contents('php://input'), true);
if (json_last_error() !== JSON_ERROR_NONE) {
    sendResponse('error', null, 'Invalid JSON input');
}

$email = trim($input['email'] ?? '');
$password = $input['password'] ?? '';

if (empty($email) || empty($password)) {
    sendResponse('error', null, 'Email and password required');
}

try {
    $stmt = $pdo->prepare('SELECT id, password FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password'])) {
        sendResponse('error', null, 'Invalid email or password');
    }

    sendResponse('success', ['user_id' => (int)$user['id']], 'Login successful');
} catch (PDOException $e) {
    error_log('login.php error: ' . $e->getMessage());
    sendResponse('error', null, 'Login failed');
}
?>