<?php
// db.php - Database connection
error_reporting(E_ALL);
ini_set('display_errors', 1); // SHOW THE ERROR so we can fix it!
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

$host = 'localhost';
$dbname = 'habit_tracker';
$username = 'root';
$password = '';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$dbname;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $username, $password, $options);
} catch (PDOException $e) {
    if (!headers_sent()) {
        header('Content-Type: application/json');
    }
    echo json_encode(['status' => 'error', 'message' => 'Database connection failed']);
    exit;
}

// Send a consistent JSON response
function sendResponse($status, $data = null, $message = '') {
    if (!headers_sent()) {
        header('Content-Type: application/json');
    }
    $response = ['status' => $status];
    if ($data !== null && $data !== []) {
        $response['data'] = $data;
    }
    if ($message !== '') {
        $response['message'] = $message;
    }
    echo json_encode($response);
    exit;
}
?>