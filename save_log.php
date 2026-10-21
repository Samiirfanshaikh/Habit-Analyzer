<?php
// saved_log.php - Save new habit entry for a user
// Expects POST JSON:
// {"user_id": 1, "date": "2024-01-01", "sleep": 7.5, "study": 2.0, "exercise_minutes": 30}
// Returns: {"status": "success"} (or error)

require_once 'db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse('error', null, 'Only POST allowed');
}

$input = json_decode(file_get_contents('php://input'), true);
if (json_last_error() !== JSON_ERROR_NONE) {
    sendResponse('error', null, 'Invalid JSON input');
}

$user_id = isset($input['user_id']) ? (int)$input['user_id'] : 0;
$date = $input['date'] ?? '';
$sleep = isset($input['sleep']) ? (float)$input['sleep'] : 0;
$study = isset($input['study']) ? (float)$input['study'] : 0;
$exercise_minutes = isset($input['exercise_minutes']) ? (int)$input['exercise_minutes'] : 0;

if (!$user_id || !$date || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
    sendResponse('error', null, 'Valid user_id and date (YYYY-MM-DD) required');
}
if ($sleep < 0 || $study < 0 || $exercise_minutes < 0) {
    sendResponse('error', null, 'Values cannot be negative');
}

try {
    $stmt = $pdo->prepare('INSERT INTO habits (user_id, date, sleep, study, exercise_minutes) 
                           VALUES (?, ?, ?, ?, ?)
                           ON DUPLICATE KEY UPDATE 
                           sleep = VALUES(sleep), 
                           study = VALUES(study), 
                           exercise_minutes = VALUES(exercise_minutes)');
    $stmt->execute([$user_id, $date, $sleep, $study, $exercise_minutes]);

    sendResponse('success', null, 'Log saved');
} catch (PDOException $e) {
    error_log('saved_log.php error: ' . $e->getMessage());
    sendResponse('error', null, 'Save failed: ' . $e->getMessage());
}
?>