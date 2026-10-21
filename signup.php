<?php
// signup.php - Create a new user account
// Expects POST JSON: {"email": "...", "password": "..."}
// Returns: {"status": "success", "data": {"user_id": 1}} or {"status":"error"}

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
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    sendResponse('error', null, 'Invalid email format');
}
if (strlen($password) < 3) {
    sendResponse('error', null, 'Password too short');
}

try {
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        sendResponse('error', null, 'Email already registered');
    }

    $password_hash = password_hash($password, PASSWORD_DEFAULT);

    $stmt = $pdo->prepare('INSERT INTO users (email, password) VALUES (?, ?)');
    $stmt->execute([$email, $password_hash]);
    $user_id = (int)$pdo->lastInsertId();

    sendResponse('success', ['user_id' => $user_id], 'Account created');
} catch (PDOException $e) {
    error_log('signup.php error: ' . $e->getMessage());
    sendResponse('error', null, 'Signup failed');
}
?>