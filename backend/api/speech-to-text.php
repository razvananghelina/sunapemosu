<?php
require_once __DIR__ . '/cors.php';
handleCors();

$config = require __DIR__ . '/../config/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendError('Method not allowed', 405);
}

// Check if audio file was uploaded
if (!isset($_FILES['audio']) || $_FILES['audio']['error'] !== UPLOAD_ERR_OK) {
    sendError('No audio file uploaded');
}

$audioFile = $_FILES['audio'];
$audioPath = $audioFile['tmp_name'];

// Prepare the multipart form data for OpenAI Whisper API
$ch = curl_init();
$boundary = uniqid();

// Read the audio file
$audioData = file_get_contents($audioPath);
$fileName = $audioFile['name'];

// Build multipart body
$body = "--{$boundary}\r\n";
$body .= "Content-Disposition: form-data; name=\"file\"; filename=\"{$fileName}\"\r\n";
$body .= "Content-Type: " . $audioFile['type'] . "\r\n\r\n";
$body .= $audioData . "\r\n";
$body .= "--{$boundary}\r\n";
$body .= "Content-Disposition: form-data; name=\"model\"\r\n\r\n";
$body .= "whisper-1\r\n";
$body .= "--{$boundary}--\r\n";

curl_setopt_array($ch, [
    CURLOPT_URL => 'https://api.openai.com/v1/audio/transcriptions',
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $body,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . $config['openai']['api_key'],
        'Content-Type: multipart/form-data; boundary=' . $boundary
    ]
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if (curl_errno($ch)) {
    sendError('Curl error: ' . curl_error($ch), 500);
}

curl_close($ch);

if ($httpCode !== 200) {
    sendError('OpenAI API error: ' . $response, $httpCode);
}

$result = json_decode($response, true);
sendJsonResponse(['text' => $result['text'] ?? '']);
