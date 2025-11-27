<?php
require_once __DIR__ . '/cors.php';
handleCors();

$config = require __DIR__ . '/../config/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendError('Method not allowed', 405);
}

$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['text'])) {
    sendError('Text is required');
}

$text = $input['text'];
$voiceId = $input['voice_id'] ?? $config['elevenlabs']['voice_id'];
$voiceSettings = $input['voice_settings'] ?? $config['elevenlabs']['voice_settings'];

// Extragem speed din voice_settings daca exista (trebuie sa fie separat in API)
$speed = null;
if (isset($voiceSettings['speed'])) {
    $speed = $voiceSettings['speed'];
    unset($voiceSettings['speed']); // Scoatem din voice_settings
}

// Prepare request to Eleven Labs
$data = [
    'text' => $text,
    'model_id' => $config['elevenlabs']['model_id'],
    'voice_settings' => $voiceSettings
];

// Adaugam speed ca parametru separat (nu in voice_settings)
if ($speed !== null) {
    $data['speed'] = $speed;
}

$ch = curl_init();

curl_setopt_array($ch, [
    CURLOPT_URL => "https://api.elevenlabs.io/v1/text-to-speech/{$voiceId}",
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode($data),
    CURLOPT_HTTPHEADER => [
        'xi-api-key: ' . $config['elevenlabs']['api_key'],
        'Content-Type: application/json',
        'Accept: audio/mpeg'
    ],
    CURLOPT_TIMEOUT => 30, // 30 secunde timeout total
    CURLOPT_CONNECTTIMEOUT => 10 // 10 secunde pentru conectare
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if (curl_errno($ch)) {
    sendError('Curl error: ' . curl_error($ch), 500);
}

curl_close($ch);

if ($httpCode !== 200) {
    sendError('Eleven Labs API error: ' . $response, $httpCode);
}

// Return audio as base64
$audioBase64 = base64_encode($response);
sendJsonResponse([
    'audio' => $audioBase64,
    'format' => 'mp3'
]);
