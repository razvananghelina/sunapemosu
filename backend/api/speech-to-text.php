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
$fileName = $audioFile['name'];
$mimeType = $audioFile['type'] ?: 'audio/webm';

// Folosim CURLFile pentru upload - mult mai sigur decat multipart manual
$cfile = new CURLFile($audioPath, $mimeType, $fileName);

$postFields = [
    'file' => $cfile,
    'model' => 'whisper-1',
    'language' => 'ro',
    'prompt' => 'Aceasta este o conversație în limba română între un copil și Moș Crăciun. Copilul spune nume românești precum Ana, Maria, Livia, Liviuța, Andrei, Mihai, Ioana, Răzvan. Vorbește despre cadouri, sărbători, și ce își dorește de Crăciun.'
];

$ch = curl_init();

curl_setopt_array($ch, [
    CURLOPT_URL => 'https://api.openai.com/v1/audio/transcriptions',
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $postFields,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . $config['openai']['api_key']
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
    sendError('OpenAI API error: ' . $response, $httpCode);
}

$result = json_decode($response, true);
sendJsonResponse(['text' => $result['text'] ?? '']);
