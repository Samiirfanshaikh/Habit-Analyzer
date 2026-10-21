<?php
// get_logs.php - Get all habit logs for a user
// Expects POST JSON: {"user_id": 1}
// Returns: {"status": "success", "data": {"logs": [...]}} or error

require_once 'db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse('error', null, 'Only POST allowed');
}

$input = json_decode(file_get_contents('php://input'), true);
if (json_last_error() !== JSON_ERROR_NONE) {
    sendResponse('error', null, 'Invalid JSON input');
}

$user_id = isset($input['user_id']) ? (int)$input['user_id'] : 0;

if (!$user_id) {
    sendResponse('error', null, 'user_id required');
}

try {
    $stmt = $pdo->prepare('SELECT date, sleep, study, exercise_minutes FROM habits WHERE user_id = ? ORDER BY date DESC');
    $stmt->execute([$user_id]);
    $logs = $stmt->fetchAll();

    sendResponse('success', ['logs' => $logs], 'Logs fetched');
} catch (PDOException $e) {
    error_log('get_logs.php error: ' . $e->getMessage());
    sendResponse('error', null, 'Fetch failed');
}
?>