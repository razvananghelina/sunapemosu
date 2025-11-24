<?php
// CORS handling
function handleCors() {
    $config = require __DIR__ . '/../config/config.php';
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

    if (in_array($origin, $config['cors']['allowed_origins'])) {
        header("Access-Control-Allow-Origin: $origin");
    }

    header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization");
    header("Access-Control-Max-Age: 86400");

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit();
    }
}

function sendJsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit();
}

function sendError($message, $statusCode = 400) {
    sendJsonResponse(['error' => $message], $statusCode);
}
